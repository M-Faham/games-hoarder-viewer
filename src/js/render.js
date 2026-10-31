// ═══════════════════════════════════════
// Render Module — Grid, List, Sidebar + Detail
// Every interpolated value goes through escapeHtml / cssUrl
// ═══════════════════════════════════════

const Render = (() => {

  const STATUS_LABELS = { backlog: 'Backlog', installed: 'Installed', played: 'Played', delete: 'Can delete' };

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  const e = escapeHtml;

  // For url('…') inside a style attribute
  function cssUrl(u) {
    return e(encodeURI(u || '').replace(/'/g, '%27'));
  }

  function ratingClass(r) {
    if (r >= 4) return 'high';
    if (r >= 3) return 'mid';
    return 'low';
  }

  function ratingDisplay(r) {
    if (!r) return '—';
    return r.toFixed(1);
  }

  function year(d) { return d?.released ? d.released.split('-')[0] : ''; }

  // Broken images are swapped for the placeholder by a document-level error listener in app.js
  function coverImg(src, cls) {
    if (src) {
      return `<img class="${cls} img-fallback" src="${e(src)}" alt="" loading="lazy" />
              <div class="${cls}-placeholder" style="display:none">${svgGame()}</div>`;
    }
    return `<div class="${cls}-placeholder">${svgGame()}</div>`;
  }

  function svgGame() {
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M8 12h2m1-1v2M18 10h.01M15 14h.01"/></svg>`;
  }

  function genreTags(genres) {
    return (genres || []).slice(0, 3).map(g =>
      `<span class="detail-tag">${e(g)}</span>`
    ).join('');
  }

  // ─── SMALL BADGES ───
  function folderBadge(game) {
    if (!game.rootName) return '';
    return `<span class="folder-badge" title="${e(game.folderPath)}">${e(game.rootName)}</span>`;
  }

  function unavailableBadge(game) {
    return game.unavailable ? `<span class="unavailable-badge" title="This library folder can't be reached">Unavailable</span>` : '';
  }

  function statusTag(game) {
    return game.status ? `<span class="status-tag status-${e(game.status)}">${e(STATUS_LABELS[game.status])}</span>` : '';
  }

  function copiesBadge(game) {
    return game.copies >= 2 ? `<span class="copies-badge" title="This game is in ${game.copies} folders">${game.copies} copies</span>` : '';
  }

  function sizeText(game) {
    if (game.size) return (game.size.approx ? '≈' : '') + Shared.formatBytes(game.size.bytes);
    return game.sizePending ? 'Calculating…' : '';
  }

  function sizeSpan(game) {
    const t = sizeText(game);
    return t ? `<span class="size-text${game.size ? '' : ' pending'}">${e(t)}</span>` : '';
  }

  function cardClasses(game) {
    return (game.unavailable ? ' is-unavailable' : '') + (game.selected ? ' is-selected' : '');
  }

  // Tag shown when there is no metadata for a game
  function missingTag(game) {
    if (game.fetchError === 'no_key') return `<span class="not-found-tag needs-key">Needs API key</span>`;
    if (game.fetchError === 'invalid') return `<span class="not-found-tag needs-key">API key rejected</span>`;
    if (game.fetchError === 'offline' || game.fetchError === 'rate_limited' || game.fetchError === 'error') {
      return `<span class="not-found-tag">Couldn't load – try again later</span>`;
    }
    return `<span class="not-found-tag">Not found</span>`;
  }

  function missingText(game) {
    if (game.fetchError === 'no_key') return 'Add a RAWG API key in Settings to load details';
    if (game.fetchError === 'invalid') return 'Your RAWG key was rejected – update it in Settings';
    if (game.fetchError === 'offline' || game.fetchError === 'rate_limited' || game.fetchError === 'error') {
      return "Couldn't load details right now – try again later";
    }
    return `No match found for '${e(game.searchName)}'`;
  }

  function attribution() {
    return `<div class="rawg-attrib-line"><a href="#" class="rawg-link rawg-attrib" data-url="https://rawg.io">Data from RAWG</a></div>`;
  }

  // ─── ACTION BAR (detail panel + modal) ───
  function actionsBar(game) {
    const off = game.unavailable ? ` disabled title="This library folder can't be reached"` : '';
    return `<div class="actions-bar" data-path="${e(game.folderPath)}">
      <button class="btn-action" data-action="explorer"${off}>Open in Explorer</button>
      <button class="btn-action" data-action="installer"${off}>Run installer</button>
      <button class="btn-action" data-action="copy"${off}>Copy path</button>
      <button class="btn-action" data-action="fixmatch">Fix match</button>
      <button class="btn-action" data-action="group"${off} title="This folder holds games: scan inside it">It has games in it…</button>
      <button class="btn-action" data-action="status">Set status ▾</button>
    </div>`;
  }

  // ─── COPIES (duplicates) ───
  function copiesSection(game) {
    if (!(game.copies >= 2) || !game.copyList) return '';
    const rows = game.copyList.map(c => `
      <div class="copy-row">
        <div class="copy-info">
          <div class="copy-folder">${e(c.rootName || '')}${c.unavailable ? ' · Unavailable' : ''}${c === game ? ' · this copy' : ''}</div>
          <div class="copy-path">${e(c.folderPath)}</div>
          <div class="copy-meta">${e(sizeText(c) || 'Size unknown')}${c.addedAt ? ' · added ' + e(new Date(c.addedAt).toLocaleDateString()) : ''}</div>
        </div>
        <button class="btn-action" data-action="explorer-copy" data-path="${e(c.folderPath)}"${c.unavailable ? ' disabled' : ''}>Open in Explorer</button>
      </div>`).join('');
    return `<div class="detail-section">
      <div class="detail-section-title">Copies (${game.copies})</div>
      ${rows}
    </div>`;
  }

  // ─── GRID CARD ───
  function gridCard(game, index) {
    const delay = (index % 30) * 0.03;
    const badges = `<div class="game-card-badges">${statusTag(game)}${copiesBadge(game)}</div>`;
    const folderLine = `<div class="game-card-folder">${folderBadge(game)}${unavailableBadge(game)}</div>`;

    if (!game.data) {
      return `<div class="game-card game-card-not-found${cardClasses(game)}" data-index="${index}" style="animation-delay:${delay}s">
        ${coverImg(null, 'game-card-cover')}
        ${badges}
        <div class="game-card-info">
          <div class="game-card-title" title="${e(game.searchName)}">${e(game.searchName)}</div>
          <div class="game-card-sub" title="${e(game.folderPath)}">Folder: ${e(game.folderName)}</div>
          <div class="game-card-meta">${missingTag(game)}${sizeSpan(game)}</div>
          <div class="card-actions">
            <button class="card-btn" data-act="fix">Fix match</button>
            <button class="card-btn" data-act="group" title="This folder is not a game, it holds games. Scan inside it.">Has games inside</button>
          </div>
          ${folderLine}
        </div>
      </div>`;
    }

    const d = game.data;
    const rc = ratingClass(d.rating);
    const sub = [d.developers ? d.developers.split(',')[0].trim() : '', year(d)].filter(Boolean).join(' · ');
    const desc = d.description ? d.description.slice(0, 170) + (d.description.length > 170 ? '…' : '') : '';
    const genres = (d.genres || []).slice(0, 2).map(g => `<span class="card-genre">${e(g)}</span>`).join('');
    return `<div class="game-card${cardClasses(game)}" data-index="${index}" style="animation-delay:${delay}s">
      <div class="game-card-coverwrap">
        ${coverImg(d.cover, 'game-card-cover')}
        ${desc ? `<div class="game-card-desc">${e(desc)}</div>` : ''}
      </div>
      ${badges}
      <div class="game-card-info">
        <div class="game-card-title" title="${e(d.name)}">${e(d.name)}</div>
        ${sub ? `<div class="game-card-sub" title="${e(sub)}">${e(sub)}</div>` : ''}
        <div class="game-card-meta">
          <span class="rating-badge ${rc}">★ ${ratingDisplay(d.rating)}</span>
          ${d.metacritic ? `<span class="list-meta-score" title="Metacritic">${e(d.metacritic)}</span>` : ''}
          ${sizeSpan(game)}
        </div>
        ${genres ? `<div class="card-genres">${genres}</div>` : ''}
        ${folderLine}
      </div>
    </div>`;
  }

  // ─── LIST ITEM ───
  function listItem(game, index) {
    const delay = (index % 50) * 0.02;
    const tags = `${folderBadge(game)}${unavailableBadge(game)}${statusTag(game)}${copiesBadge(game)}${sizeSpan(game)}`;
    if (!game.data) {
      return `<div class="list-item${cardClasses(game)}" data-index="${index}" style="animation-delay:${delay}s">
        <div class="list-thumb-placeholder">${svgGame()}</div>
        <div class="list-info">
          <div class="list-title">${e(game.searchName)}</div>
          <div class="list-sub">${missingTag(game)} ${tags}</div>
          ${game.folderPath ? `<div class="list-path">${e(game.folderPath)}</div>` : ''}
        </div>
        <div class="list-right"><span class="list-genre">—</span></div>
      </div>`;
    }
    const d = game.data;
    const rc = ratingClass(d.rating);
    const screenshotsHtml = d.screenshots?.length > 0
      ? `<div class="list-screenshots">
          ${d.screenshots.slice(0, 3).map(s => `<img class="list-screenshot img-fallback" src="${e(s)}" alt="" loading="lazy" />`).join('')}
        </div>`
      : '';
    const genres = (d.genres || []).slice(0, 3).map(g => `<span class="list-genre-tag">${e(g)}</span>`).join('');
    const desc = d.description ? d.description.slice(0, 200) + (d.description.length > 200 ? '…' : '') : '';

    return `<div class="list-item list-item-expanded${cardClasses(game)}" data-index="${index}" style="animation-delay:${delay}s">
      <div class="list-cover-col">
        ${coverImg(d.cover, 'list-thumb')}
      </div>
      <div class="list-main-col">
        <div class="list-header-row">
          <div class="list-title">${e(d.name)}</div>
          <div class="list-badges">
            <span class="rating-badge ${rc}">★ ${ratingDisplay(d.rating)}</span>
            ${d.metacritic ? `<span class="list-meta-score">${e(d.metacritic)}</span>` : ''}
          </div>
        </div>
        <div class="list-sub">${e(d.developers || 'Unknown Developer')} · ${e(year(d) || '—')} ${tags}</div>
        <div class="list-genre-row">${genres}</div>
        ${desc ? `<div class="list-desc">${e(desc)}</div>` : ''}
        ${game.folderPath ? `<div class="list-path">${e(game.folderPath)}</div>` : ''}
        ${screenshotsHtml}
      </div>
    </div>`;
  }

  // ─── SIDEBAR ITEM ───
  function sidebarItem(game, index) {
    const delay = (index % 50) * 0.015;
    const extra = `${statusTag(game)}${copiesBadge(game)}${unavailableBadge(game)}`;
    if (!game.data) {
      return `<div class="sidebar-item${cardClasses(game)}" data-index="${index}" style="animation-delay:${delay}s">
        <div class="sidebar-thumb-placeholder">?</div>
        <span class="sidebar-name" title="${e(game.searchName)}">${e(game.searchName)}</span>
        ${folderBadge(game)}${extra}
      </div>`;
    }
    const d = game.data;
    const imgPart = d.cover
      ? `<img class="sidebar-thumb img-fallback" src="${e(d.cover)}" alt="" loading="lazy" />
         <div class="sidebar-thumb-placeholder" style="display:none">${svgGame()}</div>`
      : `<div class="sidebar-thumb-placeholder">${svgGame()}</div>`;
    return `<div class="sidebar-item${cardClasses(game)}" data-index="${index}" style="animation-delay:${delay}s">
      ${imgPart}
      <span class="sidebar-text">
        <span class="sidebar-name" title="${e(d.name)}">${e(d.name)}</span>
        <span class="sidebar-sub">${e([year(d), sizeText(game)].filter(Boolean).join(' · '))}</span>
      </span>
      ${folderBadge(game)}${extra}
    </div>`;
  }

  // ─── DETAIL PANEL (sidebar view) ───
  function detailPanel(game) {
    if (!game.data) {
      return `<div class="empty-state detail-missing">
        ${svgGame()}
        <p>${missingText(game)}</p>
        <div class="detail-tags">${folderBadge(game)}${unavailableBadge(game)}${statusTag(game)}${sizeSpan(game)}</div>
        ${actionsBar(game)}
        ${game.folderPath ? `<p class="detail-path">${e(game.folderPath)}</p>` : ''}
      </div>`;
    }
    const d = game.data;
    const rc = ratingClass(d.rating);
    const metacriticColor = d.metacritic >= 75 ? 'var(--green)' : d.metacritic >= 50 ? 'var(--yellow)' : 'var(--red)';

    const screenshotsHtml = d.screenshots?.length > 0
      ? `<div class="detail-section">
          <div class="detail-section-title">Screenshots</div>
          <div class="screenshots-grid">
            ${d.screenshots.slice(0,3).map(s => `<img class="screenshot-img img-fallback" src="${e(s)}" alt="" loading="lazy" />`).join('')}
          </div>
        </div>`
      : '';

    return `
      <div class="detail-hero">
        <div class="detail-hero-bg" style="background-image:url('${cssUrl(d.cover)}')"></div>
        <div class="detail-hero-content">
          ${d.cover
            ? `<img class="detail-cover" src="${e(d.cover)}" alt="" />`
            : `<div class="detail-cover-placeholder">${svgGame()}</div>`}
          <div class="detail-titles">
            <div class="detail-title">${e(d.name)}</div>
            <div class="detail-developer">${e(d.developers || 'Unknown Developer')}</div>
            <div class="detail-tags">${genreTags(d.genres)}${folderBadge(game)}${unavailableBadge(game)}${statusTag(game)}${copiesBadge(game)}</div>
          </div>
        </div>
      </div>

      ${actionsBar(game)}

      <div class="detail-stats">
        <div class="stat-box">
          <div class="stat-value" style="color:var(--${rc === 'high' ? 'green' : rc === 'mid' ? 'yellow' : 'red'})">
            ${ratingDisplay(d.rating)}<span style="font-size:14px;color:var(--text-2)">/5</span>
          </div>
          <div class="stat-label">RAWG Rating</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:${d.metacritic ? metacriticColor : 'var(--muted)'}">
            ${e(d.metacritic || '—')}
          </div>
          <div class="stat-label">Metacritic</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="font-size:18px">${e(sizeText(game) || year(d) || '—')}</div>
          <div class="stat-label">${game.size || game.sizePending ? 'Size' : 'Released'}</div>
        </div>
      </div>

      ${copiesSection(game)}

      ${screenshotsHtml}

      ${d.description ? `
      <div class="detail-section">
        <div class="detail-section-title">About</div>
        <div class="detail-description">${e(d.description.slice(0, 400))}${d.description.length > 400 ? '…' : ''}</div>
      </div>` : ''}

      <div class="detail-section">
        <div class="detail-section-title">Details</div>
        ${infoRow('Developer', d.developers)}
        ${infoRow('Publisher', d.publishers)}
        ${infoRow('Platforms', (d.platforms || []).join(', '))}
        ${infoRow('Released', d.released)}
        ${infoRow('Rating Count', d.ratingsCount?.toLocaleString())}
        ${game.folderPath ? infoRow('Location', game.folderPath) : ''}
        ${d.rawgUrl ? `<div style="margin-top:12px">
          <a href="#" class="rawg-link" data-url="${e(d.rawgUrl)}" style="color:var(--accent);font-size:12px;text-decoration:none">
            View on RAWG →
          </a>
        </div>` : ''}
      </div>
      ${attribution()}
    `;
  }

  function infoRow(label, value) {
    if (!value) return '';
    return `<div style="display:flex;gap:12px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
      <span style="color:var(--text-2);min-width:100px;flex-shrink:0">${e(label)}</span>
      <span style="color:var(--text-1);user-select:text">${e(value)}</span>
    </div>`;
  }

  // ─── MODAL ───
  function modal(game) {
    if (!game.data) {
      return {
        hero: '',
        body: `<div style="padding:32px;text-align:center;color:var(--text-2)">
          <p style="font-size:18px;margin-bottom:8px">Game not found</p>
          <p>${missingText(game)}</p>
          <div class="modal-tags" style="justify-content:center;margin-top:12px">${folderBadge(game)}${unavailableBadge(game)}${statusTag(game)}${sizeSpan(game)}</div>
          ${actionsBar(game)}
          ${game.folderPath ? `<p class="detail-path">${e(game.folderPath)}</p>` : ''}
        </div>`
      };
    }
    const d = game.data;
    const rc = ratingClass(d.rating);
    const metacriticColor = d.metacritic >= 75 ? 'var(--green)' : d.metacritic >= 50 ? 'var(--yellow)' : 'var(--red)';

    const heroSrc = d.screenshots?.[0] || d.cover;
    const heroHtml = heroSrc
      ? `<img class="modal-hero-img" src="${e(heroSrc)}" alt="" />
         <div class="modal-hero-overlay"></div>`
      : '';

    const screenshotsHtml = d.screenshots?.length > 0
      ? `<div class="detail-section">
          <div class="detail-section-title">Screenshots</div>
          <div class="screenshots-grid">
            ${d.screenshots.slice(0,6).map(s => `<img class="screenshot-img img-fallback" src="${e(s)}" alt="" loading="lazy" />`).join('')}
          </div>
        </div>`
      : '';

    const links = [
      d.website ? `<a href="#" class="rawg-link" data-url="${e(d.website)}" style="color:var(--accent);font-size:12px;text-decoration:none;margin-right:16px">Official Website →</a>` : '',
      d.rawgUrl ? `<a href="#" class="rawg-link" data-url="${e(d.rawgUrl)}" style="color:${d.website ? 'var(--text-2)' : 'var(--accent)'};font-size:12px;text-decoration:none">View on RAWG →</a>` : ''
    ].join('');

    const bodyHtml = `
      <div class="modal-header">
        ${d.cover
          ? `<img class="modal-cover" src="${e(d.cover)}" alt="" />`
          : `<div class="modal-cover-placeholder">${svgGame()}</div>`}
        <div class="modal-titles">
          <div class="modal-game-title">${e(d.name)}</div>
          <div class="modal-dev">${e(d.developers || 'Unknown Developer')}${d.released ? ' · ' + e(year(d)) : ''}</div>
          <div class="modal-tags">${genreTags(d.genres)}${folderBadge(game)}${unavailableBadge(game)}${statusTag(game)}${copiesBadge(game)}</div>
        </div>
      </div>

      ${actionsBar(game)}

      <div class="detail-stats">
        <div class="stat-box">
          <div class="stat-value" style="color:var(--${rc === 'high' ? 'green' : rc === 'mid' ? 'yellow' : 'red'})">
            ${ratingDisplay(d.rating)}<span style="font-size:14px;color:var(--text-2)">/5</span>
          </div>
          <div class="stat-label">RAWG Rating</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:${d.metacritic ? metacriticColor : 'var(--muted)'}">
            ${e(d.metacritic || '—')}
          </div>
          <div class="stat-label">Metacritic</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${e(sizeText(game) || d.ratingsCount?.toLocaleString() || '—')}</div>
          <div class="stat-label">${game.size || game.sizePending ? 'Size' : 'Ratings'}</div>
        </div>
      </div>

      ${copiesSection(game)}

      ${d.description ? `
      <div class="detail-section">
        <div class="detail-section-title">About</div>
        <div class="detail-description">${e(d.description)}</div>
      </div>` : ''}

      ${screenshotsHtml}

      <div class="detail-section">
        <div class="detail-section-title">Details</div>
        ${infoRow('Developer', d.developers)}
        ${infoRow('Publisher', d.publishers)}
        ${infoRow('Platforms', (d.platforms || []).join(', '))}
        ${infoRow('Released', d.released)}
        ${game.folderPath ? infoRow('Location', game.folderPath) : ''}
        ${links ? `<div style="margin-top:12px">${links}</div>` : ''}
      </div>
      ${attribution()}
    `;

    return { hero: heroHtml, body: bodyHtml };
  }

  return {
    escapeHtml, cssUrl, gridCard, listItem, sidebarItem, detailPanel, modal,
    folderBadge, sizeText, attribution, svgGame, STATUS_LABELS
  };
})();
