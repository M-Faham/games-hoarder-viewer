// ═══════════════════════════════════════
// Shared: version comparison for the update notice
// ═══════════════════════════════════════

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = Object.assign(root.Shared || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {

  // → -1 | 0 | 1
  function compareVersions(a, b) {
    const pa = String(a || '').trim().replace(/^v/i, '').split(/[.+-]/).map(n => parseInt(n, 10) || 0);
    const pb = String(b || '').trim().replace(/^v/i, '').split(/[.+-]/).map(n => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length, 3);
    for (let i = 0; i < len; i++) {
      const x = pa[i] || 0, y = pb[i] || 0;
      if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
  }

  return { compareVersions };
});
