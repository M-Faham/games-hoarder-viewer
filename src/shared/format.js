// ═══════════════════════════════════════
// Shared: formatting + folder fingerprint helpers
// ═══════════════════════════════════════

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = Object.assign(root.Shared || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {

  const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

  function formatBytes(n) {
    if (n == null || isNaN(n)) return '';
    let v = Number(n);
    let i = 0;
    while (v >= 1024 && i < UNITS.length - 1) { v /= 1024; i++; }
    return i === 0 ? `${v} B` : `${v.toFixed(1)} ${UNITS[i]}`;
  }

  // dirStat: { mtimeMs }; entryStats: [{ mtimeMs, size }] of top-level entries
  function fingerprint(dirStat, entryStats) {
    let sumMtime = 0, sumSize = 0;
    for (const s of entryStats) { sumMtime += Math.floor(s.mtimeMs || 0); sumSize += s.size || 0; }
    return `${Math.floor(dirStat.mtimeMs || 0)}|${entryStats.length}|${sumMtime}|${sumSize}`;
  }

  return { formatBytes, fingerprint };
});
