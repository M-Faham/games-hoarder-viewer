// ═══════════════════════════════════════
// Shared: "Pick something for me"
// ═══════════════════════════════════════

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = Object.assign(root.Shared || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {

  // Backlog first; otherwise matched games that aren't Played / Can delete
  function pickPool(list) {
    const visible = list.filter(g => !g.skipped);
    const backlog = visible.filter(g => g.status === 'backlog');
    if (backlog.length) return { pool: backlog, reason: 'backlog' };
    const rest = visible.filter(g => g.data && g.status !== 'played' && g.status !== 'delete');
    return { pool: rest, reason: rest.length ? 'matched' : 'empty' };
  }

  // Weighted by rating: weight = 1 + rating (unrated counts as 2.5)
  function pickGame(list, rng = Math.random, excludeKey = null) {
    let { pool } = pickPool(list);
    if (pool.length > 1 && excludeKey) pool = pool.filter(g => g.folderPath !== excludeKey);
    if (!pool.length) return null;
    const weights = pool.map(g => 1 + (g.data?.rating || 2.5));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r < 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  return { pickGame, pickPool };
});
