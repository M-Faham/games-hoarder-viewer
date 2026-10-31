# Research: Library Triage & Release Readiness

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-10-31
Builds on 001 ([plan](../001-apikey-onboarding-portable-exe/plan.md), [data model](../001-apikey-onboarding-portable-exe/data-model.md)). Each entry: Decision / Rationale / Alternatives considered.

## R1. Manual matches and cache by game id (spec US1, gap 6 from the 001/002 review)
**Decision**: Each game record gets an optional `match` field: `{ type: 'id', id: <rawg id> }` or `null` for automatic. "Not a game" reuses 001's `skipped: true` (hidden folder). RAWG details are also cached under the key `rawgid_<id>`, using the same TTL and stale fallback as 001. `API.fetchGameById(id)` checks that cache first. `fetchGame(searchName)` also writes the `rawgid_` entry whenever it resolves a game.
**Rationale**: FR-003 requires a manual match to keep working after the search-name cache expires. Keying by id makes that possible and lets duplicates share a cache entry.
**Alternatives considered**: Storing the full details object in config.json would make the config file large and the details would go stale.

## R2. Candidate search for Fix match
**Decision**: `GET /games?key=…&search=<term>&page_size=5`. Each result maps to `{id, name, released, cover}` directly from the search payload. That is one request, and the full details are only fetched once the user picks a candidate. Results go through the same `classifyRawgResponse` as 001, so errors show the 001 messages.

## R3. Sorting and filtering
**Decision**: Add a pure `Shared.queryLibrary(games, query, ctx)` in `src/shared/query.js`, unit-tested.
- `query = { sort:{field,dir}, genres[], yearMin, yearMax, ratingMin, match:'all'|'matched'|'unmatched', statuses[], duplicatesOnly, text, rootIds[], hideUnavailable }`.
- Values that are missing always sort last.
- Ties are broken by name, so the order is stable.
- The query lives in `config.ui.view`. 001's `folderFilter` and `hideUnavailable` stay where they are, and **Clear filters** resets the 002 filters plus the folder filter and text search, but keeps the sort and `hideUnavailable` (gap 8).
**Rationale**: SC-002 asks for under 0.5 s on 300 games. A single linear filter plus one sort is about 1 ms. Keeping it pure makes it testable.

## R4. Disk size
**Decision**: The main process works out sizes asynchronously with `fs.promises.readdir/lstat`, walking folders iteratively and skipping symlinks and junctions. It processes one game at a time, sends `size-progress` events `{folderPath, bytes, approx}`, and saves results into `config.sizes[normPath] = {bytes, approx, computedAt, fp}`.
- **Fingerprint** `fp` = the folder's own `mtimeMs`, plus the count and sum of `mtimeMs` and `size` of its top-level entries. This is cheap, and it catches the usual changes (files added, removed, or replaced at the top, or a subfolder renamed). Changes deep inside a subfolder can be missed, which is why **Recalculate sizes** exists (FR-014).
- An `EACCES` or `EPERM` error on any entry marks the size `approx: true` (FR-015).
- A queue job runs after each library load. It is cancelled when the app quits, and it continues on the next launch because already-sized folders are skipped.
- **Free space**: `fs.promises.statfs(rootPath)` → `bavail * bsize`.
**Alternatives considered**: A worker thread. Not needed, because async fs is already off the main thread's event loop in libuv. Using `du`-like native tools would not be portable.

## R5. Duplicates
**Decision**: Worked out on the fly in the renderer: group the non-skipped games by `data.id` (only games with an id). `g.copies = groupSize`. Games from unavailable roots are included (001 now shows them). The pure `Shared.duplicateGroups(games)` is unit-tested.

## R6. Quick actions
**Decision**: New main-process IPC calls:
- `showInFolder(path)` → `shell.showItemInFolder`.
- `findInstallers(path)`: top-level files matching `/(setup|install)[^\\/]*\.(exe|msi)$/i`.
- `runInstaller(gamePath, file)`: checks that `file` is inside `gamePath` and is in that folder's list of installers, then calls `shell.openPath(file)`.
- `copyText(text)` → `clipboard.writeText`.

The renderer shows its own HTML right-click menu (`contextmenu` event), built from the same action list as the detail view.
**Rationale**: Re-checking the installer in the main process stops a compromised renderer from launching any program it likes.

## R7. Status tags and multi-select
**Decision**: Each game record gets `status: null|'backlog'|'installed'|'played'|'delete'`. Multi-select in Grid and List:
- Ctrl-click toggles a card, Shift-click selects a range, and a plain click still opens the modal.
- When something is selected, a selection bar shows "N selected · Set status ▾ · Clear".
- Status changes are saved with `saveGames`.

## R8. Pick for me
**Decision**: Add a pure `Shared.pickGame(games, rng, excludeId)`.
- **Pool**: if any filtered games are Backlog, use those; otherwise use the matched filtered games minus Played and Can delete.
- **Weight** = `1 + (rating || 2.5)`, so a rating of 0–5 gives a weight of 1–6.
- Excluding the current game happens only when the pool has more than one game.

It is tested with a seeded random number generator.

## R9. Update check
**Decision**: The main process calls `https://api.github.com/repos/M-Faham/games-hoarder-viewer/releases/latest` (`User-Agent` set, 5 s timeout), at most once every 24 h. It compares `tag_name` (with the leading `v` stripped) to `app.getVersion()` using a pure `Shared.compareVersions`. The result is `{version, url: html_url, notes: body (first 500 chars)}`. The check state is saved in `config.update`. Fetching from the main process means the renderer's CSP doesn't need to change (conflict 4 from the 001/002 review).

## R10. Export
**Decision**: Add pure generators `Shared.toCsv(rows, opts)` and `Shared.toHtml(rows, opts)`.
- **CSV**: UTF-8 with a BOM, CRLF line endings, every field quoted, and `"` doubled. The BOM makes Excel open non-English characters correctly (FR-031).
- **HTML**: self-contained with inline CSS, every value escaped, covers as `<img src=https…>`, and a "Data from RAWG" footer (FR-032).
- **Saving**: the main process opens the save dialog with `dialog.showSaveDialog` and writes the file.
- **After saving**: a toast offers **Open file** (`shell.openPath`) and **Show in folder**.
- **Path option**: the export dialog has a "Include folder paths" checkbox, defaulting per format from `config.ui.exportPaths = {csv:true, html:false}`.

## R11. Testing
**Decision**: Continue 001's approach with `node --test` unit tests for the new shared modules (query, duplicates, pick, versions, export, fingerprint helper). The UI is checked manually with [quickstart.md](./quickstart.md).
