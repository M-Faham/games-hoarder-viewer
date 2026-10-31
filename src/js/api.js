// ═══════════════════════════════════════
// RAWG API Module
// The key is entered in the app (Welcome page / Settings) and loaded via IPC
// ═══════════════════════════════════════

const API = (() => {
  const BASE = "https://api.rawg.io/api";

  // New prefix: lookups made before the similarity check existed (wrong matches) are never reused
  const CACHE_PREFIX = "rawgm_";
  const ID_PREFIX = "rawgid_";
  const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  let apiKey = null;
  let keyUnchecked = false;
  let rejectedNotified = false;
  const rejectedCallbacks = [];

  // ── CACHE ── expired entries are kept and returned as stale (used when offline / no key)
  function cacheRead(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return undefined;
      const { ts, data } = JSON.parse(raw);
      return { data, stale: Date.now() - ts > CACHE_TTL };
    } catch {
      return undefined;
    }
  }

  function cacheWrite(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch {}
  }

  function searchKey(searchName) { return CACHE_PREFIX + searchName.toLowerCase(); }

  // ── KEY ──
  async function init() {
    apiKey = await window.electronAPI.getApiKeyForRequests();
    const status = await window.electronAPI.getApiKeyStatus();
    keyUnchecked = status?.lastCheckResult === "unchecked";
  }

  function setKey(k) {
    apiKey = k || null;
    keyUnchecked = false;
    rejectedNotified = false;
  }

  function hasKey() { return !!apiKey; }

  function onKeyRejected(cb) { rejectedCallbacks.push(cb); }

  // → { kind, res }
  async function rawgFetch(url) {
    let res;
    try {
      res = await fetch(url);
    } catch {
      return { kind: "offline" };
    }
    const kind = Shared.classifyRawgResponse({ status: res.status });
    if (kind === "invalid" && !rejectedNotified) {
      rejectedNotified = true;
      window.electronAPI.markApiKeyInvalid();
      rejectedCallbacks.forEach(cb => cb());
    }
    if (kind === "ok" && keyUnchecked) {
      keyUnchecked = false;
      window.electronAPI.markApiKeyValid();
    }
    return { kind, res };
  }

  // → "ok" | "invalid" | "offline" | "rate_limited" | "error"
  async function validateKey(key) {
    try {
      const res = await fetch(`${BASE}/games?key=${encodeURIComponent(key)}&page_size=1`);
      return Shared.classifyRawgResponse({ status: res.status });
    } catch {
      return "offline";
    }
  }

  function fallback(cached, error) {
    return cached !== undefined
      ? { data: cached.data, state: "stale", error }
      : { data: null, state: "none", error };
  }

  // ── FETCH ── all return { data, state: "fresh"|"stale"|"none", error? }; errors are never cached
  async function fetchGame(searchName) {
    const key = searchKey(searchName);
    const cached = cacheRead(key);
    if (cached !== undefined && !cached.stale) return { data: cached.data, state: "fresh" };
    if (!apiKey) return fallback(cached, "no_key");

    const q = encodeURIComponent(searchName);
    let r = await rawgFetch(`${BASE}/games?key=${apiKey}&search=${q}&page_size=5&search_precise=true`);
    if (r.kind !== "ok") return fallback(cached, r.kind);
    let first = Shared.bestMatch(searchName, (await r.res.json()).results);

    if (!first) {
      r = await rawgFetch(`${BASE}/games?key=${apiKey}&search=${q}&page_size=5`);
      if (r.kind !== "ok") return fallback(cached, r.kind);
      first = Shared.bestMatch(searchName, (await r.res.json()).results);
    }

    if (!first) {
      cacheWrite(key, null);
      return { data: null, state: "fresh" };
    }

    const details = await fetchGameDetails(first.id);
    if (details.error) return fallback(cached, details.error);
    cacheWrite(key, details.data);
    cacheWrite(ID_PREFIX + details.data.id, details.data);
    return { data: details.data, state: "fresh" };
  }

  // Manual matches (Fix match) are looked up by RAWG id
  async function fetchGameById(id) {
    const key = ID_PREFIX + id;
    const cached = cacheRead(key);
    if (cached !== undefined && !cached.stale) return { data: cached.data, state: "fresh" };
    if (!apiKey) return fallback(cached, "no_key");

    const details = await fetchGameDetails(id);
    if (details.error) return fallback(cached, details.error);
    cacheWrite(key, details.data);
    return { data: details.data, state: "fresh" };
  }

  // → { data } | { error }
  async function fetchGameDetails(id) {
    try {
      const [detailRes, screenshotRes] = await Promise.all([
        rawgFetch(`${BASE}/games/${id}?key=${apiKey}`),
        rawgFetch(`${BASE}/games/${id}/screenshots?key=${apiKey}&page_size=6`),
      ]);

      if (detailRes.kind !== "ok") return { error: detailRes.kind };
      const detail = await detailRes.res.json();
      const ssData = screenshotRes.kind === "ok"
        ? await screenshotRes.res.json()
        : { results: [] };

      return {
        data: {
          id: detail.id,
          name: detail.name,
          description: stripHtml(detail.description || ""),
          cover: detail.background_image || null,
          rating: detail.rating || 0,
          ratingTop: detail.rating_top || 5,
          ratingsCount: detail.ratings_count || 0,
          metacritic: detail.metacritic || null,
          released: detail.released || null,
          developers: (detail.developers || []).map((d) => d.name).join(", "),
          publishers: (detail.publishers || []).map((p) => p.name).join(", "),
          genres: (detail.genres || []).map((g) => g.name),
          platforms: (detail.platforms || []).map((p) => p.platform.name),
          screenshots: (ssData.results || []).map((s) => s.image),
          website: detail.website || null,
          rawgUrl: `https://rawg.io/games/${detail.slug}`,
        }
      };
    } catch (err) {
      console.error("fetchGameDetails error:", err);
      return { error: "error" };
    }
  }

  // Fix match candidates → { results: [{ id, name, released, cover }] } | { error }
  async function searchCandidates(term) {
    if (!apiKey) return { error: "no_key" };
    const r = await rawgFetch(`${BASE}/games?key=${apiKey}&search=${encodeURIComponent(term)}&page_size=5`);
    if (r.kind !== "ok") return { error: r.kind };
    const json = await r.res.json();
    return {
      results: (json.results || []).map(g => ({
        id: g.id,
        name: g.name,
        released: g.released || null,
        cover: g.background_image || null
      }))
    };
  }

  function stripHtml(html) {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<p>/gi, "")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function clearCache() {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith("rawg"),
    );
    keys.forEach((k) => localStorage.removeItem(k));
    return keys.filter((k) => k.startsWith(CACHE_PREFIX)).length;
  }

  function cacheStats() {
    return Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX))
      .length;
  }

  return {
    init, setKey, hasKey, onKeyRejected, validateKey,
    fetchGame, fetchGameById, searchCandidates,
    clearCache, cacheStats
  };
})();
