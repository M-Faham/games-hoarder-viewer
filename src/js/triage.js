// ═══════════════════════════════════════
// Triage — sort / filter toolbar, "X of Y" count, Pick for me, Export
// ═══════════════════════════════════════

const Triage = (() => {
  const $ = id => document.getElementById(id);
  const e = Render.escapeHtml;

  let view = Shared.withDefaultView({});
  let cb = {};
  let genreSource = [];

  const STATUS_OPTIONS = [
    ['none', 'No status'], ['backlog', 'Backlog'], ['installed', 'Installed'], ['played', 'Played'], ['delete', 'Can delete']
  ];

  // callbacks: getList() → current filtered list, getGames() → all games, onChange(), onClearExtras(), onOpenGame(game)
  function init(callbacks) {
    cb = callbacks;
    $('sortField').addEventListener('change', ev => { view.sort.field = ev.target.value; changed(); });
    $('btnSortDir').addEventListener('click', () => { view.sort.dir = view.sort.dir === 'asc' ? 'desc' : 'asc'; changed(); });
    $('btnFilters').addEventListener('click', ev => { ev.stopPropagation(); toggleFilterPanel(); });
    $('filterPanel').addEventListener('click', ev => ev.stopPropagation());
    document.addEventListener('click', () => { $('filterPanel').style.display = 'none'; });
    $('btnClearFilters').addEventListener('click', clearFilters);
    $('btnPickForMe').addEventListener('click', pickForMe);
    $('btnExport').addEventListener('click', exportLibrary);
    syncControls();
  }

  function getView() { return view; }

  function setView(v, { persist = true } = {}) {
    view = Shared.withDefaultView(v);
    syncControls();
    if (persist) window.electronAPI.setViewSettings(view);
  }

  function changed() {
    syncControls();
    window.electronAPI.setViewSettings(view);
    cb.onChange();
  }

  function syncControls() {
    $('sortField').value = view.sort.field;
    $('btnSortDir').textContent = view.sort.dir === 'asc' ? '↑ Asc' : '↓ Desc';
    const n = activeFilterCount();
    $('btnFilters').textContent = n ? `Filters (${n}) ▾` : 'Filters ▾';
    $('btnFilters').classList.toggle('active', n > 0);
  }

  function activeFilterCount() {
    return (view.genres.length ? 1 : 0) + (view.yearMin != null || view.yearMax != null ? 1 : 0) +
      (view.ratingMin != null ? 1 : 0) + (view.match !== 'all' ? 1 : 0) +
      (view.statuses.length ? 1 : 0) + (view.duplicatesOnly ? 1 : 0);
  }

  // shown/total, bytes of the shown games, and whether any filter (incl. search / folder filter) is active
  function updateCount(shown, total, bytes, filtered) {
    const size = bytes ? ` · ${Shared.formatBytes(bytes)}` : '';
    $('toolbarCount').textContent = filtered ? `${shown} of ${total} games${size}` : `${total} game${total !== 1 ? 's' : ''}${size}`;
    $('btnClearFilters').style.display = filtered ? '' : 'none';
  }

  function clearFilters() {
    view = Shared.withDefaultView({ sort: view.sort });
    syncControls();
    window.electronAPI.setViewSettings(view);
    cb.onClearExtras(); // folder filter + search text
    cb.onChange();
  }

  // ── FILTER PANEL ──
  function toggleFilterPanel() {
    const panel = $('filterPanel');
    if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
    genreSource = Shared.allGenres(cb.getGames());
    renderFilterPanel();
    panel.style.display = 'block';
  }

  function renderFilterPanel() {
    const panel = $('filterPanel');
    const genres = genreSource.length
      ? genreSource.map(g => `<label class="chip-check"><input type="checkbox" data-genre="${e(g)}" ${view.genres.includes(g) ? 'checked' : ''}/><span>${e(g)}</span></label>`).join('')
      : '<span class="muted-text">No genres yet</span>';
    const statuses = STATUS_OPTIONS.map(([k, label]) =>
      `<label class="chip-check"><input type="checkbox" data-status="${k}" ${view.statuses.includes(k) ? 'checked' : ''}/><span>${label}</span></label>`).join('');
    const ratingOpts = [['', 'Any'], ['3', '3+'], ['3.5', '3.5+'], ['4', '4+'], ['4.5', '4.5+']]
      .map(([v, l]) => `<option value="${v}" ${String(view.ratingMin ?? '') === v ? 'selected' : ''}>${l}</option>`).join('');
    const matchOpts = [['all', 'All games'], ['matched', 'Matched only'], ['unmatched', 'Not matched only']]
      .map(([v, l]) => `<option value="${v}" ${view.match === v ? 'selected' : ''}>${l}</option>`).join('');

    panel.innerHTML = `
      <div class="filter-group"><div class="filter-title">Genres</div><div class="chip-grid">${genres}</div></div>
      <div class="filter-group filter-row">
        <label>Year from <input type="number" id="fltYearMin" class="mini-input" min="1970" max="2100" value="${view.yearMin ?? ''}" /></label>
        <label>to <input type="number" id="fltYearMax" class="mini-input" min="1970" max="2100" value="${view.yearMax ?? ''}" /></label>
        <label>Min rating <select id="fltRating" class="toolbar-select">${ratingOpts}</select></label>
      </div>
      <div class="filter-group filter-row">
        <label>Show <select id="fltMatch" class="toolbar-select">${matchOpts}</select></label>
        <label class="chip-check"><input type="checkbox" id="fltDupes" ${view.duplicatesOnly ? 'checked' : ''}/><span>Duplicates only</span></label>
      </div>
      <div class="filter-group"><div class="filter-title">Status</div><div class="chip-grid">${statuses}</div></div>`;

    const read = () => {
      view.genres = [...panel.querySelectorAll('[data-genre]:checked')].map(i => i.dataset.genre);
      view.statuses = [...panel.querySelectorAll('[data-status]:checked')].map(i => i.dataset.status);
      const num = id => { const v = parseFloat($(id).value); return isNaN(v) ? null : v; };
      view.yearMin = num('fltYearMin');
      view.yearMax = num('fltYearMax');
      view.ratingMin = num('fltRating');
      view.match = $('fltMatch').value;
      view.duplicatesOnly = $('fltDupes').checked;
      changed();
    };
    panel.querySelectorAll('input, select').forEach(el => el.addEventListener('change', read));
  }

  // ── PICK FOR ME ──
  async function pickForMe() {
    const list = cb.getList();
    let lastKey = null;
    for (;;) {
      const game = Shared.pickGame(list, Math.random, lastKey);
      if (!game) {
        await UI.dialog({
          title: 'Nothing to pick',
          html: '<p class="dialog-text">There are no games to pick from. Picks come from your Backlog games, or from matched games that are not marked Played or Can delete, within the current filters.</p>',
          buttons: [{ label: 'OK', value: true, primary: true }]
        });
        return;
      }
      lastKey = game.folderPath;
      const d = game.data;
      const canReroll = Shared.pickPool(list).pool.length > 1;
      const result = await UI.dialog({
        title: 'How about this one?',
        html: `<div class="pick-card">
          ${d?.cover ? `<img class="pick-cover" src="${e(d.cover)}" alt="" />` : ''}
          <div>
            <div class="pick-title">${e(d?.name || game.searchName)}</div>
            <div class="muted-text">${e([d?.released?.slice(0, 4), (d?.genres || []).slice(0, 3).join(', ')].filter(Boolean).join(' · '))}</div>
            <div class="pick-meta">${d?.rating ? `★ ${d.rating.toFixed(1)}` : ''} ${Render.folderBadge(game)}</div>
          </div>
        </div>`,
        buttons: [
          { label: 'Close', value: 'close' },
          { label: 'Reroll', value: 'reroll', disabled: !canReroll, title: canReroll ? '' : 'No other games match' },
          { label: 'Open', value: 'open', primary: true }
        ]
      });
      if (result === 'reroll') continue;
      if (result === 'open') cb.onOpenGame(game);
      return;
    }
  }

  // ── EXPORT ──
  async function exportLibrary() {
    const list = cb.getList();
    if (!list.length) { UI.toast('Nothing to export'); return; }
    const prefs = (await window.electronAPI.getLibrary()).ui.exportPaths || { csv: true, html: false };

    const choice = await UI.dialog({
      title: `Export ${list.length} game${list.length !== 1 ? 's' : ''}`,
      html: `<p class="dialog-text">Exports the games currently shown, in the current order.</p>
        <label class="checkbox-row"><input type="radio" name="expFormat" value="csv" checked /> Spreadsheet (CSV)</label>
        <label class="checkbox-row"><input type="radio" name="expFormat" value="html" /> Web page (HTML)</label>
        <label class="checkbox-row"><input type="checkbox" id="expPaths" /> Include folder paths</label>`,
      onRender: body => {
        const sync = () => { body.querySelector('#expPaths').checked = !!prefs[body.querySelector('input[name=expFormat]:checked').value]; };
        body.querySelectorAll('input[name=expFormat]').forEach(r => r.addEventListener('change', sync));
        sync();
      },
      buttons: [
        { label: 'Cancel', value: null },
        { label: 'Export', primary: true, onClick: () => {
          const body = $('dialogBody');
          UI.closeDialog({
            format: body.querySelector('input[name=expFormat]:checked').value,
            includePaths: body.querySelector('#expPaths').checked
          });
        } }
      ]
    });
    if (!choice) return;

    prefs[choice.format] = choice.includePaths;
    window.electronAPI.setExportPaths(prefs);

    const rows = Shared.exportRows(list, { includePaths: choice.includePaths });
    const content = choice.format === 'csv' ? Shared.toCsv(rows) : Shared.toHtml(rows, { title: 'My Game Library' });
    const res = await window.electronAPI.saveExport({
      format: choice.format,
      content,
      defaultName: choice.format === 'csv' ? 'game-library.csv' : 'game-library.html'
    });
    if (res.canceled) return;
    if (res.error) { UI.toast('Export failed: ' + res.error); return; }

    const next = await UI.dialog({
      title: 'Export finished',
      html: `<p class="dialog-text">Saved ${list.length} game${list.length !== 1 ? 's' : ''} to<br><span class="mono">${e(res.path)}</span></p>`,
      buttons: [
        { label: 'Close', value: null },
        { label: 'Show in folder', value: 'show' },
        { label: 'Open file', value: 'open', primary: true }
      ]
    });
    if (next === 'open') window.electronAPI.openPath(res.path);
    if (next === 'show') window.electronAPI.showInFolder(res.path);
  }

  return { init, getView, setView, updateCount, syncControls };
})();
