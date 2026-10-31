// ═══════════════════════════════════════
// Shared: library sorting + filtering
// ═══════════════════════════════════════

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = Object.assign(root.Shared || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {

  const DEFAULT_VIEW = {
    sort: { field: 'name', dir: 'asc' },
    genres: [], yearMin: null, yearMax: null, ratingMin: null,
    match: 'all', statuses: [], duplicatesOnly: false
  };

  const SORT_FIELDS = ['name', 'rating', 'metacritic', 'year', 'size', 'added'];

  function gameName(g) { return (g.data?.name || g.searchName || g.folderName || '').toString(); }
  function gameYear(g) {
    const y = g.data?.released ? parseInt(g.data.released.slice(0, 4), 10) : NaN;
    return isNaN(y) ? null : y;
  }

  function sortValue(g, field) {
    switch (field) {
      case 'name':       return gameName(g).toLocaleLowerCase();
      case 'rating':     return g.data?.rating || null;
      case 'metacritic': return g.data?.metacritic || null;
      case 'year':       return gameYear(g);
      case 'size':       return g.size?.bytes ?? null;
      case 'added':      return g.addedAt || null;
      default:           return null;
    }
  }

  function withDefaults(view) {
    return Object.assign({}, DEFAULT_VIEW, view || {}, { sort: Object.assign({}, DEFAULT_VIEW.sort, view?.sort) });
  }

  // True when any filter beyond the sort is narrowing the list
  function isFiltered(view, ctx = {}) {
    const v = withDefaults(view);
    return !!(v.genres.length || v.yearMin != null || v.yearMax != null || v.ratingMin != null ||
      v.match !== 'all' || v.statuses.length || v.duplicatesOnly ||
      (ctx.text && ctx.text.trim()) || (ctx.rootIds && ctx.rootIds.length));
  }

  function allGenres(games) {
    const set = new Set();
    games.forEach(g => (g.data?.genres || []).forEach(x => set.add(x)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  // games: runtime game objects; view: saved view settings; ctx: { text, rootIds, hideUnavailable }
  // → { list, total, shownBytes }
  function queryLibrary(games, view, ctx = {}) {
    const v = withDefaults(view);
    const text = (ctx.text || '').trim().toLocaleLowerCase();
    const rootIds = ctx.rootIds || [];
    const genres = new Set(v.genres);
    const statuses = new Set(v.statuses);

    const visible = games.filter(g => !g.skipped && !(ctx.hideUnavailable && g.unavailable));
    const list = visible.filter(g => {
      if (rootIds.length && !rootIds.includes(g.rootId)) return false;
      if (text && !gameName(g).toLocaleLowerCase().includes(text)) return false;
      if (genres.size && !(g.data?.genres || []).some(x => genres.has(x))) return false;
      if (v.yearMin != null || v.yearMax != null) {
        const y = gameYear(g);
        if (y == null) return false;
        if (v.yearMin != null && y < v.yearMin) return false;
        if (v.yearMax != null && y > v.yearMax) return false;
      }
      if (v.ratingMin != null && !((g.data?.rating || 0) >= v.ratingMin && g.data?.rating)) return false;
      if (v.match === 'matched' && !g.data) return false;
      if (v.match === 'unmatched' && g.data) return false;
      if (statuses.size && !statuses.has(g.status || 'none')) return false;
      if (v.duplicatesOnly && !((g.copies || 0) >= 2)) return false;
      return true;
    });

    const field = SORT_FIELDS.includes(v.sort.field) ? v.sort.field : 'name';
    const mul = v.sort.dir === 'desc' ? -1 : 1;
    list.sort((a, b) => {
      const va = sortValue(a, field), vb = sortValue(b, field);
      const na = va == null, nb = vb == null;
      if (na !== nb) return na ? 1 : -1; // missing values always last
      if (!na && va !== vb) {
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
        if (cmp) return cmp * mul;
      }
      return gameName(a).localeCompare(gameName(b));
    });

    let result = list;
    if (v.duplicatesOnly) {
      // keep copies of the same game next to each other, ordered by the first copy's position
      const seen = new Set();
      result = [];
      for (const g of list) {
        const id = g.data?.id;
        if (seen.has(id)) continue;
        seen.add(id);
        list.forEach(x => { if (x.data?.id === id) result.push(x); });
      }
    }

    const shownBytes = result.reduce((sum, g) => sum + (g.size?.bytes || 0), 0);
    return { list: result, total: visible.length, shownBytes };
  }

  return { DEFAULT_VIEW, SORT_FIELDS, queryLibrary, allGenres, isFiltered, withDefaultView: withDefaults };
});
