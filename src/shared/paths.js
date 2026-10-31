// ═══════════════════════════════════════
// Shared: path helpers (main + renderer)
// ═══════════════════════════════════════

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = Object.assign(root.Shared || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {

  // Lower-case, backslashes, no trailing separator (except a drive root like "c:\")
  function normalizePath(p) {
    if (!p) return '';
    let s = String(p).replace(/\//g, '\\').toLowerCase();
    while (s.length > 3 && s.endsWith('\\')) s = s.slice(0, -1);
    if (/^[a-z]:$/.test(s)) s += '\\';
    return s;
  }

  function isSamePath(a, b) {
    return normalizePath(a) === normalizePath(b);
  }

  function basename(p) {
    const parts = String(p || '').split(/[\\/]+/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  }

  return { normalizePath, isSamePath, basename };
});
