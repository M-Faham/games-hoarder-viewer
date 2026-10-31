// ═══════════════════════════════════════
// Folders — add flow (multi-select + naming), Settings (folders / hidden / about), folder filter
// ═══════════════════════════════════════

const Folders = (() => {
  const $ = id => document.getElementById(id);
  const e = Render.escapeHtml;

  const ERRORS = {
    NAME_REQUIRED: 'Name is required',
    NAME_TOO_LONG: 'Max 30 characters',
    NAME_TAKEN: 'Name already used',
    PATH_EXISTS: 'Already included',
    NO_SUBFOLDERS: 'No games found here',
    UNREADABLE: "Can't read this folder"
  };

  let roots = [];
  const availability = new Map();   // root id → bool (from the last scan)
  const freeSpace = new Map();      // root id → bytes
  let stats = new Map();            // root id → { count, bytes, pending }
  let hiddenGames = [];
  let filterIds = [];
  let hideUnavailable = false;
  let cb = {};
  let nameRows = [];                // rows of the open "Name your folders" dialog

  function init(callbacks) {
    cb = callbacks;
    $('btnSettings').addEventListener('click', () => openSettings());
    $('btnSettingsClose').addEventListener('click', closeSettings);
    $('settingsOverlay').addEventListener('click', ev => { if (ev.target.id === 'settingsOverlay') closeSettings(); });
    $('btnAddFolders').addEventListener('click', startAddFlow);
    $('btnSaveIgnore').addEventListener('click', saveIgnore);
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Escape') return;
      if ($('nameFoldersOverlay').style.display !== 'none') closeNameDialog();
      else if ($('settingsOverlay').style.display !== 'none') closeSettings();
    });
    $('btnNameCancel').addEventListener('click', closeNameDialog);
    $('btnNameContinue').addEventListener('click', submitNames);
    $('chkUpdates').addEventListener('change', ev => window.electronAPI.setUpdateSettings({ enabled: ev.target.checked }));
  }

  // ── STATE ──
  function setRoots(newRoots, scans, games) {
    roots = newRoots;
    if (scans) scans.forEach(s => availability.set(s.id, s.available));
    filterIds = filterIds.filter(id => roots.some(r => r.id === id));
    refreshStats(games || []);
  }

  function isAvailable(id) { return availability.get(id) !== false; }
  function rootName(id) { return roots.find(r => r.id === id)?.name || ''; }
  function getRoots() { return roots; }
  function getFilter() { return filterIds; }
  function getHideUnavailable() { return hideUnavailable; }
  function setUpdateEnabled(v) { $('chkUpdates').checked = !!v; }

  function setFilter(ids, { persist = true } = {}) {
    filterIds = ids.filter(id => roots.some(r => r.id === id));
    renderTabs();
    if (persist) { window.electronAPI.setFolderFilter(filterIds); cb.onFilterChanged(); }
  }

  function setHideUnavailable(v, { persist = true } = {}) {
    hideUnavailable = !!v;
    renderTabs();
    if (persist) { window.electronAPI.setHideUnavailable(hideUnavailable); cb.onFilterChanged(); }
  }

  function refreshStats(games) {
    stats = new Map();
    roots.forEach(r => stats.set(r.id, { count: 0, bytes: 0, pending: 0 }));
    hiddenGames = [];
    games.forEach(g => {
      if (g.skipped) { hiddenGames.push(g); return; }
      const s = stats.get(g.rootId);
      if (!s) return;
      s.count++;
      if (g.size) s.bytes += g.size.bytes; else if (g.sizePending) s.pending++;
    });
    if ($('settingsOverlay').style.display !== 'none') { renderTable(); renderHidden(); }
    renderTabs();
  }

  // ── FOLDER TABS (side panel) ──
  // filterIds = the folders to show; [] means every folder is selected
  function selectedIds() { return filterIds.length ? filterIds : roots.map(r => r.id); }

  function applySelection(ids) {
    if (!ids.length) { renderTabs(); return; } // keep at least one folder selected
    setFilter(ids.length === roots.length ? [] : ids);
  }

  // How many other library folders contain this one
  function depthOf(root) {
    const p = Shared.normalizePath(root.path);
    const sep = String.fromCharCode(92); // backslash
    return roots.filter(o => o.id !== root.id && p.startsWith(Shared.normalizePath(o.path).replace(/[\\/]+$/, '') + sep)).length;
  }

  function renderTabs() {
    const el = $('folderTabs');
    if (!roots.length) { el.innerHTML = ''; return; }
    const selected = new Set(selectedIds());
    const sorted = roots.slice().sort((a, b) => Shared.normalizePath(a.path).localeCompare(Shared.normalizePath(b.path)));

    el.innerHTML = `
      <div class="tabs-head">
        <span class="tabs-title">Folders</span>
        <button class="btn-link" id="btnAllFolders" ${filterIds.length ? '' : 'disabled'}>All folders</button>
      </div>
      <label class="tabs-hide"><input type="checkbox" id="chkHideUnavailable" ${hideUnavailable ? 'checked' : ''} /> Hide unavailable</label>
      <div class="tabs-list">` + sorted.map(r => {
        const s = stats.get(r.id) || { count: 0, bytes: 0, pending: 0 };
        const avail = isAvailable(r.id);
        const size = s.bytes ? ' · ' + Shared.formatBytes(s.bytes) + (s.pending ? '+' : '') : '';
        return `<div class="folder-tab${selected.has(r.id) ? ' selected' : ''}${avail ? '' : ' is-unavailable'}" data-id="${e(r.id)}" style="margin-left:${depthOf(r) * 14}px">
          <input type="checkbox" ${selected.has(r.id) ? 'checked' : ''} title="Show or hide this folder" />
          <div class="tab-text" title="Show only this folder">
            <div class="tab-title">${e(r.name)}</div>
            <div class="tab-path" title="${e(r.path)}">${e(r.path)}</div>
            <div class="tab-meta">${s.count} game${s.count !== 1 ? 's' : ''}${e(size)}${avail ? '' : ' · <span class="status-unavailable">Unavailable</span>'}</div>
          </div>
        </div>`;
      }).join('') + '</div>';

    $('btnAllFolders').addEventListener('click', () => setFilter([]));
    $('chkHideUnavailable').addEventListener('change', ev => setHideUnavailable(ev.target.checked));
    el.querySelectorAll('.folder-tab').forEach(tab => {
      const id = tab.dataset.id;
      tab.querySelector('input').addEventListener('change', ev => {
        const next = new Set(selectedIds());
        if (ev.target.checked) next.add(id); else next.delete(id);
        applySelection([...next]);
      });
      tab.querySelector('.tab-text').addEventListener('click', () => applySelection([id]));
    });
  }

  function updateFilterLabel() { renderTabs(); }

  // ── IGNORE LIST ──
  function setIgnoreText(list) { $('ignoreText').value = (list || []).join('\n'); }

  async function saveIgnore() {
    const list = $('ignoreText').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    await window.electronAPI.setIgnoreList(list);
    $('ignoreMsg').textContent = 'Saved';
    setTimeout(() => { $('ignoreMsg').textContent = ''; }, 2000);
    cb.onIgnoreChanged();
  }

  // ── ADD FLOW ──
  async function startAddFlow() {
    const paths = await window.electronAPI.pickDirectories();
    if (!paths.length) return;

    nameRows = [];
    const seen = [];
    for (const p of paths) {
      if (seen.some(s => Shared.isSamePath(s, p))) continue;
      seen.push(p);
      if (roots.some(r => Shared.isSamePath(r.path, p))) { nameRows.push({ path: p, reason: ERRORS.PATH_EXISTS }); continue; }
      const res = await window.electronAPI.readFolders(p);
      if (res.error) nameRows.push({ path: p, reason: ERRORS.UNREADABLE });
      else if (res.length === 0) nameRows.push({ path: p, reason: ERRORS.NO_SUBFOLDERS });
      else nameRows.push({ path: p, entries: res });
    }

    // Pre-fill default names, each avoiding the ones already taken
    const taken = roots.map(r => r.name);
    nameRows.forEach(r => {
      if (!r.entries) return;
      r.name = Shared.defaultRootName(r.path, taken);
      taken.push(r.name);
    });
    renderNameDialog();
    $('nameFoldersOverlay').style.display = 'flex';
  }

  function renderNameDialog() {
    const list = $('nameFoldersList');
    list.innerHTML = nameRows.map((r, i) => r.entries ? `
      <div class="name-row" data-row="${i}">
        <div class="name-path" title="${e(r.path)}">${e(r.path)} <span class="muted-text">· ${r.entries.length} folder${r.entries.length !== 1 ? 's' : ''}</span></div>
        <input class="confirm-item-input name-input" type="text" value="${e(r.name)}" maxlength="60" />
        <div class="row-error"></div>
      </div>` : `
      <div class="name-row name-row-skipped">
        <div class="name-path" title="${e(r.path)}">${e(r.path)}</div>
        <div class="row-error show">${e(r.reason)} — not added</div>
      </div>`).join('');
    list.querySelectorAll('.name-row[data-row] .name-input').forEach(input => {
      input.addEventListener('input', () => {
        nameRows[+input.closest('.name-row').dataset.row].name = input.value;
        validateNames();
      });
      input.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !$('btnNameContinue').disabled) submitNames(); });
    });
    validateNames();
    list.querySelector('.name-input')?.focus();
  }

  // Returns true when every row has a valid name; shows inline errors
  function validateNames() {
    const okRows = nameRows.map((r, i) => ({ r, i })).filter(x => x.r.entries);
    let allValid = okRows.length > 0;
    okRows.forEach(({ r, i }) => {
      const others = [...roots.map(x => x.name), ...okRows.filter(o => o.i !== i).map(o => o.r.name)];
      const v = Shared.validateRootName(r.name, others);
      const el = $('nameFoldersList').querySelector(`.name-row[data-row="${i}"] .row-error`);
      el.textContent = v.ok ? '' : ERRORS[v.code];
      el.classList.toggle('show', !v.ok);
      if (!v.ok) allValid = false;
    });
    $('btnNameContinue').disabled = !allValid;
    $('nameFoldersCount').textContent = okRows.length
      ? `${okRows.length} folder${okRows.length !== 1 ? 's' : ''} to add`
      : 'Nothing to add';
    return allValid;
  }

  function closeNameDialog() {
    $('nameFoldersOverlay').style.display = 'none';
    nameRows = [];
  }

  async function submitNames() {
    if (!validateNames()) return;
    const okRows = nameRows.filter(r => r.entries);
    const res = await window.electronAPI.addRoots(okRows.map(r => ({ path: r.path, name: r.name.trim() })));
    if (res.error) {
      (res.details || []).forEach(d => {
        const row = okRows[d.index];
        const i = nameRows.indexOf(row);
        const el = $('nameFoldersList').querySelector(`.name-row[data-row="${i}"] .row-error`);
        if (el) { el.textContent = ERRORS[d.code] || res.error; el.classList.add('show'); }
      });
      return;
    }

    const newRoots = res.roots;
    roots = roots.concat(newRoots);
    newRoots.forEach(r => availability.set(r.id, true));

    // Entries that are themselves saved roots (or part of this batch) belong to those roots, not to this one
    const rootPaths = roots.map(r => r.path);
    const entriesByRootId = {};
    newRoots.forEach((root, k) => {
      entriesByRootId[root.id] = okRows[k].entries
        .filter(en => !rootPaths.some(p => Shared.isSamePath(p, en.path)))
        .map(en => ({ ...en, rootId: root.id }));
    });
    closeNameDialog();
    updateFilterLabel();
    cb.onRootsAdded(newRoots, entriesByRootId);
  }

  // ── SETTINGS ──
  async function openSettings(sectionId) {
    $('settingsOverlay').style.display = 'flex';
    await Onboarding.refreshSettings();
    renderTable();
    renderHidden();
    $('appVersion').textContent = 'Games Hoarder Viewer v' + (await window.electronAPI.getAppVersion());
    roots.forEach(async r => {
      const res = await window.electronAPI.getFreeSpace(r.path);
      if (res && res.free != null) { freeSpace.set(r.id, res.free); updateFreeCell(r.id); }
    });
    if (sectionId) $(sectionId)?.scrollIntoView({ block: 'start' });
  }

  function closeSettings() { $('settingsOverlay').style.display = 'none'; }

  function updateFreeCell(id) {
    const cell = $('foldersTable').querySelector(`[data-free="${CSS.escape(id)}"]`);
    if (cell) cell.textContent = freeSpace.has(id) ? Shared.formatBytes(freeSpace.get(id)) + ' free' : '—';
  }

  function renderTable() {
    const table = $('foldersTable');
    if (!roots.length) { table.innerHTML = '<tr><td class="muted-text">No library folders yet.</td></tr>'; return; }
    table.innerHTML = `<thead><tr><th>Name</th><th>Path</th><th>Games</th><th>Size</th><th>Drive</th><th>Status</th><th></th></tr></thead><tbody>` +
      roots.map(r => {
        const s = stats.get(r.id) || { count: 0, bytes: 0, pending: 0 };
        const avail = isAvailable(r.id);
        return `<tr data-id="${e(r.id)}">
          <td><input class="confirm-item-input root-name" value="${e(r.name)}" maxlength="60" /><div class="row-error"></div></td>
          <td class="cell-path" title="${e(r.path)}">${e(r.path)}</td>
          <td>${s.count}</td>
          <td>${e(Shared.formatBytes(s.bytes) || '—')}${s.pending ? ' +…' : ''}</td>
          <td data-free="${e(r.id)}">${freeSpace.has(r.id) ? e(Shared.formatBytes(freeSpace.get(r.id))) + ' free' : '—'}</td>
          <td><span class="${avail ? 'status-available' : 'status-unavailable'}">${avail ? 'Available' : 'Unavailable'}</span></td>
          <td class="cell-actions">
            <button class="btn-link" data-act="recalc" title="Work out the sizes again">Recalculate sizes</button>
            <button class="btn-link btn-link-danger" data-act="remove">Remove</button>
          </td>
        </tr>`;
      }).join('') + '</tbody>';

    table.querySelectorAll('tr[data-id]').forEach(tr => {
      const id = tr.dataset.id;
      const input = tr.querySelector('.root-name');
      const err = tr.querySelector('.row-error');
      input.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') input.blur();
        if (ev.key === 'Escape') { input.value = rootName(id); err.classList.remove('show'); ev.stopPropagation(); input.blur(); }
      });
      input.addEventListener('change', async () => {
        const res = await window.electronAPI.renameRoot(id, input.value);
        if (res.error) {
          err.textContent = ERRORS[res.code] || res.error;
          err.classList.add('show');
          input.value = rootName(id);
          return;
        }
        err.classList.remove('show');
        roots = roots.map(r => r.id === id ? res.root : r);
        input.value = res.root.name;
        updateFilterLabel();
        cb.onRootsChanged({ kind: 'rename', id });
      });
      tr.querySelector('[data-act="recalc"]').addEventListener('click', () => {
        window.electronAPI.startSizeScan({ rootId: id, force: true });
        cb.onRecalculate(id);
      });
      tr.querySelector('[data-act="remove"]').addEventListener('click', async () => {
        const name = rootName(id);
        const ok = await UI.confirm('Remove folder', `Remove '${name}'? Its games will leave the library. Cached game details are kept.`, 'Remove', true);
        if (!ok) return;
        await window.electronAPI.removeRoot(id);
        roots = roots.filter(r => r.id !== id);
        filterIds = filterIds.filter(x => x !== id);
        updateFilterLabel();
        cb.onRootsChanged({ kind: 'remove', id });
      });
    });
  }

  function renderHidden() {
    const el = $('hiddenList');
    if (!hiddenGames.length) { el.innerHTML = '<div class="muted-text">No hidden folders.</div>'; return; }
    el.innerHTML = hiddenGames.map((g, i) => `
      <div class="hidden-row">
        <div class="hidden-info">
          <div class="hidden-name">${e(g.folderName)}</div>
          <div class="muted-text cell-path" title="${e(g.folderPath)}">${e(rootName(g.rootId))} · ${e(g.folderPath)}</div>
        </div>
        <button class="btn-secondary" data-i="${i}">Restore</button>
      </div>`).join('');
    el.querySelectorAll('button[data-i]').forEach(btn => btn.addEventListener('click', async () => {
      const g = hiddenGames[+btn.dataset.i];
      await window.electronAPI.restoreGame(g.folderPath);
      cb.onRootsChanged({ kind: 'restore', path: g.folderPath });
    }));
  }

  return {
    init, setRoots, refreshStats, getRoots, rootName, isAvailable,
    getFilter, setFilter, getHideUnavailable, setHideUnavailable, setUpdateEnabled,
    startAddFlow, openSettings, closeSettings, setIgnoreText
  };
})();
