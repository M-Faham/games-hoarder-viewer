// ═══════════════════════════════════════
// Shared: ignore list — folder names that are never treated as games
// ═══════════════════════════════════════

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = Object.assign(root.Shared || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {

  const DEFAULT_IGNORE = ['$RECYCLE.BIN', 'System Volume Information', 'temp', 'tmp', '*torrent-temp*'];

  function toRegex(pattern) {
    const src = pattern.trim().replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp('^' + src + '$', 'i');
  }

  function cleanPatterns(patterns) {
    return (patterns || []).map(p => String(p).trim()).filter(p => p && !p.startsWith('#'));
  }

  // → true when `name` matches any pattern (case-insensitive; * and ? wildcards)
  function matchesIgnore(name, patterns) {
    return cleanPatterns(patterns).some(p => toRegex(p).test(name));
  }

  return { DEFAULT_IGNORE, matchesIgnore, cleanIgnorePatterns: cleanPatterns };
});
