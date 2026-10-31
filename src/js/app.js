// ═══════════════════════════════════════
// Games Hoarder Viewer — Main App
// Startup routing, library loading, rendering, selection, wiring of the other modules
// ═══════════════════════════════════════

const App = (() => {
  const e = Render.escapeHtml;

  // State
  let games = [];          // runtime game objects (see data-model.md)
  let pendingFolders = []; // [{name, path, cleaned, rootId, skipped}] waiting on the confirm screen
  let pendingNewRootIds = new Set(); // roots added in this flow; removed again if the confirm screen is cancelled
  let currentList = [];    // what is on screen, in order (data-index refers to this)
  let currentView = 'grid';
  let sidebarActive = -1;
  let searchQuery = '';
  let lastSelectedIndex = -1;
  let renderTimer = null;
  let libraryShown = false;
  let pendingUpdate = null;

  // DOM refs
  const $ = id => document.getElementById(id);
  const confirmOverlay   = $('confirmOverlay');
  const confirmList      = $('confirmList');
  const confirmCount     = $('confirmCount');
  const loadingScreen    = $('loadingScreen');
  const loadingText      = $('loadingText');
  const loadingBar       = $('loadingBar');
  const loadingSub       = $('loadingSub');
  const searchWrap       = $('searchWrap');
  const searchInput      = $('searchInput');
  const viewToggle       = $('viewToggle');
  const viewGrid         = $('viewGrid');
  const viewList         = $('viewList');
  const viewSidebar      = $('viewSidebar');
  const gameGrid         = $('gameGrid');
  const gameList         = $('gameList');
  const sidebarInner     = $('sidebarInner');
  const detailPanel      = $('detailPanel');
  const gameModalOverlay = $('gameModalOverlay');
  const gameModal        = $('gameModal');
  const modalHero        = $('modalHero');
  const modalBody        = $('modalBody');
  const modalClose       = $('modalClose');

  // ── INIT ──
  async function init() {
    UI.init();

    Onboarding.init({ onDone: loadLibrary });
    Onboarding.initSettings({
      onKeyRemoved: () => { Folders.closeSettings(); hideLibraryUI(); Onboarding.show(); },
      onKeySaved: onKeySaved
    });
    Folders.init({
      onRootsAdded, onRootsChanged, onFilterChanged: renderCurrentView, onRecalculate,
      onIgnoreChanged: () => loadLibrary()
    });
    Triage.init({
      getList: () => currentList,
      getGames: () => games,
      onChange: renderCurrentView,
      onClearExtras: () => { Folders.setFilter([]); searchInput.value = ''; searchQuery = ''; },
      onOpenGame: openModal
    });
    FixMatch.init({ onChanged: onMatchChanged, onOpenSettings: () => Folders.openSettings('settingsKey'), onScanInside: g => makeGroup(g) });
    Actions.init({
      onFixMatch: g => FixMatch.open(g),
      onScanInside: g => makeGroup(g),
      onStatusChanged: () => { updateSelectionBar(); renderCurrentView(); },
      getSelected: () => games.filter(g => g.selected)
    });

    $('btnPickFolder').addEventListener('click', Folders.startAddFlow);
    $('btnWelcomePick').addEventListener('click', Folders.startAddFlow);
    $('btnAddMoreFolders').addEventListener('click', Folders.startAddFlow);
    $('btnCancelConfirm').addEventListener('click', cancelConfirm);
    $('btnStartSearch').addEventListener('click', startSearch);
    $('btnClearCache').addEventListener('click', clearCache);
    $('btnBannerUpdateKey').addEventListener('click', () => Folders.openSettings('settingsKey'));
    $('btnSelectionClear').addEventListener('click', clearSelection);
    $('btnSelectionStatus').addEventListener('click', ev => {
      ev.stopPropagation();
      const r = ev.currentTarget.getBoundingClientRect();
      Actions.showStatusMenu(r.left, r.bottom + 4, games.filter(g => g.selected));
    });
    $('btnUpdateDismiss').addEventListener('click', dismissUpdate);
    $('btnUpdateDownload').addEventListener('click', () => { if (pendingUpdate) window.electronAPI.openExternal(pendingUpdate.url); });
    modalClose.addEventListener('click', closeModal);
    gameModalOverlay.addEventListener('click', ev => {
      if (ev.target === gameModalOverlay) closeModal();
    });
    searchInput.addEventListener('input', ev => {
      searchQuery = ev.target.value.toLowerCase();
      renderCurrentView();
    });
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Escape') return;
      if (gameModalOverlay.style.display !== 'none') closeModal();
      else if (games.some(g => g.selected)) clearSelection();
    });

    // RAWG attribution links anywhere on the page
    document.addEventListener('click', ev => {
      const a = ev.target.closest('.rawg-attrib, .rawg-link');
      if (!a) return;
      ev.preventDefault();
      window.electronAPI.openExternal(a.dataset.url);
    });
    // Broken images fall back to their placeholder (inline onerror is blocked by the CSP)
    document.addEventListener('error', ev => {
      const t = ev.target;
      if (t.tagName !== 'IMG' || !t.classList.contains('img-fallback')) return;
      t.style.display = 'none';
      const next = t.nextElementSibling;
      if (next && /placeholder|candidate-cover/.test(next.className)) next.style.display = 'flex';
    }, true);

    // Delegated item events (cards, rows, sidebar items)
    for (const [container, selector] of [[gameGrid, '.game-card'], [gameList, '.list-item'], [sidebarInner, '.sidebar-item']]) {
      container.addEventListener('click', ev => {
        const btn = ev.target.closest('.card-btn');
        if (btn) {
          ev.stopPropagation();
          const game = currentList[+btn.closest(selector).dataset.index];
          if (game) { if (btn.dataset.act === 'group') makeGroup(game); else FixMatch.open(game); }
          return;
        }
        const item = ev.target.closest(selector);
        if (item) onItemClick(ev, item, selector === '.sidebar-item');
      });
      container.addEventListener('contextmenu', ev => {
        const item = ev.target.closest(selector);
        if (item) Actions.showContextMenu(ev, currentList[+item.dataset.index]);
      });
    }

    window.electronAPI.onSizeProgress(onSizeProgress);
    updateCacheLabel();

    await API.init();
    API.onKeyRejected(() => { $('keyRejectedBanner').style.display = 'flex'; });
    const status = await window.electronAPI.getApiKeyStatus();
    if (status.hasKey && status.lastCheckResult === 'invalid') $('keyRejectedBanner').style.display = 'flex';

    if (!status.hasKey && !Onboarding.wasSkipped()) Onboarding.show();
    else await loadLibrary();
  }

  // ── CACHE LABEL ──
  function updateCacheLabel() {
    const btn = $('btnClearCache');
    if (!btn) return;
    const count = API.cacheStats();
    btn.textContent = count > 0 ? `Clear Cache (${count})` : 'Clear Cache';
  }

  function clearCache() {
    const n = API.clearCache();
    updateCacheLabel();
    if (n > 0) UI.toast(`Cleared ${n} cached game${n !== 1 ? 's' : ''}`);
  }

  // ── SCREEN STATE ──
  function hideLibraryUI() {
    libraryShown = false;
    [$('libraryBody'), $('libraryToolbar'), $('selectionBar'), $('emptyLibrary'), searchWrap, viewToggle]
      .forEach(el => { el.style.display = 'none'; });
  }

  function showLibraryUI() {
    libraryShown = true;
    $('emptyLibrary').style.display = 'none';
    searchWrap.style.display = 'block';
    viewToggle.style.display = 'flex';
    $('libraryToolbar').style.display = 'flex';
    $('libraryBody').style.display = 'flex';
    setView(currentView);
  }

  function showEmpty() {
    hideLibraryUI();
    $('emptyLibrary').style.display = 'flex';
  }

  // ── LOAD LIBRARY (startup, after key changes) ──
  async function loadLibrary() {
    Onboarding.hide();
    $('emptyLibrary').style.display = 'none';

    const lib = await window.electronAPI.getLibrary();
    const scans = await window.electronAPI.scanRoots();

    // Triage + folder settings saved by the user
    Triage.setView(lib.ui.view, { persist: false });
    Folders.setHideUnavailable(lib.ui.hideUnavailable, { persist: false });
    Folders.setUpdateEnabled(lib.update?.enabled !== false);
    Folders.setIgnoreText(lib.ignore);

    Folders.setRoots(lib.roots, scans, []);
    Folders.setFilter(lib.ui.folderFilter || [], { persist: false });

    if (lib.roots.length === 0) { games = []; showEmpty(); checkForUpdate(); return; }

    // New folders found during the rescan are added automatically; vanished ones are dropped
    const { games: recs, added } = Shared.reconcileGames(lib.games, scans, Shared.cleanGameName, Shared.isSamePath);
    const saved = await window.electronAPI.saveGames(recs);
    const records = saved.games || recs;

    const unavailableRoots = new Set(scans.filter(s => !s.available).map(s => s.id));
    const savedSizes = await window.electronAPI.getSizes();
    const prev = new Map(games.map(g => [Shared.normalizePath(g.folderPath), g]));
    games = records.map(r => {
      const old = prev.get(Shared.normalizePath(r.folderPath));
      const size = savedSizes[Shared.normalizePath(r.folderPath)];
      return {
        ...r,
        data: old?.data ?? null, dataState: old?.dataState ?? 'none', fetchError: old?.fetchError ?? null,
        unavailable: unavailableRoots.has(r.rootId),
        rootName: Folders.rootName(r.rootId),
        size: size ? { bytes: size.bytes, approx: size.approx } : undefined,
        sizePending: !size && !unavailableRoots.has(r.rootId) && !r.skipped
      };
    });

    // Load metadata (cache first; network only when needed)
    const toLoad = games.filter(g => !g.skipped);
    showLoading(true);
    let done = 0;
    for (const g of toLoad) {
      loadingBar.style.width = `${Math.round((done / Math.max(toLoad.length, 1)) * 100)}%`;
      loadingText.textContent = API.hasKey() ? 'Loading game data…' : 'Loading from cache…';
      loadingSub.textContent = g.searchName;
      const t0 = performance.now();
      await loadData(g);
      done++;
      if (performance.now() - t0 > 50) await sleep(80); // went to the network — be gentle with the API
    }
    loadingBar.style.width = '100%';
    showLoading(false);

    applyDuplicates();
    Folders.refreshStats(games);
    updateCacheLabel();
    showLibraryUI();
    window.electronAPI.startSizeScan({});

    // Prompts after loading
    const needKey = !API.hasKey() ? games.filter(g => !g.skipped && !g.data).length : 0;
    if (added.length) {
      UI.toast(`${added.length} new game${added.length !== 1 ? 's' : ''} added`, { label: 'Review names', onClick: () => reviewNames(added) });
    } else if (needKey) {
      UI.toast(`${needKey} game${needKey !== 1 ? 's' : ''} need an API key`, { label: 'Add key', onClick: () => Folders.openSettings('settingsKey') });
    }
    checkForUpdate();
  }

  function showLoading(on) {
    loadingScreen.style.display = on ? 'flex' : 'none';
    if (on) {
      loadingBar.style.width = '0%';
      [$('libraryBody'), $('libraryToolbar')].forEach(el => { el.style.display = 'none'; });
    }
  }

  async function loadData(game) {
    const r = game.match?.id ? await API.fetchGameById(game.match.id) : await API.fetchGame(game.searchName);
    game.data = r.data;
    game.dataState = r.state;
    game.fetchError = r.error || null;
  }

  function applyDuplicates() {
    games.forEach(g => { g.copies = 0; g.copyList = null; });
    for (const [, list] of Shared.duplicateGroups(games)) {
      list.forEach(g => { g.copies = list.length; g.copyList = list; });
    }
  }

  function toRecord(g) {
    return {
      folderPath: g.folderPath, rootId: g.rootId, folderName: g.folderName, searchName: g.searchName,
      skipped: !!g.skipped, match: g.match || null, status: g.status || null, addedAt: g.addedAt
    };
  }

  function persistGames() {
    return window.electronAPI.saveGames(games.map(toRecord));
  }

  // ── KEY CHANGES ──
  async function onKeySaved() {
    $('keyRejectedBanner').style.display = 'none';
    Folders.closeSettings();
    if (libraryShown && games.some(g => !g.skipped && !g.data && g.fetchError)) await loadLibrary();
  }

  // ── ADD FOLDERS → CONFIRM NAMES ──
  async function onRootsAdded(newRoots, entriesByRootId) {
    newRoots.forEach(r => pendingNewRootIds.add(r.id));

    // A new root that was previously listed as a game of its parent leaves the parent's list
    const newPaths = newRoots.map(r => r.path);
    const before = games.length;
    games = games.filter(g => !newPaths.some(p => Shared.isSamePath(p, g.folderPath)));
    if (games.length !== before) await persistGames();

    syncPendingFromDom();
    const known = () => [...games.map(g => g.folderPath), ...pendingFolders.map(f => f.path)];
    newRoots.forEach(root => {
      (entriesByRootId[root.id] || []).forEach(en => {
        if (known().some(p => Shared.isSamePath(p, en.path))) return;
        pendingFolders.push({ name: en.name, path: en.path, cleaned: en.cleaned, rootId: root.id, skipped: false });
      });
    });

    Folders.setRoots(Folders.getRoots(), null, games);
    if (pendingFolders.length === 0) {
      pendingNewRootIds.clear();
      UI.toast('Folders added. No new games to show yet.');
      if (!libraryShown) await loadLibrary();
      return;
    }
    showConfirmModal();
  }

  // Review names for games that were added automatically at launch
  function reviewNames(added) {
    pendingFolders = added
      .map(r => games.find(g => Shared.isSamePath(g.folderPath, r.folderPath)))
      .filter(Boolean)
      .map(g => ({ name: g.folderName, path: g.folderPath, cleaned: g.searchName, rootId: g.rootId, skipped: false }));
    if (pendingFolders.length) showConfirmModal();
  }

  function syncPendingFromDom() {
    if (confirmOverlay.style.display === 'none') return;
    confirmList.querySelectorAll('.confirm-item').forEach((item, i) => {
      if (!pendingFolders[i]) return;
      pendingFolders[i].cleaned = item.querySelector('.confirm-item-input').value;
      pendingFolders[i].skipped = item.classList.contains('skipped');
      pendingFolders[i].group = item.classList.contains('group');
    });
  }

  function showConfirmModal() {
    confirmList.innerHTML = '';
    const cachedCount = API.cacheStats();
    pendingFolders.forEach((folder, i) => {
      const item = document.createElement('div');
      item.className = 'confirm-item' + (folder.skipped ? ' skipped' : '') + (folder.group ? ' group' : '');
      item.dataset.index = i;
      item.innerHTML = `
        <span class="confirm-item-index">${i + 1}</span>
        <span class="confirm-item-original" title="${e(folder.path)}">${e(folder.name)}</span>
        <span class="confirm-item-arrow">→</span>
        <input class="confirm-item-input" type="text" value="${e(folder.cleaned)}" />
        ${cachedCount > 0 ? `<span class="cached-badge" title="Data cached locally">●</span>` : ''}
        <button class="confirm-item-skip">${folder.skipped ? 'Undo' : 'Hide'}</button>
        <button class="confirm-item-group" title="This folder is not a game, it holds games. Scan inside it.">${folder.group ? 'Undo' : 'Has games inside'}</button>
      `;
      const skipBtn = item.querySelector('.confirm-item-skip');
      const groupBtn = item.querySelector('.confirm-item-group');
      const refresh = () => {
        skipBtn.textContent = item.classList.contains('skipped') ? 'Undo' : 'Hide';
        groupBtn.textContent = item.classList.contains('group') ? 'Undo' : 'Has games inside';
      };
      skipBtn.addEventListener('click', () => { item.classList.remove('group'); item.classList.toggle('skipped'); refresh(); });
      groupBtn.addEventListener('click', () => { item.classList.remove('skipped'); item.classList.toggle('group'); refresh(); });
      confirmList.appendChild(item);
    });

    const total = pendingFolders.length;
    confirmCount.textContent = `${total} new folder${total !== 1 ? 's' : ''} detected${games.length > 0 ? ` · ${games.length} already in library` : ''}`;
    confirmOverlay.style.display = 'flex';
    Onboarding.hide();
    $('emptyLibrary').style.display = 'none';
  }

  async function cancelConfirm() {
    confirmOverlay.style.display = 'none';
    pendingFolders = [];
    // Cancelling right after adding folders adds nothing
    if (pendingNewRootIds.size) {
      for (const id of pendingNewRootIds) await window.electronAPI.removeRoot(id);
      pendingNewRootIds.clear();
      const lib = await window.electronAPI.getLibrary();
      Folders.setRoots(lib.roots, null, games);
      if (lib.roots.length === 0) showEmpty();
    }
  }

  // ── SEARCH (after confirm) ──
  async function startSearch() {
    syncPendingFromDom();
    confirmOverlay.style.display = 'none';
    const toSearch = pendingFolders.filter(f => !f.group);
    const groups = pendingFolders.filter(f => f.group);
    pendingFolders = [];
    pendingNewRootIds.clear();

    const unavailableRoots = new Set(games.filter(g => g.unavailable).map(g => g.rootId));
    toSearch.forEach(entry => {
      const searchName = entry.cleaned.trim() || entry.name;
      const existing = games.find(g => Shared.isSamePath(g.folderPath, entry.path));
      if (existing) {
        existing.searchName = searchName;
        existing.skipped = entry.skipped;
        existing.reviewing = true;
      } else {
        games.push({
          folderPath: entry.path, rootId: entry.rootId, folderName: entry.name, searchName,
          skipped: entry.skipped, match: null, status: null, addedAt: Date.now(),
          data: null, dataState: 'none', fetchError: null,
          unavailable: unavailableRoots.has(entry.rootId), rootName: Folders.rootName(entry.rootId),
          size: undefined, sizePending: !entry.skipped, reviewing: true
        });
      }
    });

    showLoading(true);
    const work = games.filter(g => g.reviewing && !g.skipped);
    let done = 0;
    for (const g of work) {
      loadingBar.style.width = `${Math.round((done / Math.max(work.length, 1)) * 100)}%`;
      loadingText.textContent = API.hasKey() ? 'Fetching game data…' : 'Loading from cache…';
      loadingSub.textContent = g.searchName;
      const t0 = performance.now();
      await loadData(g);
      done++;
      if (performance.now() - t0 > 50) await sleep(80);
    }
    games.forEach(g => { delete g.reviewing; });
    loadingBar.style.width = '100%';
    await sleep(150);
    showLoading(false);

    // Folders marked "has games inside" become library folders of their own
    if (groups.length) {
      games = games.filter(g => !groups.some(x => Shared.isSamePath(x.folderPath, g.folderPath)));
    }
    const saved = await persistGames();
    if (groups.length) {
      await addGroups(groups);
      await loadLibrary();
      return;
    }
    if (saved.games) games.forEach(g => {
      const rec = saved.games.find(r => Shared.isSamePath(r.folderPath, g.folderPath));
      if (rec) g.addedAt = rec.addedAt;
    });
    games.forEach(g => { g.rootName = Folders.rootName(g.rootId); });

    applyDuplicates();
    Folders.setRoots(Folders.getRoots(), null, games);
    updateCacheLabel();
    showLibraryUI();
    window.electronAPI.startSizeScan({});
  }

  // ── GROUPS (folders that hold games) ──
  // groups: [{ path }] → adds each as a library folder with a unique default name
  async function addGroups(groups) {
    const lib = await window.electronAPI.getLibrary();
    const taken = lib.roots.map(r => r.name);
    const items = groups.map(g => {
      const name = Shared.defaultRootName(g.path, taken);
      taken.push(name);
      return { path: g.path, name };
    });
    const res = await window.electronAPI.addRoots(items);
    if (res.error) {
      UI.toast(res.code === 'NO_SUBFOLDERS' ? 'There are no folders inside it to scan' : 'Could not scan inside that folder');
      return false;
    }
    return true;
  }

  // "It has games in it": ask for a name, make the folder a library folder, then rescan
  async function makeGroup(game) {
    closeModal();
    const lib = await window.electronAPI.getLibrary();
    const names = lib.roots.map(r => r.name);
    const suggested = Shared.defaultRootName(game.folderPath, names);
    const name = await UI.dialog({
      title: 'Scan inside this folder',
      html: `<p class="dialog-text">The folders inside <b>${e(game.folderName)}</b> will be added as games, under a library folder with this name:</p>
        <input id="groupName" class="key-input" maxlength="60" value="${e(suggested)}" />
        <div class="row-error" id="groupErr"></div>`,
      buttons: [
        { label: 'Cancel', value: null },
        { label: 'Scan inside', primary: true, onClick: () => {
          const v = Shared.validateRootName(document.getElementById('groupName').value, names);
          if (!v.ok) {
            const err = document.getElementById('groupErr');
            err.textContent = { NAME_REQUIRED: 'Name is required', NAME_TOO_LONG: 'Max 30 characters', NAME_TAKEN: 'Name already used' }[v.code];
            err.classList.add('show');
            return;
          }
          UI.closeDialog(v.name);
        } }
      ]
    });
    if (!name) return;
    const res = await window.electronAPI.addRoots([{ path: game.folderPath, name }]);
    if (res.error) {
      UI.toast(res.code === 'NO_SUBFOLDERS' ? 'There are no folders inside it to scan' : 'Could not scan inside that folder');
      return;
    }
    games = games.filter(g => g !== game);
    await persistGames();
    await loadLibrary();
  }

  // ── FOLDER / MATCH CHANGES ──
  async function onRootsChanged(change) {
    const lib = await window.electronAPI.getLibrary();
    if (change.kind === 'remove') {
      games = games.filter(g => g.rootId !== change.id);
    } else if (change.kind === 'restore') {
      const g = games.find(x => Shared.isSamePath(x.folderPath, change.path));
      if (g) { g.skipped = false; g.sizePending = !g.size; await loadData(g); }
    }
    games.forEach(g => { g.rootName = lib.roots.find(r => r.id === g.rootId)?.name || ''; });
    applyDuplicates();
    Folders.setRoots(lib.roots, null, games);
    if (lib.roots.length === 0) { showEmpty(); return; }
    if (change.kind === 'restore') window.electronAPI.startSizeScan({});
    renderCurrentView();
  }

  function onRecalculate(rootId) {
    games.filter(g => g.rootId === rootId && !g.skipped && !g.unavailable).forEach(g => { g.size = undefined; g.sizePending = true; });
    Folders.refreshStats(games);
    renderCurrentView();
  }

  async function onMatchChanged(game, change) {
    if (change.kind === 'skip') game.skipped = true;
    else { game.match = change.match; await loadData(game); }
    closeModal();
    applyDuplicates();
    Folders.refreshStats(games);
    updateCacheLabel();
    sidebarActive = -1;
    renderCurrentView();
  }

  // ── SIZES ──
  function onSizeProgress(ev) {
    if (ev.done) {
      games.forEach(g => { g.sizePending = false; });
      Folders.refreshStats(games);
      renderCurrentView();
      return;
    }
    const g = games.find(x => Shared.isSamePath(x.folderPath, ev.folderPath));
    if (g) { g.size = { bytes: ev.bytes, approx: ev.approx }; g.sizePending = false; }
    scheduleRender();
  }

  function scheduleRender() {
    if (renderTimer) return;
    renderTimer = setTimeout(() => { renderTimer = null; Folders.refreshStats(games); renderCurrentView(); }, 500);
  }

  // ── SET VIEW ──
  function setView(view) {
    currentView = view;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    viewGrid.style.display    = view === 'grid'    ? 'block' : 'none';
    viewList.style.display    = view === 'list'    ? 'block' : 'none';
    viewSidebar.style.display = view === 'sidebar' ? 'flex'  : 'none';
    renderCurrentView();
  }

  // ── RENDER ──
  function renderCurrentView() {
    if (!libraryShown) return;
    const view = Triage.getView();
    const ctx = { text: searchQuery, rootIds: Folders.getFilter(), hideUnavailable: Folders.getHideUnavailable() };
    const q = Shared.queryLibrary(games, view, ctx);
    currentList = q.list;
    Triage.updateCount(q.list.length, q.total, q.shownBytes, Shared.isFiltered(view, ctx) || ctx.hideUnavailable);
    updateSelectionBar();

    if (currentView === 'grid') renderGrid(currentList);
    else if (currentView === 'list') renderList(currentList);
    else renderSidebar(currentList);
  }

  function renderGrid(list) {
    if (list.length === 0) { gameGrid.innerHTML = emptyHtml(); return; }
    gameGrid.innerHTML = list.map((g, i) => Render.gridCard(g, i)).join('');
  }

  function renderList(list) {
    if (list.length === 0) { gameList.innerHTML = emptyHtml(); return; }
    gameList.innerHTML = list.map((g, i) => Render.listItem(g, i)).join('');
  }

  function renderSidebar(list) {
    if (list.length === 0) {
      sidebarInner.innerHTML = emptyHtml(true);
      detailPanel.innerHTML = '<div class="detail-placeholder"><p>No games</p></div>';
      return;
    }
    sidebarInner.innerHTML = list.map((g, i) => Render.sidebarItem(g, i)).join('');
    if (sidebarActive === -1 || sidebarActive >= list.length) sidebarActive = 0;
    sidebarInner.querySelectorAll('.sidebar-item')[sidebarActive]?.classList.add('active');
    showDetail(list[sidebarActive]);
  }

  function showDetail(game) {
    detailPanel.innerHTML = Render.detailPanel(game);
    Actions.bindBar(detailPanel, game);
  }

  // ── ITEM CLICKS / SELECTION ──
  function onItemClick(ev, item, isSidebar) {
    const idx = +item.dataset.index;
    const game = currentList[idx];
    if (!game) return;

    if (isSidebar) {
      sidebarActive = idx;
      sidebarInner.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showDetail(game);
      return;
    }
    if (ev.shiftKey && lastSelectedIndex >= 0) {
      const [a, b] = [Math.min(lastSelectedIndex, idx), Math.max(lastSelectedIndex, idx)];
      for (let i = a; i <= b; i++) currentList[i].selected = true;
    } else if (ev.ctrlKey || ev.metaKey || games.some(g => g.selected)) {
      game.selected = !game.selected;
      lastSelectedIndex = idx;
    } else {
      openModal(game);
      return;
    }
    refreshSelectionClasses();
    updateSelectionBar();
  }

  function refreshSelectionClasses() {
    const selector = currentView === 'grid' ? '.game-card' : currentView === 'list' ? '.list-item' : null;
    if (!selector) return;
    document.querySelectorAll(selector).forEach(el => {
      el.classList.toggle('is-selected', !!currentList[+el.dataset.index]?.selected);
    });
  }

  function clearSelection() {
    games.forEach(g => { g.selected = false; });
    lastSelectedIndex = -1;
    refreshSelectionClasses();
    updateSelectionBar();
  }

  function updateSelectionBar() {
    const n = games.filter(g => g.selected).length;
    $('selectionBar').style.display = n ? 'flex' : 'none';
    $('selectionCount').textContent = `${n} selected`;
  }

  // ── MODAL ──
  function openModal(game) {
    const { hero, body } = Render.modal(game);
    modalHero.innerHTML = hero;
    modalBody.innerHTML = body;
    gameModalOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    Actions.bindBar(modalBody, game);

    gameModal.querySelectorAll('.screenshot-img').forEach(img => {
      img.addEventListener('click', () => window.electronAPI.openExternal(img.src));
    });
  }

  function closeModal() {
    gameModalOverlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  // ── UPDATE NOTICE ──
  async function checkForUpdate() {
    try {
      const res = await window.electronAPI.checkForUpdate();
      if (!res?.update) return;
      pendingUpdate = res.update;
      const notes = (pendingUpdate.notes || '').replace(/\s+/g, ' ').trim();
      $('updateNoticeText').textContent = `Version ${pendingUpdate.version} is available` + (notes ? ` — ${notes.slice(0, 120)}${notes.length > 120 ? '…' : ''}` : '');
      $('updateNotice').style.display = 'flex';
    } catch {}
  }

  async function dismissUpdate() {
    if (pendingUpdate) await window.electronAPI.setUpdateSettings({ dismissed: pendingUpdate.version });
    $('updateNotice').style.display = 'none';
  }

  function emptyHtml(small = false) {
    return `<div class="empty-state" style="${small ? 'height:200px' : ''}">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" stroke-linecap="round"/></svg>
      <p>No games found</p>
    </div>`;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
