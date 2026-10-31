// ═══════════════════════════════════════
// Fix match — pick the right RAWG game for a folder, mark "Not a game", or reset to automatic
// ═══════════════════════════════════════

const FixMatch = (() => {
  const $ = id => document.getElementById(id);
  const e = Render.escapeHtml;

  let game = null;
  let cb = {};

  const MESSAGES = {
    no_key: 'Searching needs a RAWG API key.',
    offline: "Couldn't reach RAWG. Check your connection and try again.",
    rate_limited: 'RAWG is limiting requests right now. Wait a minute and try again.',
    invalid: 'Your RAWG key was rejected. Update it in Settings.',
    error: 'RAWG is having problems right now. Try again later.'
  };

  // callbacks: onChanged(game, { kind: 'match' | 'skip', match }), onOpenSettings(), onScanInside(game)
  function init(callbacks) {
    cb = callbacks;
    $('btnFixMatchSearch').addEventListener('click', search);
    $('fixMatchInput').addEventListener('keydown', ev => { if (ev.key === 'Enter') search(); });
    $('btnFixMatchClose').addEventListener('click', close);
    $('fixMatchOverlay').addEventListener('click', ev => { if (ev.target.id === 'fixMatchOverlay') close(); });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && $('fixMatchOverlay').style.display !== 'none') close(); });
    $('btnFixMatchNotGame').addEventListener('click', async () => {
      const g = game;
      const choice = await UI.dialog({
        title: 'This folder is not a game',
        html: '<p class="dialog-text">Is it just something to hide (like a download or temp folder), or does it hold games of its own?</p>',
        buttons: [
          { label: 'Cancel', value: null },
          { label: 'Just hide it', value: 'hide' },
          { label: 'It has games in it', value: 'group', primary: true }
        ]
      });
      if (choice === 'hide') {
        await window.electronAPI.setGameSkipped(g.folderPath, true);
        close();
        cb.onChanged(g, { kind: 'skip' });
      } else if (choice === 'group') {
        close();
        cb.onScanInside(g);
      }
    });
    $('btnFixMatchReset').addEventListener('click', async () => {
      const g = game;
      await window.electronAPI.setGameMatch(g.folderPath, null);
      close();
      cb.onChanged(g, { kind: 'match', match: null });
    });
  }

  function open(g) {
    game = g;
    $('fixMatchFolder').textContent = g.folderPath;
    $('fixMatchInput').value = g.searchName || g.folderName || '';
    $('btnFixMatchReset').style.display = g.match ? '' : 'none';
    $('fixMatchResults').innerHTML = '';
    $('fixMatchOverlay').style.display = 'flex';
    if (!API.hasKey()) { showMessage(MESSAGES.no_key, true); return; }
    $('fixMatchInput').focus();
    $('fixMatchInput').select();
    search();
  }

  function close() { $('fixMatchOverlay').style.display = 'none'; game = null; }

  function showMessage(text, withSettings) {
    const box = $('fixMatchResults');
    box.innerHTML = `<div class="fixmatch-msg">${e(text)}${withSettings ? ' <button class="btn-link" id="btnFixMatchSettings">Open Settings</button>' : ''}</div>`;
    $('btnFixMatchSettings')?.addEventListener('click', () => { close(); cb.onOpenSettings(); });
  }

  async function search() {
    const term = $('fixMatchInput').value.trim();
    if (!term) return;
    if (!API.hasKey()) { showMessage(MESSAGES.no_key, true); return; }
    $('fixMatchResults').innerHTML = '<div class="fixmatch-msg">Searching…</div>';
    const res = await API.searchCandidates(term);
    if (!game) return; // dialog was closed meanwhile
    if (res.error) { showMessage(MESSAGES[res.error] || MESSAGES.error, res.error === 'invalid'); return; }
    if (!res.results.length) { showMessage('No results. Try a shorter search term.'); return; }

    const box = $('fixMatchResults');
    box.innerHTML = res.results.map((r, i) => `
      <button class="candidate" data-i="${i}">
        ${r.cover ? `<img class="candidate-cover img-fallback" src="${e(r.cover)}" alt="" /><div class="candidate-cover candidate-cover-ph" style="display:none"></div>` : '<div class="candidate-cover candidate-cover-ph"></div>'}
        <span class="candidate-name">${e(r.name)}</span>
        <span class="candidate-year">${e(r.released ? r.released.slice(0, 4) : '')}</span>
        ${game.match?.id === r.id ? '<span class="candidate-current">current</span>' : ''}
      </button>`).join('');
    box.querySelectorAll('.candidate').forEach(btn => btn.addEventListener('click', async () => {
      const chosen = res.results[+btn.dataset.i];
      const g = game;
      const match = { type: 'id', id: chosen.id };
      await window.electronAPI.setGameMatch(g.folderPath, match);
      close();
      cb.onChanged(g, { kind: 'match', match });
    }));
  }

  return { init, open };
})();
