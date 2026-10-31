# Contract: Preload IPC Bridge (`window.electronAPI`)

**Feature**: [spec.md](../spec.md) · **Data model**: [data-model.md](../data-model.md)

This is the only interface between the renderer (UI) and the main process. Every call is `ipcRenderer.invoke` → `ipcMain.handle` and returns a Promise. Handlers never throw across the bridge. Failures are returned as `{ error: string, code?: string }`.

Legend: **[existing]** unchanged · **[changed]** · **[new]**

---

## Folders & scanning

### `pickDirectories() → Promise<string[]>`  **[changed]** (was `pickDirectory() → string|null`)
Opens the OS folder picker with multi-select (R5). Returns the selected absolute paths, or `[]` if cancelled.

### `readFolders(dirPath) → Promise<FolderEntry[] | {error, code}>`  **[existing]**
`FolderEntry = { name, path, cleaned }`. Lists direct subfolders only. `code` is the Node error code (`ENOENT`, `EACCES`, …) so the caller can mark a root unavailable.

### `scanRoots() → Promise<RootScan[]>`  **[new]**
Scans every saved root in one call at launch and after changes.
```ts
RootScan = {
  id: string, path: string, name: string,
  available: boolean,
  entries: FolderEntry[]     // [] when unavailable; subfolders that are themselves saved roots are excluded (R9)
}
```

---

## Library config

### `getLibrary() → Promise<{ roots: Root[], games: GameRecord[], ui: { folderFilter: string[] } }>`  **[new]**
Returns the saved state without the API key. `Root` and `GameRecord` are as in [data-model.md](../data-model.md), without the runtime-only fields.

### `addRoots(items: { path: string, name: string }[]) → Promise<{ roots: Root[] } | {error, code, details?}>`  **[new]**
Adds all the roots, or none of them (cancelling the naming step adds nothing). Validation runs in the main process with the shared rules (R10):

| code | Meaning |
|---|---|
| `NAME_REQUIRED` | a name is empty after trimming |
| `NAME_TOO_LONG` | longer than 30 characters |
| `NAME_TAKEN` | clashes with a saved root or another item in the batch (ignoring case) |
| `PATH_EXISTS` | the path is already a saved root |
| `NO_SUBFOLDERS` | the directory has no subfolders |

`details` is an array of `{ index, code }` so the naming dialog can mark each row.

### `renameRoot(id, name) → Promise<{ root } | {error, code}>`  **[new]**
Uses the same name validation as above.

### `removeRoot(id) → Promise<{ ok: true }>`  **[new]**
Removes the root and its `games[]` records, and takes it out of `ui.folderFilter`. Does not touch the metadata cache (FR-019).

### `saveGames(records: GameRecord[]) → Promise<{ ok: true }>`  **[new]**
Replaces the whole `games[]` array. Called after the confirm screen and after launch reconciliation.

### `setFolderFilter(rootIds: string[]) → Promise<{ ok: true }>`  **[new]**

### `setHideUnavailable(hide: boolean) → Promise<{ ok: true }>`  **[new]**
Saves `ui.hideUnavailable` (FR-021a).

### `restoreGame(folderPath: string) → Promise<{ ok: true } | {error}>`  **[new]**
Sets `skipped:false` on the matching game record (FR-021b). The renderer reloads the library afterwards.

---

## API key

### `getApiKeyStatus() → Promise<KeyStatus>`  **[new]**
```ts
KeyStatus = {
  hasKey: boolean,
  masked: string | null,          // "••••••••a1b2" — never the full key (FR-010)
  encrypted: boolean,
  lastCheckResult: "ok" | "invalid" | "unchecked" | null
}
```

### `getApiKeyForRequests() → Promise<string | null>`  **[new]**
Returns the plain key for `api.js` to use in RAWG URLs. The renderer keeps it in memory only, inside the `API` module, and must never write it to the DOM.

### `setApiKey(key: string, opts?: { validated: boolean }) → Promise<KeyStatus | {error}>`  **[new]**
Trims and stores the key with the encryption rules in R3. `validated: false` saves it as `"unchecked"` (offline *Save without checking*).

### `markApiKeyInvalid() → Promise<KeyStatus>`  **[new]**
Called by `api.js` when a real request returns 401 or 403 (FR-009).

### `clearApiKey() → Promise<{ ok: true }>`  **[new]**

> Validation itself (the `GET /games?page_size=1` call and its classification) runs in the renderer's `API.validateKey(key)`. See R4. It goes through the same network path as normal fetches, so the CSP stays unchanged.

---

## Misc

### `openExternal(url) → Promise<void>`  **[changed]**
Now refuses anything that isn't `http:` or `https:` (R11).

---

## Renderer module surface (internal, for reference)

| Module | New / changed exports |
|---|---|
| `API` (`src/js/api.js`) | `init()` loads the key through IPC · `validateKey(key) → "ok"\|"invalid"\|"offline"\|"rate_limited"\|"error"` · `fetchGame(name) → { data, state, error? }` (was `data`) · `hasKey()` |
| `Render` (`src/js/render.js`) | every card/item/detail/modal shows `game.rootName` as a folder badge · all text is escaped (R11) |
| `Shared` (`src/shared/*.js`, loaded in both processes) | `cleanGameName`, `validateRootName`, `defaultRootName`, `normalizePath`, `classifyRawgResponse`, `reconcileGames` |
