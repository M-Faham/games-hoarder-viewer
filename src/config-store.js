// ═══════════════════════════════════════
// Config Store — config.json in userData (main process only)
// API key (encrypted), library folders, game decisions, sizes, UI + update state
// ═══════════════════════════════════════

const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const { isSamePath, normalizePath } = require('./shared/paths');
const { validateRootName } = require('./shared/names');
const { DEFAULT_VIEW } = require('./shared/query');
const { DEFAULT_IGNORE, cleanIgnorePatterns } = require('./shared/ignore');

let cfg = null;
let saveTimer = null;

function file() { return path.join(app.getPath('userData'), 'config.json'); }

function defaults() {
  return {
    version: 1,
    apiKey: null,
    roots: [],
    games: [],
    sizes: {},
    ignore: DEFAULT_IGNORE.slice(),
    ui: {
      folderFilter: [],
      hideUnavailable: false,
      view: JSON.parse(JSON.stringify(DEFAULT_VIEW)),
      exportPaths: { csv: true, html: false }
    },
    update: { enabled: true, lastCheckAt: null, latest: null, dismissed: null }
  };
}

// Fill in fields missing from older config files
function withDefaults(c) {
  const d = defaults();
  const out = Object.assign(d, c);
  out.roots = Array.isArray(c.roots) ? c.roots : [];
  out.games = (Array.isArray(c.games) ? c.games : []).map(g => ({
    match: null, status: null, addedAt: Date.now(), skipped: false, ...g
  }));
  out.ignore = Array.isArray(c.ignore) ? c.ignore : DEFAULT_IGNORE.slice();
  out.sizes = c.sizes && typeof c.sizes === 'object' ? c.sizes : {};
  out.ui = Object.assign(defaults().ui, c.ui || {});
  out.ui.view = Object.assign(JSON.parse(JSON.stringify(DEFAULT_VIEW)), out.ui.view || {});
  out.ui.exportPaths = Object.assign({ csv: true, html: false }, out.ui.exportPaths || {});
  out.update = Object.assign(defaults().update, c.update || {});
  return out;
}

function load() {
  if (cfg) return cfg;
  try {
    const raw = fs.readFileSync(file(), 'utf8');
    cfg = raw.trim() ? withDefaults(JSON.parse(raw)) : defaults();
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // Corrupt file — keep it for the user, start fresh
      try { fs.renameSync(file(), path.join(path.dirname(file()), `config.corrupt-${Date.now()}.json`)); } catch {}
    }
    cfg = defaults();
  }
  return cfg;
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = null;
  const target = file();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target + '.tmp', JSON.stringify(load(), null, 2), 'utf8');
  fs.renameSync(target + '.tmp', target);
}

// Batched save for frequent writes (sizes)
function saveSoon() {
  if (!saveTimer) saveTimer = setTimeout(save, 1500);
}

function flush() { if (saveTimer) save(); }

// ── API KEY ──
function keyStatus() {
  const k = load().apiKey;
  if (!k) return { hasKey: false, masked: null, encrypted: false, lastCheckResult: null };
  const plain = getPlainKey();
  return {
    hasKey: !!plain,
    masked: plain ? '••••••••' + plain.slice(-4) : null,
    encrypted: !!k.encrypted,
    lastCheckResult: k.lastCheckResult || null
  };
}

function getPlainKey() {
  const k = load().apiKey;
  if (!k || !k.value) return null;
  if (!k.encrypted) return k.value;
  try { return safeStorage.decryptString(Buffer.from(k.value, 'base64')); }
  catch { return null; }
}

function setKey(key, validated) {
  const plain = String(key || '').trim();
  if (!plain) return { error: 'empty' };
  const canEncrypt = safeStorage.isEncryptionAvailable();
  load().apiKey = {
    value: canEncrypt ? safeStorage.encryptString(plain).toString('base64') : plain,
    encrypted: canEncrypt,
    lastCheckedAt: validated ? Date.now() : null,
    lastCheckResult: validated ? 'ok' : 'unchecked'
  };
  save();
  return keyStatus();
}

function markKey(result) {
  const k = load().apiKey;
  if (!k) return keyStatus();
  k.lastCheckResult = result;
  k.lastCheckedAt = Date.now();
  save();
  return keyStatus();
}

function clearKey() {
  load().apiKey = null;
  save();
  return { ok: true };
}

// ── LIBRARY ──
function getLibrary() {
  const c = load();
  return { roots: c.roots, games: c.games, ui: c.ui, ignore: c.ignore, update: { enabled: c.update.enabled } };
}

function newId() {
  return 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// items: [{ path, name }] — all or nothing
function addRoots(items) {
  const c = load();
  const details = [];
  const takenNames = c.roots.map(r => r.name);
  const takenPaths = c.roots.map(r => r.path);
  const accepted = [];

  items.forEach((item, index) => {
    if (takenPaths.some(p => isSamePath(p, item.path))) { details.push({ index, code: 'PATH_EXISTS' }); return; }
    const v = validateRootName(item.name, takenNames);
    if (!v.ok) { details.push({ index, code: v.code }); return; }
    takenNames.push(v.name);
    takenPaths.push(item.path);
    accepted.push({ id: newId(), path: item.path, name: v.name, addedAt: Date.now() });
  });

  if (details.length) return { error: 'validation', code: details[0].code, details };
  c.roots.push(...accepted);
  save();
  return { roots: accepted };
}

function renameRoot(id, name) {
  const c = load();
  const root = c.roots.find(r => r.id === id);
  if (!root) return { error: 'not_found', code: 'NOT_FOUND' };
  const v = validateRootName(name, c.roots.filter(r => r.id !== id).map(r => r.name));
  if (!v.ok) return { error: 'validation', code: v.code };
  root.name = v.name;
  save();
  return { root };
}

function removeRoot(id) {
  const c = load();
  c.roots = c.roots.filter(r => r.id !== id);
  c.games.filter(g => g.rootId === id).forEach(g => delete c.sizes[normalizePath(g.folderPath)]);
  c.games = c.games.filter(g => g.rootId !== id);
  c.ui.folderFilter = c.ui.folderFilter.filter(x => x !== id);
  save();
  return { ok: true };
}

// Replace games[], keeping 002 overrides of known paths unless the record sets them
function saveGames(records) {
  const c = load();
  const byPath = new Map(c.games.map(g => [normalizePath(g.folderPath), g]));
  c.games = records.map(r => {
    const prev = byPath.get(normalizePath(r.folderPath)) || {};
    return {
      folderPath: r.folderPath,
      rootId: r.rootId,
      folderName: r.folderName,
      searchName: r.searchName,
      skipped: !!r.skipped,
      match: 'match' in r ? r.match : (prev.match || null),
      status: 'status' in r ? r.status : (prev.status || null),
      addedAt: prev.addedAt || r.addedAt || Date.now()
    };
  });
  // Drop sizes of games that no longer exist
  const keep = new Set(c.games.map(g => normalizePath(g.folderPath)));
  Object.keys(c.sizes).forEach(k => { if (!keep.has(k)) delete c.sizes[k]; });
  save();
  return { ok: true, games: c.games };
}

function findGame(folderPath) {
  return load().games.find(g => isSamePath(g.folderPath, folderPath));
}

function setGameField(folderPath, field, value) {
  const g = findGame(folderPath);
  if (!g) return { error: 'not_found', code: 'NOT_FOUND' };
  g[field] = value;
  save();
  return { ok: true };
}

function setGamesStatus(folderPaths, status) {
  const valid = [null, 'backlog', 'installed', 'played', 'delete'];
  if (!valid.includes(status)) return { error: 'invalid status' };
  folderPaths.forEach(p => { const g = findGame(p); if (g) g.status = status; });
  save();
  return { ok: true };
}

function setUi(field, value) {
  load().ui[field] = value;
  save();
  return { ok: true };
}

function getIgnore() { return load().ignore; }

function setIgnore(list) {
  load().ignore = cleanIgnorePatterns(Array.isArray(list) ? list : []);
  save();
  return { ok: true, ignore: load().ignore };
}

// ── SIZES ──
function getSizes() { return load().sizes; }

function putSize(key, value) {
  load().sizes[key] = value;
  saveSoon();
}

function clearSizes(rootId) {
  const c = load();
  c.games.filter(g => !rootId || g.rootId === rootId).forEach(g => delete c.sizes[normalizePath(g.folderPath)]);
  save();
}

// ── UPDATE ──
function getUpdateState() { return load().update; }

function setUpdateState(patch) {
  Object.assign(load().update, patch);
  save();
  return { ok: true };
}

module.exports = {
  load, save, flush,
  keyStatus, getPlainKey, setKey, markKey, clearKey,
  getLibrary, addRoots, renameRoot, removeRoot, saveGames, findGame, setGameField, setGamesStatus, setUi,
  getIgnore, setIgnore,
  getSizes, putSize, clearSizes,
  getUpdateState, setUpdateState
};
