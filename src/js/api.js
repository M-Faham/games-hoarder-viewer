// ═══════════════════════════════════════
// RAWG API Module
// Get your free key at: https://rawg.io/apidocs
// ═══════════════════════════════════════
import APIKEY from './apikey';

const API = (() => {
  // ⚠️  Replace this with your own free RAWG API key from https://rawg.io/apidocs
  const API_KEY = APIKEY;
  const BASE = 'https://api.rawg.io/api';

  async function fetchGame(searchName) {
    try {
      // 1. Search for the game
      const searchRes = await fetch(
        `${BASE}/games?key=${API_KEY}&search=${encodeURIComponent(searchName)}&page_size=1&search_precise=true`
      );
      if (!searchRes.ok) throw new Error('Search failed');
      const searchData = await searchRes.json();

      if (!searchData.results || searchData.results.length === 0) {
        // Retry with looser search
        const retryRes = await fetch(
          `${BASE}/games?key=${API_KEY}&search=${encodeURIComponent(searchName)}&page_size=1`
        );
        const retryData = await retryRes.json();
        if (!retryData.results || retryData.results.length === 0) return null;
        return await fetchGameDetails(retryData.results[0].id);
      }

      return await fetchGameDetails(searchData.results[0].id);
    } catch (err) {
      console.error('fetchGame error:', err);
      return null;
    }
  }

  async function fetchGameDetails(id) {
    try {
      const [detailRes, screenshotRes] = await Promise.all([
        fetch(`${BASE}/games/${id}?key=${API_KEY}`),
        fetch(`${BASE}/games/${id}/screenshots?key=${API_KEY}&page_size=6`)
      ]);

      if (!detailRes.ok) return null;
      const detail = await detailRes.json();
      const ssData = screenshotRes.ok ? await screenshotRes.json() : { results: [] };

      return {
        id: detail.id,
        name: detail.name,
        description: stripHtml(detail.description || ''),
        cover: detail.background_image || null,
        rating: detail.rating || 0,
        ratingTop: detail.rating_top || 5,
        ratingsCount: detail.ratings_count || 0,
        metacritic: detail.metacritic || null,
        released: detail.released || null,
        developers: (detail.developers || []).map(d => d.name).join(', '),
        publishers: (detail.publishers || []).map(p => p.name).join(', '),
        genres: (detail.genres || []).map(g => g.name),
        platforms: (detail.platforms || []).map(p => p.platform.name),
        screenshots: (ssData.results || []).map(s => s.image),
        website: detail.website || null,
        rawgUrl: `https://rawg.io/games/${detail.slug}`
      };
    } catch (err) {
      console.error('fetchGameDetails error:', err);
      return null;
    }
  }

  function stripHtml(html) {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p>/gi, '')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return { fetchGame };
})();
