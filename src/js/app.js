// ═══════════════════════════════════════
// Games Hoarder Viewer — Main App
// ═══════════════════════════════════════

const App = (() => {
  // State
  let games = [];          // [{folderName, searchName, folderPath, data, skipped}]
  let pendingFolders = []; // folders accumulated across multiple picks, not yet searched
  let currentView = 'grid';
  let sidebarActive = -1;
  let searchQuery = '';

  // DOM refs
  const $ = id => document.getElementById(id);
  const welcomeScreen    = $('welcomeScreen');
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
  function init() {
    $('btnPickFolder').addEventListener('click', pickFolder);
    $('btnWelcomePick').addEventListener('click', pickFolder);
    $('btnCancelConfirm').addEventListener('click', () => {
      confirmOverlay.style.display = 'none';
      pendingFolders = [];
    });
    $('btnAddMoreFolders').addEventListener('click', addMoreFolders);
    $('btnStartSearch').addEventListener('click', startSearch);
    $('btnClearCache').addEventListener('click', clearCache);
    modalClose.addEventListener('click', closeModal);
    gameModalOverlay.addEventListener('click', e => {
      if (e.target === gameModalOverlay) closeModal();
    });
    searchInput.addEventListener('input', e => {
      searchQuery = e.target.value.toLowerCase();
      renderCurrentView();
    });
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });

    updateCacheLabel();
  }

  function updateCacheLabel() {
    const btn = $('btnClearCache');
    if (!btn) return;
    const count = API.cacheStats();
    btn.textContent = count > 0 ? `Clear Cache (${count})` : 'Clear Cache';
  }

  function clearCache() {
    const n = API.clearCache();
    updateCacheLabel();
    if (n > 0) showToast(`Cleared ${n} cached game${n !== 1 ? 's' : ''}`);
  }

  // ── PICK FOLDER ──
  async function pickFolder() {
    const dirPath = await window.electronAPI.pickDirectory();
    if (!dirPath) return;

    const result = await window.electronAPI.readFolders(dirPath);
    if (result.error) { alert('Error reading folder: ' + result.error); return; }
    if (result.length === 0) { alert('No subfolders found in that directory.'); return; }

    // Deduplicate against already-loaded games and existing pending folders
    const existingPaths = new Set([
      ...games.map(g => g.folderPath),
      ...pendingFolders.map(f => f.path)
    ]);
    const fresh = result.filter(f => !existingPaths.has(f.path));

    if (fresh.length === 0) {
      showToast('All folders in this directory are already in your library.');
      return;
    }

    pendingFolders = [...pendingFolders, ...fresh];
    showConfirmModal();
  }

  // ── ADD MORE FOLDERS (while confirm modal is open) ──
  async function addMoreFolders() {
    const dirPath = await window.electronAPI.pickDirectory();
    if (!dirPath) return;

    const result = await window.electronAPI.readFolders(dirPath);
    if (result.error) { alert('Error reading folder: ' + result.error); return; }
    if (result.length === 0) { alert('No subfolders found.'); return; }

    const existingPaths = new Set([
      ...games.map(g => g.folderPath),
      ...pendingFolders.map(f => f.path)
    ]);
    const fresh = result.filter(f => !existingPaths.has(f.path));

    if (fresh.length === 0) {
      showToast('All folders already added.');
      return;
    }

    pendingFolders = [...pendingFolders, ...fresh];
    showConfirmModal();
  }

  // ── CONFIRM MODAL ──
  function showConfirmModal() {
    confirmList.innerHTML = '';
    pendingFolders.forEach((folder, i) => {
      const item = document.createElement('div');
      item.className = 'confirm-item';
      item.dataset.index = i;

      const isCached = API.cacheStats() > 0;
      const cachedBadge = isCached
        ? `<span class="cached-badge" title="Data cached locally">●</span>`
        : '';

      item.innerHTML = `
        <span class="confirm-item-index">${i + 1}</span>
        <span class="confirm-item-original" title="${folder.path}">${folder.name}</span>
        <span class="confirm-item-arrow">→</span>
        <input class="confirm-item-input" type="text" value="${folder.cleaned}"
               data-original="${folder.name}" data-path="${folder.path}" />
        ${cachedBadge}
        <button class="confirm-item-skip">Skip</button>
      `;
      const skipBtn = item.querySelector('.confirm-item-skip');
      skipBtn.addEventListener('click', () => {
        item.classList.toggle('skipped');
        skipBtn.textContent = item.classList.contains('skipped') ? 'Undo' : 'Skip';
      });
      confirmList.appendChild(item);
    });

    const total = pendingFolders.length;
    const existing = games.length;
    confirmCount.textContent = `${total} new folder${total !== 1 ? 's' : ''} detected${existing > 0 ? ` · ${existing} already in library` : ''}`;
    confirmOverlay.style.display = 'flex';
    welcomeScreen.style.display = 'none';
  }

  // ── START SEARCH ──
  async function startSearch() {
    confirmOverlay.style.display = 'none';

    const items = confirmList.querySelectorAll('.confirm-item');
    const toSearch = [];
    items.forEach(item => {
      const skipped = item.classList.contains('skipped');
      const input = item.querySelector('.confirm-item-input');
      const folderName = input.dataset.original;
      const folderPath = input.dataset.path || '';
      const searchName = input.value.trim();
      toSearch.push({ folderName, searchName, skipped, folderPath });
    });

    pendingFolders = [];

    loadingScreen.style.display = 'flex';
    loadingBar.style.width = '0%';

    const total = toSearch.filter(g => !g.skipped).length;
    let done = 0;
    let cacheHits = 0;

    for (const entry of toSearch) {
      if (entry.skipped) {
        games.push({ folderName: entry.folderName, searchName: entry.searchName, folderPath: entry.folderPath, data: null, skipped: true });
        continue;
      }

      loadingBar.style.width = `${Math.round((done / total) * 100)}%`;

      // Check cache before showing "fetching" label
      const isCached = API.cacheStats() > 0;
      loadingText.textContent = isCached ? 'Loading from cache…' : 'Fetching game data…';
      loadingSub.textContent = entry.searchName;

      const beforeCount = API.cacheStats();
      const data = await API.fetchGame(entry.searchName);
      const afterCount = API.cacheStats();
      if (afterCount > beforeCount) cacheHits = 0; // new entry written
      // If cache didn't grow and data came back, it was a hit
      games.push({ folderName: entry.folderName, searchName: entry.searchName, folderPath: entry.folderPath, data });
      done++;

      await sleep(100);
    }

    loadingBar.style.width = '100%';
    await sleep(200);
    loadingScreen.style.display = 'none';

    updateCacheLabel();

    searchWrap.style.display = 'block';
    viewToggle.style.display = 'flex';
    setView(currentView === 'grid' ? 'grid' : currentView);
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
  function filteredGames() {
    if (!searchQuery) return games.filter(g => !g.skipped);
    return games.filter(g => {
      if (g.skipped) return false;
      const name = (g.data?.name || g.searchName).toLowerCase();
      return name.includes(searchQuery);
    });
  }

  function renderCurrentView() {
    const list = filteredGames();
    if (currentView === 'grid') renderGrid(list);
    else if (currentView === 'list') renderList(list);
    else renderSidebar(list);
  }

  function renderGrid(list) {
    if (list.length === 0) { gameGrid.innerHTML = emptyHtml(); return; }
    gameGrid.innerHTML = list.map((g, i) => Render.gridCard(g, i)).join('');
    gameGrid.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', () => openModal(list[+card.dataset.index]));
    });
  }

  function renderList(list) {
    if (list.length === 0) { gameList.innerHTML = emptyHtml(); return; }
    gameList.innerHTML = list.map((g, i) => Render.listItem(g, i)).join('');
    gameList.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => openModal(list[+item.dataset.index]));
    });
  }

  function renderSidebar(list) {
    if (list.length === 0) {
      sidebarInner.innerHTML = emptyHtml(true);
      detailPanel.innerHTML = '<div class="detail-placeholder"><p>No games</p></div>';
      return;
    }
    sidebarInner.innerHTML = list.map((g, i) => Render.sidebarItem(g, i)).join('');
    sidebarInner.querySelectorAll('.sidebar-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = +item.dataset.index;
        sidebarActive = idx;
        sidebarInner.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        detailPanel.innerHTML = Render.detailPanel(list[idx]);
        bindDetailLinks();
      });
    });

    if (sidebarActive === -1 || sidebarActive >= list.length) {
      sidebarActive = 0;
      sidebarInner.querySelector('.sidebar-item')?.classList.add('active');
      detailPanel.innerHTML = Render.detailPanel(list[0]);
      bindDetailLinks();
    }
  }

  function bindDetailLinks() {
    detailPanel.querySelectorAll('.rawg-link').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        window.electronAPI.openExternal(a.dataset.url);
      });
    });
  }

  // ── MODAL ──
  function openModal(game) {
    const { hero, body } = Render.modal(game);
    modalHero.innerHTML = hero;
    modalBody.innerHTML = body;
    gameModalOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    gameModal.querySelectorAll('.rawg-link').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        window.electronAPI.openExternal(a.dataset.url);
      });
    });
    gameModal.querySelectorAll('.screenshot-img').forEach(img => {
      img.addEventListener('click', () => window.electronAPI.openExternal(img.src));
    });
  }

  function closeModal() {
    gameModalOverlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  // ── TOAST ──
  function showToast(msg) {
    let toast = $('appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.className = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('visible'), 2800);
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
