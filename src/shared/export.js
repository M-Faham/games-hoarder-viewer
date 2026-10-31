// ═══════════════════════════════════════
// Shared: library export (CSV + standalone HTML)
// ═══════════════════════════════════════

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = Object.assign(root.Shared || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {

  const STATUS_LABELS = { backlog: 'Backlog', installed: 'Installed', played: 'Played', delete: 'Can delete' };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function bytesLabel(n) {
    if (n == null) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let v = n, i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return i === 0 ? `${v} B` : `${v.toFixed(1)} ${units[i]}`;
  }

  // games: runtime game objects (with rootName, size, copies, status)
  function exportRows(games, { includePaths } = {}) {
    return games.map(g => {
      const row = {
        title: g.data?.name || g.searchName || g.folderName || '',
        folder: g.rootName || '',
        sizeBytes: g.size?.bytes ?? null,
        size: g.size ? bytesLabel(g.size.bytes) : '',
        rating: g.data?.rating ? g.data.rating.toFixed(1) : '',
        metacritic: g.data?.metacritic || '',
        year: g.data?.released ? g.data.released.slice(0, 4) : '',
        genres: (g.data?.genres || []).join(', '),
        status: STATUS_LABELS[g.status] || '',
        copies: g.copies && g.copies > 1 ? g.copies : '',
        cover: g.data?.cover || ''
      };
      if (includePaths) row.path = g.folderPath || '';
      return row;
    });
  }

  const CSV_COLUMNS = [
    ['title', 'Title'], ['folder', 'Library folder'], ['path', 'Path'], ['size', 'Size'], ['sizeBytes', 'Size (bytes)'],
    ['rating', 'Rating'], ['metacritic', 'Metacritic'], ['year', 'Year'], ['genres', 'Genres'],
    ['status', 'Status'], ['copies', 'Copies']
  ];

  function csvField(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }

  function toCsv(rows) {
    const includePaths = rows.length ? 'path' in rows[0] : false;
    const cols = CSV_COLUMNS.filter(([k]) => k !== 'path' || includePaths);
    const lines = [cols.map(([, label]) => csvField(label)).join(',')];
    rows.forEach(r => lines.push(cols.map(([k]) => csvField(r[k])).join(',')));
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  function toHtml(rows, { title = 'My Game Library' } = {}) {
    const includePaths = rows.length ? 'path' in rows[0] : false;
    const items = rows.map(r => `
      <div class="g">
        ${r.cover ? `<img src="${esc(r.cover)}" alt="" loading="lazy">` : '<div class="ph"></div>'}
        <div class="i">
          <div class="t">${esc(r.title)}</div>
          <div class="m">${[r.year, r.genres].filter(Boolean).map(esc).join(' · ')}</div>
          <div class="m">${[r.rating && `★ ${r.rating}`, r.metacritic && `MC ${r.metacritic}`, r.size, r.status, r.copies && `${r.copies} copies`].filter(Boolean).map(esc).join(' · ')}</div>
          <div class="f">${esc(r.folder)}${includePaths && r.path ? ` — ${esc(r.path)}` : ''}</div>
        </div>
      </div>`).join('');

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  body{margin:0;background:#0c1a22;color:#eaf6f4;font-family:Segoe UI,Inter,sans-serif}
  header{padding:24px 32px;border-bottom:1px solid #1f3d4e}
  h1{margin:0 0 4px;font-size:24px}
  .sub{color:#6f929e;font-size:13px}
  .list{padding:16px 32px;display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:12px}
  .g{display:flex;gap:12px;background:#112430;border:1px solid #1f3d4e;border-radius:8px;padding:10px}
  .g img,.ph{width:96px;height:54px;object-fit:cover;border-radius:4px;background:#1f3d4e;flex-shrink:0}
  .t{font-weight:600}
  .m{font-size:12px;color:#a9c5cc;margin-top:2px}
  .f{font-size:11px;color:#6f929e;margin-top:4px;word-break:break-all}
  footer{padding:16px 32px;color:#6f929e;font-size:12px}
  a{color:#92f5da}
</style></head>
<body>
<header><h1>${esc(title)}</h1><div class="sub">${rows.length} game${rows.length !== 1 ? 's' : ''}</div></header>
<div class="list">${items}</div>
<footer>Exported from Games Hoarder Viewer · Data from <a href="https://rawg.io">RAWG</a></footer>
</body></html>
`;
  }

  return { exportRows, toCsv, toHtml, STATUS_LABELS };
});
