// ═══════════════════════════════════════
// Shared: game-name cleaning + library folder naming rules
// ═══════════════════════════════════════

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = Object.assign(root.Shared || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {

  const ROOT_NAME_MAX = 30;

  // Clean repacker tags from folder name
  function cleanGameName(name) {
    return name
      // Remove content in brackets/parens like [FitGirl], (v1.2), [REPACK]
      .replace(/[\[\(][^\]\)]*[\]\)]/g, '')
      // Underscores and hyphens are separators (done first so "_CODEX" is a separate word)
      .replace(/[_\-]+/g, ' ')
      // Remove version strings like v1.2.3 or 1.0.0
      .replace(/\bv?\d+\.\d+[\.\d]*/g, '')
      // Dots used as separators
      .replace(/\.+/g, ' ')
      // Remove common repacker names
      .replace(/\b(FitGirl|DODI|GOG|Repack|REPACK|rG|ElAmigos|KaOs|Codex|CODEX|PLAZA|CPY|TiNYiSO|SKIDROW|EMPRESS|FLT|RG\s*Mechanics|Mechanics|RePack|repack|Selective|Download)\b/gi, '')
      // Remove extra whitespace
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function lower(s) { return String(s).toLocaleLowerCase(); }

  // → { ok: true, name } | { ok: false, code }
  function validateRootName(name, takenNames) {
    const trimmed = String(name == null ? '' : name).trim();
    if (!trimmed) return { ok: false, code: 'NAME_REQUIRED' };
    if (trimmed.length > ROOT_NAME_MAX) return { ok: false, code: 'NAME_TOO_LONG' };
    const taken = new Set((takenNames || []).map(lower));
    if (taken.has(lower(trimmed))) return { ok: false, code: 'NAME_TAKEN' };
    return { ok: true, name: trimmed };
  }

  function defaultRootName(dirPath, takenNames) {
    const parts = String(dirPath || '').split(/[\\/]+/).filter(Boolean);
    let base = parts.length ? parts[parts.length - 1] : '';
    if (/^[a-z]:$/i.test(base) || !base) base = (base || 'Folder').toUpperCase();
    base = base.slice(0, ROOT_NAME_MAX);
    const taken = new Set((takenNames || []).map(lower));
    if (!taken.has(lower(base))) return base;
    for (let n = 2; ; n++) {
      const suffix = ` (${n})`;
      const candidate = base.slice(0, ROOT_NAME_MAX - suffix.length) + suffix;
      if (!taken.has(lower(candidate))) return candidate;
    }
  }

  return { cleanGameName, validateRootName, defaultRootName, ROOT_NAME_MAX };
});
