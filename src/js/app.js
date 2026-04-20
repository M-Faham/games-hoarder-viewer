// ═══════════════════════════════════════
// Games Hoarder Viewer — Main App
// ═══════════════════════════════════════

const App = (() => {
  // State
  let games = [];          // [{folderName, searchName, data, skipped}]
  let currentView = 'grid';
  let sidebarActive = -1;
  let searchQuery = '';

  // DOM refs
  const $ = id => document.getElementById(id);
  const welcomeScreen   = $('welcomeScreen');
  const confirmOverlay  = $('confirmOverlay');
  const confirmList     = $('confirmList');
  const confirmCount    = $('confirmCount');
  const loadingScreen   = $('loadingScreen');
  const loadingText     = $('loadingText');
  const loadingBar      = $('loadingBar');
  const loadingSub      = $('loadingSub');
  const searchWrap      = $('searchWrap');
  const searchInput     = $('searchInput');
  const viewToggle      = $('viewToggle');
  const viewGrid        = $('viewGrid');
  const viewList        = $('viewList');
  const viewSidebar     = $('viewSidebar');
  const gameGrid        = $('gameGrid');
  const gameList        = $('gameList');
  const sidebarInner    = $('sidebarInner');
  const detailPanel     = $('detailPanel');
  const gameModalOverlay = $('gameModalOverlay');
  const gameModal       = $('gameModal');
  const modalHero       = $('modalHero');
  const modalBody       = $('modalBody');
  const modalClose      = $('modalClose');

  // ── INIT ──
  function init() {
    $('btnPickFolder').addEventListener('click', pickFolder);
    $('btnWelcomePick').addEventListener('click', pickFolder);
    $('btnCancelConfirm').addEventListener('click', () => {
      confirmOverlay.style.display = 'none';
    });
    $('btnStartSearch').addEventListener('click', startSearch);
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
  }

  // ── PICK FOLDER ──
  async function pickFolder() {
    const dirPath = await window.electronAPI.pickDirectory();
    if (!dirPath) return;

    const result = await window.electronAPI.readFolders(dirPath);
    if (result.error) {
      alert('Error reading folder: ' + result.error);
      return;
    }
    if (result.length === 0) {
      alert('No subfolders found in that directory.');
      return;
    }

    showConfirmModal(result);
  }

  // ── CONFIRM MODAL ──
  function showConfirmModal(folders) {
    confirmList.innerHTML = '';
    folders.forEach((folder, i) => {
      const item = document.createElement('div');
      item.className = 'confirm-item';
      item.dataset.index = i;
      item.innerHTML = `
        <span class="confirm-item-index">${i + 1}</span>
        <span class="confirm-item-original" title="${folder.name}">${folder.name}</span>
        <span class="confirm-item-arrow">→</span>
        <input class="confirm-item-input" type="text" value="${folder.cleaned}" data-original="${folder.name}" />
        <button class="confirm-item-skip">Skip</button>
      `;
      const skipBtn = item.querySelector('.confirm-item-skip');
      skipBtn.addEventListener('click', () => {
        item.classList.toggle('skipped');
        skipBtn.textContent = item.classList.contains('skipped') ? 'Undo' : 'Skip';
      });
      confirmList.appendChild(item);
    });

    confirmCount.textContent = `${folders.length} game folder${folders.length !== 1 ? 's' : ''} detected`;
    confirmOverlay.style.display = 'flex';
    welcomeScreen.style.display = 'none';
  }

  // ── START SEARCH ──
  async function startSearch() {
    confirmOverlay.style.display = 'none';

    // Build game list from confirm modal
    const items = confirmList.querySelectorAll('.confirm-item');
    const toSearch = [];
    items.forEach(item => {
      const skipped = item.classList.contains('skipped');
      const folderName = item.querySelector('[data-original]').dataset.original;
      const searchName = item.querySelector('.confirm-item-input').value.trim();
      toSearch.push({ folderName, searchName, skipped });
    });

    games = [];
    loadingScreen.style.display = 'flex';
    loadingBar.style.width = '0%';

    const total = toSearch.filter(g => !g.skipped).length;
    let done = 0;

    for (const entry of toSearch) {
      if (entry.skipped) {
        games.push({ folderName: entry.folderName, searchName: entry.searchName, data: null, skipped: true });
        continue;
      }

      loadingText.textContent = `Fetching game data…`;
      loadingSub.textContent = entry.searchName;
      loadingBar.style.width = `${Math.round((done / total) * 100)}%`;

      const data = await API.fetchGame(entry.searchName);
      games.push({ folderName: entry.folderName, searchName: entry.searchName, data });
      done++;

      // Small delay to avoid hammering the API
      await sleep(300);
    }

    loadingBar.style.width = '100%';
    await sleep(300);
    loadingScreen.style.display = 'none';

    // Show library
    searchWrap.style.display = 'block';
    viewToggle.style.display = 'flex';
    setView('grid');
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

    // Auto-select first
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

    // Bind links in modal
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
