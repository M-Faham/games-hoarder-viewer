// ═══════════════════════════════════════
// Actions — right-click menu, detail/modal action bars, installers, status
// ═══════════════════════════════════════

const Actions = (() => {
  const e = Render.escapeHtml;

  const STATUS_ITEMS = [
    ['backlog', 'Backlog'], ['installed', 'Installed'], ['played', 'Played'], ['delete', 'Can delete']
  ];

  let cb = {};

  // callbacks: onFixMatch(game), onScanInside(game), onStatusChanged(), getSelected() → games
  function init(callbacks) { cb = callbacks; }

  function baseName(p) { return String(p).split(/[\\/]/).pop(); }

  // ── ACTIONS ──
  function openInExplorer(game) {
    window.electronAPI.showInFolder(game.folderPath);
  }

  async function copyPath(game) {
    await window.electronAPI.copyText(game.folderPath);
    UI.toast('Path copied');
  }

  async function runInstaller(game) {
    const installers = await window.electronAPI.findInstallers(game.folderPath);
    if (!Array.isArray(installers) || !installers.length) { UI.toast('No installer found'); return; }

    let file = installers[0];
    if (installers.length === 1) {
      const ok = await UI.confirm('Run installer', `Start ${baseName(file)} from this game's folder?`, 'Run');
      if (!ok) return;
    } else {
      const chosen = await UI.dialog({
        title: 'Choose an installer',
        html: installers.map((f, i) => `<label class="checkbox-row"><input type="radio" name="inst" value="${i}" ${i === 0 ? 'checked' : ''}/> ${e(baseName(f))}</label>`).join(''),
        buttons: [
          { label: 'Cancel', value: null },
          { label: 'Run', primary: true, onClick: () => UI.closeDialog(+document.querySelector('#dialogBody input[name=inst]:checked').value) }
        ]
      });
      if (chosen == null) return;
      file = installers[chosen];
    }
    const res = await window.electronAPI.runInstaller(game.folderPath, file);
    if (res?.error) UI.toast(res.code === 'NOT_FOUND' ? 'Installer not found' : "Couldn't start the installer");
  }

  async function setStatus(games, status) {
    await window.electronAPI.setGamesStatus(games.map(g => g.folderPath), status);
    games.forEach(g => { g.status = status; });
    cb.onStatusChanged();
  }

  function statusItems(games) {
    const many = games.length > 1;
    return [
      ...STATUS_ITEMS.map(([k, label]) => ({ label: `${many ? `${games.length} games: ` : ''}${label}`, onClick: () => setStatus(games, k) })),
      { label: many ? `${games.length} games: Clear status` : 'Clear status', onClick: () => setStatus(games, null) }
    ];
  }

  function showStatusMenu(x, y, games) { UI.menu(x, y, statusItems(games)); }

  // ── CONTEXT MENU ──
  async function showContextMenu(ev, game) {
    ev.preventDefault();
    const x = ev.clientX, y = ev.clientY;
    const selected = cb.getSelected();
    if (game.selected && selected.length > 1) {
      UI.menu(x, y, statusItems(selected));
      return;
    }
    const offline = game.unavailable ? "This library folder can't be reached" : '';
    const installers = game.unavailable ? [] : await window.electronAPI.findInstallers(game.folderPath);
    const hasInstaller = Array.isArray(installers) && installers.length > 0;
    UI.menu(x, y, [
      { label: 'Open in Explorer', onClick: () => openInExplorer(game), disabled: !!offline, title: offline },
      { label: 'Run installer…', onClick: () => runInstaller(game), disabled: !hasInstaller, title: offline || (hasInstaller ? '' : 'No installer found') },
      { label: 'Copy path', onClick: () => copyPath(game), disabled: !!offline, title: offline },
      { separator: true },
      { label: 'Fix match…', onClick: () => cb.onFixMatch(game) },
      { label: 'It has games in it – scan inside…', onClick: () => cb.onScanInside(game), disabled: !!offline, title: offline },
      { separator: true },
      ...statusItems([game])
    ]);
  }

  // ── ACTION BAR (detail panel / modal) ──
  // Wires the buttons rendered by Render.actionsBar and Render.copiesSection inside `container`
  async function bindBar(container, game) {
    const bar = container.querySelector('.actions-bar');
    if (bar) {
      bar.querySelector('[data-action="explorer"]')?.addEventListener('click', () => openInExplorer(game));
      bar.querySelector('[data-action="installer"]')?.addEventListener('click', () => runInstaller(game));
      bar.querySelector('[data-action="copy"]')?.addEventListener('click', () => copyPath(game));
      bar.querySelector('[data-action="fixmatch"]')?.addEventListener('click', () => cb.onFixMatch(game));
      bar.querySelector('[data-action="group"]')?.addEventListener('click', () => cb.onScanInside(game));
      bar.querySelector('[data-action="status"]')?.addEventListener('click', ev => {
        ev.stopPropagation();
        const r = ev.currentTarget.getBoundingClientRect();
        showStatusMenu(r.left, r.bottom + 4, [game]);
      });
      // Disable "Run installer" when there is nothing to run
      const btn = bar.querySelector('[data-action="installer"]');
      if (btn && !btn.disabled) {
        const list = await window.electronAPI.findInstallers(game.folderPath);
        if (!Array.isArray(list) || !list.length) { btn.disabled = true; btn.title = 'No installer found'; }
      }
    }
    container.querySelectorAll('[data-action="explorer-copy"]').forEach(b =>
      b.addEventListener('click', () => window.electronAPI.showInFolder(b.dataset.path)));
  }

  return { init, showContextMenu, showStatusMenu, bindBar, setStatus };
})();
