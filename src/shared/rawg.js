// ═══════════════════════════════════════
// Shared: RAWG response classification
// ═══════════════════════════════════════

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = Object.assign(root.Shared || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {

  // → 'ok' | 'invalid' | 'offline' | 'rate_limited' | 'error'
  function classifyRawgResponse({ networkError, status } = {}) {
    if (networkError) return 'offline';
    if (status === 401 || status === 403) return 'invalid';
    if (status === 429) return 'rate_limited';
    if (status >= 200 && status < 300) return 'ok';
    return 'error';
  }

  return { classifyRawgResponse };
});
