const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { cleanGameName } = require('./shared/names');
const { isSamePath } = require('./shared/paths');
const { matchesIgnore } = require('./shared/ignore');
const { compareVersions } = require('./shared/versions');
const store = require('./config-store');
const sizes = require('./sizes');

const RELEASES_API = 'https://api.github.com/repos/M-Faham/games-hoarder-viewer/releases/latest';
const UPDATE_INTERVAL = 24 * 60 * 60 * 1000;

// One userData folder for dev (`npm start`), packaged and portable runs
app.setName('Games Hoarder Viewer');
app.setPath('userData', path.join(app.getPath('appData'), 'Games Hoarder Viewer'));

// One-time, best-effort copy of the metadata cache from the old dev-run location
try {
  const dst = path.join(app.getPath('userData'), 'Local Storage');
  const src = path.join(app.getPath('appData'), 'games-hoarder-viewer', 'Local Storage');
  if (!fs.existsSync(dst) && fs.existsSync(src)) fs.cpSync(src, dst, { recursive: true });
} catch {}

let mainWindow;
let lastExportPath = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0c1a22',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0c1a22',
      symbolColor: '#a9c5cc',
      height: 40
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(createWindow);

app.on('before-quit', () => {
  sizes.cancel();
  store.flush();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Wrap handlers so errors come back as { error } instead of throwing across the bridge
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try { return await fn(...args); }
    catch (err) { return { error: err.message, code: err.code }; }
  });
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data);
}

// ── FOLDERS ──

function readSubfolders(dirPath) {
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(e => e.isDirectory() && !matchesIgnore(e.name, store.getIgnore()))
    .map(e => ({
      name: e.name,
      path: path.join(dirPath, e.name),
      cleaned: cleanGameName(e.name)
    }));
}

handle('pick-directories', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'multiSelections'],
    title: 'Select your game folders'
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('read-folders', async (event, dirPath) => {
  try { return readSubfolders(dirPath); }
  catch (err) { return { error: err.message, code: err.code }; }
});

// Rescan every saved root; subfolders that are themselves saved roots are skipped
handle('scan-roots', async () => {
  const { roots } = store.getLibrary();
  return roots.map(root => {
    try {
      const entries = readSubfolders(root.path)
        .filter(e => !roots.some(r => r.id !== root.id && isSamePath(r.path, e.path)));
      return { id: root.id, path: root.path, name: root.name, available: true, entries };
    } catch (err) {
      return { id: root.id, path: root.path, name: root.name, available: false, entries: [], code: err.code };
    }
  });
});

// ── LIBRARY ──

handle('get-library', () => store.getLibrary());

handle('add-roots', items => {
  const details = [];
  items.forEach((item, index) => {
    try {
      if (readSubfolders(item.path).length === 0) details.push({ index, code: 'NO_SUBFOLDERS' });
    } catch (err) {
      details.push({ index, code: err.code || 'UNREADABLE' });
    }
  });
  if (details.length) return { error: 'validation', code: details[0].code, details };
  return store.addRoots(items);
});

handle('rename-root', (id, name) => store.renameRoot(id, name));
handle('remove-root', id => store.removeRoot(id));
handle('save-games', records => store.saveGames(records));
handle('set-folder-filter', ids => store.setUi('folderFilter', ids));
handle('set-hide-unavailable', hide => store.setUi('hideUnavailable', !!hide));
handle('restore-game', folderPath => store.setGameField(folderPath, 'skipped', false));
handle('set-game-skipped', (folderPath, skipped) => store.setGameField(folderPath, 'skipped', !!skipped));
handle('set-game-match', (folderPath, match) => store.setGameField(folderPath, 'match', match || null));
handle('set-games-status', (folderPaths, status) => store.setGamesStatus(folderPaths, status || null));
handle('set-view-settings', view => store.setUi('view', view));
handle('set-ignore-list', list => store.setIgnore(list));
handle('set-export-paths', prefs => store.setUi('exportPaths', prefs));

// ── API KEY ──

handle('get-api-key-status', () => store.keyStatus());
handle('get-api-key-for-requests', () => store.getPlainKey());
handle('set-api-key', (key, opts) => store.setKey(key, opts?.validated !== false));
handle('mark-api-key-invalid', () => store.markKey('invalid'));
handle('mark-api-key-valid', () => store.markKey('ok'));
handle('clear-api-key', () => store.clearKey());

// ── SIZES ──

handle('start-size-scan', opts => {
  sizes.start(opts, store, data => sendToRenderer('size-progress', data));
  return { ok: true };
});
handle('get-sizes', () => store.getSizes());
handle('get-free-space', async rootPath => ({ free: await sizes.freeSpace(rootPath) }));

// ── QUICK ACTIONS ──

const INSTALLER_RE = /(setup|install)[^\\/]*\.(exe|msi)$/i;

function isKnownPath(p) {
  const { roots, games } = store.getLibrary();
  return games.some(g => isSamePath(g.folderPath, p)) || roots.some(r => isSamePath(r.path, p));
}

function listInstallers(gamePath) {
  return fs.readdirSync(gamePath, { withFileTypes: true })
    .filter(e => e.isFile() && INSTALLER_RE.test(e.name))
    .map(e => path.join(gamePath, e.name));
}

handle('show-in-folder', p => {
  if (!isKnownPath(p) && !(lastExportPath && isSamePath(p, lastExportPath))) return { error: 'not allowed', code: 'NOT_ALLOWED' };
  shell.showItemInFolder(p);
  return { ok: true };
});

handle('find-installers', gamePath => {
  if (!isKnownPath(gamePath)) return [];
  try { return listInstallers(gamePath); }
  catch { return []; }
});

handle('run-installer', async (gamePath, file) => {
  if (!isKnownPath(gamePath)) return { error: 'not allowed', code: 'NOT_ALLOWED' };
  let allowed;
  try { allowed = listInstallers(gamePath); }
  catch { return { error: 'Installer not found', code: 'NOT_FOUND' }; }
  if (!allowed.some(f => isSamePath(f, file))) {
    return fs.existsSync(file) ? { error: 'not allowed', code: 'NOT_ALLOWED' } : { error: 'Installer not found', code: 'NOT_FOUND' };
  }
  const err = await shell.openPath(file);
  return err ? { error: err } : { ok: true };
});

handle('copy-text', text => {
  clipboard.writeText(String(text));
  return { ok: true };
});

// ── UPDATE CHECK ──

handle('check-for-update', async opts => {
  const state = store.getUpdateState();
  if (!state.enabled) return { update: null };
  const due = opts?.force || !state.lastCheckAt || Date.now() - state.lastCheckAt > UPDATE_INTERVAL;

  if (due) {
    try {
      const res = await fetch(RELEASES_API, {
        headers: { 'User-Agent': 'games-hoarder-viewer', Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const rel = await res.json();
        store.setUpdateState({
          lastCheckAt: Date.now(),
          latest: { version: String(rel.tag_name || '').replace(/^v/i, ''), url: rel.html_url, notes: String(rel.body || '').slice(0, 500) }
        });
      } else {
        store.setUpdateState({ lastCheckAt: Date.now() });
      }
    } catch {
      return { update: null }; // offline — stay quiet
    }
  }

  const { latest, dismissed } = store.getUpdateState();
  if (!latest?.version || compareVersions(latest.version, app.getVersion()) <= 0) return { update: null };
  if (dismissed && compareVersions(dismissed, latest.version) === 0) return { update: null };
  return { update: latest };
});

handle('set-update-settings', patch => {
  const allowed = {};
  if ('enabled' in patch) allowed.enabled = !!patch.enabled;
  if ('dismissed' in patch) allowed.dismissed = patch.dismissed;
  return store.setUpdateState(allowed);
});

// ── EXPORT ──

handle('save-export', async ({ format, content, defaultName }) => {
  const filters = format === 'csv'
    ? [{ name: 'CSV spreadsheet', extensions: ['csv'] }]
    : [{ name: 'Web page', extensions: ['html'] }];
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export library',
    defaultPath: path.join(app.getPath('documents'), defaultName),
    filters
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  fs.writeFileSync(result.filePath, content, 'utf8');
  lastExportPath = result.filePath;
  return { path: result.filePath };
});

handle('open-path', async p => {
  if (!lastExportPath || !isSamePath(p, lastExportPath)) return { error: 'not allowed', code: 'NOT_ALLOWED' };
  const err = await shell.openPath(p);
  return err ? { error: err } : { ok: true };
});

// ── MISC ──

handle('get-app-version', () => app.getVersion());

// Open URL in default browser — http(s) only
handle('open-external', async url => {
  let parsed;
  try { parsed = new URL(url); } catch { return { error: 'invalid url' }; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { error: 'not allowed' };
  await shell.openExternal(parsed.toString());
  return { ok: true };
});
