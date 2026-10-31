# Contract: IPC additions for 002

These extend [001's bridge](../../001-apikey-onboarding-portable-exe/contracts/ipc.md). Same rules: `invoke` and `handle`, and errors are returned as `{error, code?}`, never thrown.

| Call | Returns | Notes |
|---|---|---|
| `setGameMatch(folderPath, match)` | `{ok}` | `match` is `{type:'id', id}` or `null` (FR-003, FR-005) |
| `setGameSkipped(folderPath, skipped)` | `{ok}` | "Not a game" and Restore (FR-004). 001's `restoreGame` calls this with `false` |
| `setGamesStatus(folderPaths[], status)` | `{ok}` | one call sets the status for several games (FR-022, FR-023) |
| `setViewSettings(view)` | `{ok}` | saves `ui.view` (FR-010) |
| `setExportPaths({csv, html})` | `{ok}` | |
| `startSizeScan({ rootId?, force? })` | `{ok}` | queues the size calculation. With `force`, saved sizes are cleared first (FR-014). Progress arrives through `onSizeProgress` |
| `onSizeProgress(cb)` | – | preload subscription to `size-progress`: `{folderPath, bytes, approx}` events, plus a final `{done:true}` |
| `getSizes()` | `{[normPath]: {bytes, approx}}` | the saved sizes, for an instant first render (FR-012) |
| `getFreeSpace(rootPath)` | `{free}` or `{error}` | (FR-013) |
| `showInFolder(path)` | `{ok}` | |
| `findInstallers(gamePath)` | `string[]` | top-level `*setup*` and `*install*` `.exe`/`.msi` files (FR-020) |
| `runInstaller(gamePath, file)` | `{ok}` or `{error, code:'NOT_ALLOWED'\|'NOT_FOUND'}` | checked again in the main process (R6) |
| `copyText(text)` | `{ok}` | |
| `checkForUpdate({ force? })` | `{update: {version,url,notes} \| null}` | at most once per 24 h unless `force`. Returns `null` when the check is turned off, offline, or there's no newer version (FR-026) |
| `setUpdateSettings({enabled?, dismissed?})` | `{ok}` | (FR-027, FR-028) |
| `saveExport({ format, content, defaultName })` | `{path}` or `{canceled:true}` | runs the save dialog and writes the file (FR-029) |
| `openPath(path)` | `{ok}` | used only for files returned by `saveExport` and checked against the last export path |

The renderer `API` module adds `searchCandidates(term) → {results:[{id,name,released,cover}]} | {error}` (R2) and `fetchGameById(id) → {data,state,error}` (R1).
