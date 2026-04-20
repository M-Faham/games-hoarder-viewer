const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0f13',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f0f13',
      symbolColor: '#a0a0b0',
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC: Pick a directory
ipcMain.handle('pick-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select your repacked games folder'
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// IPC: Read subfolders from a directory
ipcMain.handle('read-folders', async (event, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => ({
        name: e.name,
        path: path.join(dirPath, e.name),
        cleaned: cleanGameName(e.name)
      }));
  } catch (err) {
    return { error: err.message };
  }
});

// IPC: Open URL in default browser
ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
});

// Clean repacker tags from folder name
function cleanGameName(name) {
  return name
    // Remove content in brackets/parens like [FitGirl], (v1.2), [REPACK]
    .replace(/[\[\(][^\]\)]*[\]\)]/g, '')
    // Remove common repacker names
    .replace(/\b(FitGirl|DODI|GOG|Repack|REPACK|rG|ElAmigos|KaOs|Codex|CODEX|PLAZA|CPY|TiNYiSO|SKIDROW|EMPRESS|FLT|RG\s*Mechanics|Mechanics|RePack|repack|Selective|Download)\b/gi, '')
    // Remove version strings like v1.2.3 or 1.0.0
    .replace(/\bv?\d+\.\d+[\.\d]*/g, '')
    // Remove underscores and hyphens used as separators
    .replace(/[_\-\.]+/g, ' ')
    // Remove extra whitespace
    .replace(/\s{2,}/g, ' ')
    .trim();
}
