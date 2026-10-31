// ═══════════════════════════════════════
// Shared: reconcile saved game records with a fresh scan of library folders
// ═══════════════════════════════════════

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = Object.assign(root.Shared || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {

  // savedGames: GameRecord[]; scans: RootScan[]; cleanFn(name) → searchName; samePath(a, b) → bool
  // → { games, added, removedCount }
  function reconcileGames(savedGames, scans, cleanFn, samePath) {
    const scanById = new Map(scans.map(s => [s.id, s]));
    const games = [];
    const added = [];
    let removedCount = 0;

    // Keep or drop saved records
    for (const rec of savedGames) {
      const scan = scanById.get(rec.rootId);
      if (!scan || !scan.available) { games.push(rec); continue; }
      if (scan.entries.some(e => samePath(e.path, rec.folderPath))) games.push(rec);
      else removedCount++;
    }

    // Add new folders of available roots
    for (const scan of scans) {
      if (!scan.available) continue;
      for (const entry of scan.entries) {
        if (games.some(g => samePath(g.folderPath, entry.path))) continue;
        const rec = {
          folderPath: entry.path,
          rootId: scan.id,
          folderName: entry.name,
          searchName: cleanFn(entry.name),
          skipped: false
        };
        games.push(rec);
        added.push(rec);
      }
    }

    return { games, added, removedCount };
  }

  return { reconcileGames };
});
