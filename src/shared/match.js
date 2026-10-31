// ═══════════════════════════════════════
// Shared: is a RAWG result really the game this folder is?
// ═══════════════════════════════════════

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = Object.assign(root.Shared || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {

  const THRESHOLD = 0.5;

  // Words that vary between releases of the same game; ignored only when comparing
  const NOISE = new Set([
    'edition', 'complete', 'enhanced', 'deluxe', 'ultimate', 'definitive', 'goty', 'remastered', 'remaster',
    'collectors', 'collector', 'gold', 'premium', 'digital', 'bundle', 'dlc', 'dlcs', 'repack', 'multi', 'the'
  ]);

  function tokens(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[\[\(][^\]\)]*[\]\)]/g, ' ')   // [v0.1beta], (2022)
      .replace(/&/g, ' and ')
      .replace(/['’`]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(t => t && !NOISE.has(t));
  }

  const isNumber = t => /^\d+$/.test(t);

  // 0..1: shared words / the larger word count. Differing sequel numbers score 0.
  function matchScore(a, b) {
    const ta = tokens(a), tb = tokens(b);
    if (!ta.length || !tb.length) return 0;
    const sa = new Set(ta), sb = new Set(tb);
    const na = [...sa].filter(isNumber), nb = [...sb].filter(isNumber);
    if (na.length && nb.length && (na.length !== nb.length || na.some(n => !sb.has(n)))) return 0;
    let shared = 0;
    sa.forEach(t => { if (sb.has(t)) shared++; });
    return shared / Math.max(sa.size, sb.size);
  }

  function isGoodMatch(a, b) { return matchScore(a, b) >= THRESHOLD; }

  // results: [{ name, ... }] in RAWG order → best acceptable result, or null
  function bestMatch(searchName, results) {
    let best = null, bestScore = 0;
    for (const r of results || []) {
      const score = matchScore(searchName, r.name);
      if (score >= THRESHOLD && score > bestScore) { best = r; bestScore = score; }
    }
    return best;
  }

  return { matchScore, isGoodMatch, bestMatch, MATCH_THRESHOLD: THRESHOLD };
});
