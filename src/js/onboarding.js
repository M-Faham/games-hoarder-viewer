// ═══════════════════════════════════════
// Onboarding — Welcome / API key page + the key section of Settings
// ═══════════════════════════════════════

const Onboarding = (() => {
  const $ = id => document.getElementById(id);
  const RAWG_KEY_PAGE = 'https://rawg.io/apidocs';

  const MESSAGES = {
    invalid: "RAWG didn't accept this key. Check that you copied all of it.",
    offline: "Couldn't reach RAWG, so the key wasn't checked. Check your connection and try again, or save it without checking.",
    rate_limited: 'RAWG is limiting requests right now. Wait a minute and try again.',
    error: 'RAWG is having problems right now. Try again later.'
  };

  let sessionSkipped = false;
  let onDone = () => {};
  let onKeyRemoved = () => {};
  let onKeySaved = () => {};

  function setMsg(el, text, kind) {
    el.textContent = text || '';
    el.className = 'key-msg' + (kind ? ` msg-${kind}` : '');
  }

  // Shared by the Welcome page and Settings: validate, then save
  async function submitKey({ input, msg, saveUnchecked, buttons }, onSaved) {
    const key = input.value.trim();
    saveUnchecked.style.display = 'none';
    if (!key) { setMsg(msg, 'Paste your key first.', 'warn'); return; }

    const looksRight = /^[0-9a-f]{32}$/i.test(key);
    setMsg(msg, looksRight ? 'Checking…' : "This doesn't look like a RAWG key (32 letters and numbers). Checking anyway…", 'warn');
    buttons.forEach(b => { b.disabled = true; });
    const result = await API.validateKey(key);
    buttons.forEach(b => { b.disabled = false; });

    const save = async validated => {
      const res = await window.electronAPI.setApiKey(key, { validated });
      if (res?.error) { setMsg(msg, 'Could not save the key: ' + res.error, 'error'); return; }
      API.setKey(key);
      input.value = '';
      saveUnchecked.style.display = 'none';
      setMsg(msg, validated ? 'Key saved.' : 'Key saved without checking.', 'ok');
      onSaved();
    };

    if (result === 'ok') { await save(true); return; }
    if (result === 'offline') {
      setMsg(msg, MESSAGES.offline, 'warn');
      saveUnchecked.style.display = '';
      saveUnchecked.onclick = () => save(false);
      return;
    }
    setMsg(msg, MESSAGES[result] || MESSAGES.error, 'error');
  }

  // ── WELCOME PAGE ──
  function init(opts) {
    onDone = opts.onDone;
    $('btnGetKey').addEventListener('click', () => window.electronAPI.openExternal(RAWG_KEY_PAGE));
    $('btnToggleKey').addEventListener('click', () => {
      const input = $('apiKeyInput');
      input.type = input.type === 'password' ? 'text' : 'password';
    });
    const submit = () => submitKey({
      input: $('apiKeyInput'),
      msg: $('apiKeyMsg'),
      saveUnchecked: $('btnSaveUnchecked'),
      buttons: [$('btnSaveKey'), $('btnSkipKey')]
    }, () => { hide(); onKeySaved(); onDone(); });
    $('btnSaveKey').addEventListener('click', submit);
    $('apiKeyInput').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    $('btnSkipKey').addEventListener('click', () => {
      sessionSkipped = true;
      hide();
      onDone();
    });
  }

  function show() {
    setMsg($('apiKeyMsg'), '');
    $('btnSaveUnchecked').style.display = 'none';
    $('welcomeScreen').style.display = 'flex';
  }

  function hide() { $('welcomeScreen').style.display = 'none'; }

  function isShown() { return $('welcomeScreen').style.display !== 'none'; }

  function wasSkipped() { return sessionSkipped; }

  // ── SETTINGS: KEY SECTION ──
  function initSettings(opts) {
    onKeyRemoved = opts.onKeyRemoved;
    onKeySaved = opts.onKeySaved || (() => {});
    const submit = () => submitKey({
      input: $('settingsKeyInput'),
      msg: $('settingsKeyMsg'),
      saveUnchecked: $('btnSettingsSaveUnchecked'),
      buttons: [$('btnReplaceKey'), $('btnRemoveKey')]
    }, () => { refreshSettings(); onKeySaved(); });
    $('btnReplaceKey').addEventListener('click', submit);
    $('settingsKeyInput').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    $('btnSettingsGetKey').addEventListener('click', () => window.electronAPI.openExternal(RAWG_KEY_PAGE));
    $('btnRemoveKey').addEventListener('click', async () => {
      const ok = await UI.confirm('Remove API key', 'Remove the saved RAWG key? Cached game details stay, but new games will not be looked up until you add a key again.', 'Remove', true);
      if (!ok) return;
      await window.electronAPI.clearApiKey();
      API.setKey(null);
      sessionSkipped = false;
      await refreshSettings();
      onKeyRemoved();
    });
  }

  async function refreshSettings() {
    const s = await window.electronAPI.getApiKeyStatus();
    const labels = { ok: 'Checked ✓', invalid: 'Rejected by RAWG', unchecked: 'Not checked yet' };
    $('keyMasked').textContent = s.hasKey ? s.masked : 'No key saved';
    $('keyCheckState').textContent = s.hasKey ? (labels[s.lastCheckResult] || '') : '';
    $('keyUnencryptedNote').style.display = s.hasKey && !s.encrypted ? '' : 'none';
    $('btnRemoveKey').style.display = s.hasKey ? '' : 'none';
    $('btnReplaceKey').textContent = s.hasKey ? 'Replace key' : 'Save key';
    return s;
  }

  return { init, show, hide, isShown, wasSkipped, initSettings, refreshSettings };
})();
