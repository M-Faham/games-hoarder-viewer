// ═══════════════════════════════════════
// Shared: duplicate detection (same matched game in several folders)
// ═══════════════════════════════════════

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = Object.assign(root.Shared || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {

  // → Map<rawgId, game[]> with only groups of 2+
  function duplicateGroups(games) {
    const byId = new Map();
    for (const g of games) {
      if (g.skipped || !g.data?.id) continue;
      if (!byId.has(g.data.id)) byId.set(g.data.id, []);
      byId.get(g.data.id).push(g);
    }
    for (const [id, list] of byId) if (list.length < 2) byId.delete(id);
    return byId;
  }

  return { duplicateGroups };
});
