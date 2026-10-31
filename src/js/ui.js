// ═══════════════════════════════════════
// UI helpers — toast, dialog, context menu
// ═══════════════════════════════════════

const UI = (() => {
  const $ = id => document.getElementById(id);

  // ── TOAST ── optional action: { label, onClick }
  function toast(msg, action, ms = 2800) {
    let el = $('appToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'appToast';
      el.className = 'app-toast';
      document.body.appendChild(el);
    }
    el.innerHTML = '';
    const text = document.createElement('span');
    text.textContent = msg;
    el.appendChild(text);
    if (action) {
      const btn = document.createElement('button');
      btn.className = 'toast-action';
      btn.textContent = action.label;
      btn.addEventListener('click', () => { el.classList.remove('visible'); action.onClick(); });
      el.appendChild(btn);
    }
    el.classList.toggle('has-action', !!action);
    el.classList.add('visible');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('visible'), action ? Math.max(ms, 6000) : ms);
  }

  // ── DIALOG ── buttons: [{ label, value, primary, danger, disabled, title }] → Promise<value | null>
  let dialogResolve = null;

  function dialog({ title, html, buttons, onRender }) {
    closeDialog(null);
    $('dialogTitle').textContent = title;
    $('dialogBody').innerHTML = html || '';
    const wrap = $('dialogButtons');
    wrap.innerHTML = '';
    (buttons || [{ label: 'OK', value: true, primary: true }]).forEach(b => {
      const btn = document.createElement('button');
      btn.className = b.primary ? 'btn-primary' : 'btn-secondary' + (b.danger ? ' btn-danger' : '');
      btn.textContent = b.label;
      if (b.disabled) btn.disabled = true;
      if (b.title) btn.title = b.title;
      if (b.id) btn.id = b.id;
      btn.addEventListener('click', () => {
        if (b.onClick) { b.onClick(); return; }
        closeDialog(b.value);
      });
      wrap.appendChild(btn);
    });
    $('dialogOverlay').style.display = 'flex';
    if (onRender) onRender($('dialogBody'));
    return new Promise(resolve => { dialogResolve = resolve; });
  }

  function closeDialog(value) {
    $('dialogOverlay').style.display = 'none';
    if (dialogResolve) { const r = dialogResolve; dialogResolve = null; r(value); }
  }

  function confirm(title, message, okLabel = 'OK', danger = false) {
    const p = document.createElement('p');
    p.textContent = message;
    return dialog({
      title,
      html: `<p class="dialog-text">${Render.escapeHtml(message)}</p>`,
      buttons: [
        { label: 'Cancel', value: false },
        danger ? { label: okLabel, value: true, danger: true } : { label: okLabel, value: true, primary: true }
      ]
    }).then(v => !!v);
  }

  // ── CONTEXT MENU ── items: [{ label, onClick, disabled, title } | { separator: true }]
  function menu(x, y, items) {
    const el = $('contextMenu');
    el.innerHTML = '';
    items.forEach(item => {
      if (item.separator) {
        const hr = document.createElement('div');
        hr.className = 'menu-sep';
        el.appendChild(hr);
        return;
      }
      const btn = document.createElement('button');
      btn.className = 'menu-item';
      btn.textContent = item.label;
      if (item.disabled) btn.disabled = true;
      if (item.title) btn.title = item.title;
      btn.addEventListener('click', ev => { ev.stopPropagation(); hideMenu(); item.onClick(); });
      el.appendChild(btn);
    });
    el.style.display = 'block';
    const r = el.getBoundingClientRect();
    el.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
    el.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
  }

  function hideMenu() { $('contextMenu').style.display = 'none'; }

  function init() {
    $('dialogOverlay').addEventListener('click', ev => { if (ev.target.id === 'dialogOverlay') closeDialog(null); });
    document.addEventListener('click', ev => { if (!ev.target.closest('#contextMenu')) hideMenu(); });
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Escape') return;
      hideMenu();
      if ($('dialogOverlay').style.display !== 'none') closeDialog(null);
    });
    window.addEventListener('blur', hideMenu);
    window.addEventListener('resize', hideMenu);
  }

  return { toast, dialog, closeDialog, confirm, menu, hideMenu, init };
})();
