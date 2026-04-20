// ═══════════════════════════════════════
// Render Module — Grid, List, Sidebar + Detail
// ═══════════════════════════════════════

const Render = (() => {

  function ratingClass(r) {
    if (r >= 4) return 'high';
    if (r >= 3) return 'mid';
    return 'low';
  }

  function ratingDisplay(r) {
    if (!r) return '—';
    return r.toFixed(1);
  }

  function coverImg(src, cls, fallbackSize = 'medium') {
    if (src) {
      return `<img class="${cls}" src="${src}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
              <div class="${cls}-placeholder" style="display:none">${svgGame()}</div>`;
    }
    return `<div class="${cls}-placeholder">${svgGame()}</div>`;
  }

  function svgGame() {
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M8 12h2m1-1v2M18 10h.01M15 14h.01"/></svg>`;
  }

  function genreTags(genres) {
    return (genres || []).slice(0, 3).map(g =>
      `<span class="detail-tag">${g}</span>`
    ).join('');
  }

  // ─── GRID CARD ───
  function gridCard(game, index) {
    const delay = (index % 30) * 0.03;
    if (!game.data) {
      return `<div class="game-card game-card-not-found" data-index="${index}" style="animation-delay:${delay}s">
        ${coverImg(null, 'game-card-cover')}
        <div class="game-card-info">
          <div class="game-card-title">${game.searchName}</div>
          <div class="game-card-meta"><span class="not-found-tag">Not found</span></div>
        </div>
      </div>`;
    }
    const d = game.data;
    const rc = ratingClass(d.rating);
    return `<div class="game-card" data-index="${index}" style="animation-delay:${delay}s">
      ${coverImg(d.cover, 'game-card-cover')}
      <div class="game-card-info">
        <div class="game-card-title" title="${d.name}">${d.name}</div>
        <div class="game-card-meta">
          <span class="rating-badge ${rc}">★ ${ratingDisplay(d.rating)}</span>
          <span>${d.released ? d.released.split('-')[0] : ''}</span>
        </div>
      </div>
    </div>`;
  }

  // ─── LIST ITEM ───
  function listItem(game, index) {
    const delay = (index % 50) * 0.02;
    if (!game.data) {
      return `<div class="list-item" data-index="${index}" style="animation-delay:${delay}s">
        <div class="list-thumb-placeholder">${svgGame()}</div>
        <div class="list-info">
          <div class="list-title">${game.searchName}</div>
          <div class="list-sub"><span class="not-found-tag">Not found</span></div>
        </div>
        <div class="list-right"><span class="list-genre">—</span></div>
      </div>`;
    }
    const d = game.data;
    const rc = ratingClass(d.rating);
    return `<div class="list-item" data-index="${index}" style="animation-delay:${delay}s">
      ${coverImg(d.cover, 'list-thumb')}
      <div class="list-info">
        <div class="list-title">${d.name}</div>
        <div class="list-sub">${d.developers || 'Unknown Developer'} · ${d.released ? d.released.split('-')[0] : '—'}</div>
      </div>
      <div class="list-right">
        <span class="rating-badge ${rc}">★ ${ratingDisplay(d.rating)}</span>
        <span class="list-genre">${d.genres?.[0] || '—'}</span>
      </div>
    </div>`;
  }

  // ─── SIDEBAR ITEM ───
  function sidebarItem(game, index) {
    const delay = (index % 50) * 0.015;
    if (!game.data) {
      return `<div class="sidebar-item" data-index="${index}" style="animation-delay:${delay}s">
        <div class="sidebar-thumb-placeholder">?</div>
        <span class="sidebar-name" title="${game.searchName}">${game.searchName}</span>
      </div>`;
    }
    const d = game.data;
    const imgPart = d.cover
      ? `<img class="sidebar-thumb" src="${d.cover}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
         <div class="sidebar-thumb-placeholder" style="display:none">${svgGame()}</div>`
      : `<div class="sidebar-thumb-placeholder">${svgGame()}</div>`;
    return `<div class="sidebar-item" data-index="${index}" style="animation-delay:${delay}s">
      ${imgPart}
      <span class="sidebar-name" title="${d.name}">${d.name}</span>
    </div>`;
  }

  // ─── DETAIL PANEL (sidebar view) ───
  function detailPanel(game) {
    if (!game.data) {
      return `<div class="empty-state">
        ${svgGame()}
        <p>No data found for "<strong>${game.searchName}</strong>"</p>
        <p style="font-size:12px;color:var(--text-2)">Try editing the folder name and rescanning</p>
      </div>`;
    }
    const d = game.data;
    const rc = ratingClass(d.rating);
    const metacriticColor = d.metacritic >= 75 ? 'var(--green)' : d.metacritic >= 50 ? 'var(--yellow)' : 'var(--red)';

    const screenshotsHtml = d.screenshots?.length > 0
      ? `<div class="detail-section">
          <div class="detail-section-title">Screenshots</div>
          <div class="screenshots-grid">
            ${d.screenshots.slice(0,3).map(s => `<img class="screenshot-img" src="${s}" alt="" loading="lazy" />`).join('')}
          </div>
        </div>`
      : '';

    return `
      <div class="detail-hero">
        <div class="detail-hero-bg" style="background-image:url('${d.cover || ''}')"></div>
        <div class="detail-hero-content">
          ${d.cover
            ? `<img class="detail-cover" src="${d.cover}" alt="" />`
            : `<div class="detail-cover-placeholder">${svgGame()}</div>`}
          <div class="detail-titles">
            <div class="detail-title">${d.name}</div>
            <div class="detail-developer">${d.developers || 'Unknown Developer'}</div>
            <div class="detail-tags">${genreTags(d.genres)}</div>
          </div>
        </div>
      </div>

      <div class="detail-stats">
        <div class="stat-box">
          <div class="stat-value" style="color:var(--${rc === 'high' ? 'green' : rc === 'mid' ? 'yellow' : 'red'})">
            ${ratingDisplay(d.rating)}<span style="font-size:14px;color:var(--text-2)">/5</span>
          </div>
          <div class="stat-label">RAWG Rating</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:${d.metacritic ? metacriticColor : 'var(--muted)'}">
            ${d.metacritic || '—'}
          </div>
          <div class="stat-label">Metacritic</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="font-size:18px">${d.released ? d.released.split('-')[0] : '—'}</div>
          <div class="stat-label">Released</div>
        </div>
      </div>

      ${screenshotsHtml}

      ${d.description ? `
      <div class="detail-section">
        <div class="detail-section-title">About</div>
        <div class="detail-description">${d.description.slice(0, 400)}${d.description.length > 400 ? '…' : ''}</div>
      </div>` : ''}

      <div class="detail-section">
        <div class="detail-section-title">Details</div>
        ${infoRow('Developer', d.developers)}
        ${infoRow('Publisher', d.publishers)}
        ${infoRow('Platforms', (d.platforms || []).join(', '))}
        ${infoRow('Rating Count', d.ratingsCount?.toLocaleString())}
        ${d.rawgUrl ? `<div style="margin-top:12px">
          <a href="#" class="rawg-link" data-url="${d.rawgUrl}" style="color:var(--accent);font-size:12px;text-decoration:none">
            View on RAWG →
          </a>
        </div>` : ''}
      </div>
    `;
  }

  function infoRow(label, value) {
    if (!value) return '';
    return `<div style="display:flex;gap:12px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
      <span style="color:var(--text-2);min-width:100px;flex-shrink:0">${label}</span>
      <span style="color:var(--text-1)">${value}</span>
    </div>`;
  }

  // ─── MODAL ───
  function modal(game) {
    if (!game.data) {
      return {
        hero: '',
        body: `<div style="padding:32px;text-align:center;color:var(--text-2)">
          <p style="font-size:18px;margin-bottom:8px">Game not found</p>
          <p>No data could be found for "<strong>${game.searchName}</strong>"</p>
        </div>`
      };
    }
    const d = game.data;
    const rc = ratingClass(d.rating);
    const metacriticColor = d.metacritic >= 75 ? 'var(--green)' : d.metacritic >= 50 ? 'var(--yellow)' : 'var(--red)';

    const heroHtml = d.screenshots?.[0] || d.cover
      ? `<img class="modal-hero-img" src="${d.screenshots?.[0] || d.cover}" alt="" />
         <div class="modal-hero-overlay"></div>`
      : '';

    const screenshotsHtml = d.screenshots?.length > 0
      ? `<div class="detail-section">
          <div class="detail-section-title">Screenshots</div>
          <div class="screenshots-grid">
            ${d.screenshots.slice(0,6).map(s => `<img class="screenshot-img" src="${s}" alt="" loading="lazy" />`).join('')}
          </div>
        </div>`
      : '';

    const bodyHtml = `
      <div class="modal-header">
        ${d.cover
          ? `<img class="modal-cover" src="${d.cover}" alt="" />`
          : `<div class="modal-cover-placeholder">${svgGame()}</div>`}
        <div class="modal-titles">
          <div class="modal-game-title">${d.name}</div>
          <div class="modal-dev">${d.developers || 'Unknown Developer'}${d.released ? ' · ' + d.released.split('-')[0] : ''}</div>
          <div class="modal-tags">${genreTags(d.genres)}</div>
        </div>
      </div>

      <div class="detail-stats">
        <div class="stat-box">
          <div class="stat-value" style="color:var(--${rc === 'high' ? 'green' : rc === 'mid' ? 'yellow' : 'red'})">
            ${ratingDisplay(d.rating)}<span style="font-size:14px;color:var(--text-2)">/5</span>
          </div>
          <div class="stat-label">RAWG Rating</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:${d.metacritic ? metacriticColor : 'var(--muted)'}">
            ${d.metacritic || '—'}
          </div>
          <div class="stat-label">Metacritic</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${d.ratingsCount?.toLocaleString() || '—'}</div>
          <div class="stat-label">Ratings</div>
        </div>
      </div>

      ${d.description ? `
      <div class="detail-section">
        <div class="detail-section-title">About</div>
        <div class="detail-description">${d.description}</div>
      </div>` : ''}

      ${screenshotsHtml}

      <div class="detail-section">
        <div class="detail-section-title">Details</div>
        ${infoRow('Developer', d.developers)}
        ${infoRow('Publisher', d.publishers)}
        ${infoRow('Platforms', (d.platforms || []).join(', '))}
        ${infoRow('Released', d.released)}
        ${d.website ? `<div style="margin-top:12px">
          <a href="#" class="rawg-link" data-url="${d.website}" style="color:var(--accent);font-size:12px;text-decoration:none;margin-right:16px">
            Official Website →
          </a>
          ${d.rawgUrl ? `<a href="#" class="rawg-link" data-url="${d.rawgUrl}" style="color:var(--text-2);font-size:12px;text-decoration:none">
            View on RAWG →
          </a>` : ''}
        </div>` : d.rawgUrl ? `<div style="margin-top:12px">
          <a href="#" class="rawg-link" data-url="${d.rawgUrl}" style="color:var(--accent);font-size:12px;text-decoration:none">
            View on RAWG →
          </a>
        </div>` : ''}
      </div>
    `;

    return { hero: heroHtml, body: bodyHtml };
  }

  return { gridCard, listItem, sidebarItem, detailPanel, modal };
})();
