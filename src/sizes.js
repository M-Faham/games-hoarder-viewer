// ═══════════════════════════════════════
// Background folder-size calculation (main process)
// One game folder at a time, reusing saved sizes while the fingerprint is unchanged
// ═══════════════════════════════════════

const fsp = require('fs/promises');
const path = require('path');
const { fingerprint } = require('./shared/format');
const { normalizePath } = require('./shared/paths');

let running = false;
let pending = [];
let cancelled = false;

async function folderFingerprint(dir) {
  const dirStat = await fsp.stat(dir);
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const stats = [];
  for (const e of entries) {
    try { stats.push(await fsp.lstat(path.join(dir, e.name))); }
    catch { stats.push({ mtimeMs: 0, size: 0 }); }
  }
  return fingerprint(dirStat, stats);
}

// Iterative walk; symlinks/junctions are skipped; unreadable entries make the result approximate
async function dirSize(dir) {
  let bytes = 0;
  let approx = false;
  const stack = [dir];
  while (stack.length) {
    if (cancelled) break;
    const current = stack.pop();
    let entries;
    try { entries = await fsp.readdir(current, { withFileTypes: true }); }
    catch { approx = true; continue; }
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { stack.push(full); continue; }
      try { bytes += (await fsp.lstat(full)).size; }
      catch { approx = true; }
    }
  }
  return { bytes, approx };
}

async function runOnce({ rootId, force }, store, send) {
  if (force) store.clearSizes(rootId);
  const games = store.getLibrary().games.filter(g => !g.skipped && (!rootId || g.rootId === rootId));
  const sizes = store.getSizes();

  for (const g of games) {
    if (cancelled) return;
    let fp;
    try { fp = await folderFingerprint(g.folderPath); }
    catch { continue; } // unavailable drive or folder gone
    const key = normalizePath(g.folderPath);
    if (sizes[key] && sizes[key].fp === fp) continue;

    const { bytes, approx } = await dirSize(g.folderPath);
    if (cancelled) return;
    store.putSize(key, { bytes, approx, computedAt: Date.now(), fp });
    send({ folderPath: g.folderPath, bytes, approx });
  }
}

async function loop(store, send) {
  running = true;
  while (pending.length && !cancelled) {
    const opts = pending.shift();
    try { await runOnce(opts, store, send); }
    catch (err) { console.error('size scan error:', err); }
  }
  running = false;
  if (!cancelled) {
    store.flush();
    send({ done: true });
  }
}

function start(opts, store, send) {
  const next = { rootId: opts?.rootId, force: !!opts?.force };
  // Requests queue up while a scan runs; identical ones are dropped
  if (!pending.some(p => p.rootId === next.rootId && p.force === next.force)) pending.push(next);
  if (!running) loop(store, send);
}

function cancel() { cancelled = true; }

async function freeSpace(rootPath) {
  const s = await fsp.statfs(rootPath);
  return s.bavail * s.bsize;
}

module.exports = { start, cancel, freeSpace };
