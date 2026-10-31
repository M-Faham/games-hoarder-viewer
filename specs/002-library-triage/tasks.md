# Tasks: Library Triage & Release Readiness

**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ipc.md](./contracts/ipc.md), [quickstart.md](./quickstart.md)
**Prerequisite**: all tasks in [001 tasks.md](../001-apikey-onboarding-portable-exe/tasks.md) are done.
**Tests**: `node --test` for the shared pure modules (research R11). The UI is checked manually with quickstart.md.
**Conventions**: the same as 001: IIFE renderer modules, UMD `src/shared/*`, `Render.escapeHtml` on every interpolated value, all file and OS access through `window.electronAPI`.

## Phase 1: Foundational

- [x] T001 Extend src/config-store.js with the 002 fields and defaults from data-model.md:
  - Fill in missing fields when loading: `games[].match/status/addedAt`, `sizes`, `ui.view`, `ui.exportPaths`, `update`.
  - Add `setGameMatch`, `setGameSkipped`, `setGamesStatus`, `setViewSettings`, `setExportPaths`, `getSizes`, `putSize`, `clearSizes(rootId?)`, `getUpdateState`, and `setUpdateState`.
  - `saveGames` keeps existing `match`, `status`, and `addedAt` for known paths, and sets `addedAt = Date.now()` for new ones.
  - Remove size entries whose game record is gone.
- [x] T002 [P] Create src/shared/format.js with `formatBytes(n)` (B/KB/MB/GB/TB, 1 decimal place) and `fingerprint(dirStat, entryStats[])`, which returns the string `${mtimeMs}|${count}|${sumMtime}|${sumSize}`.
- [x] T003 [P] Create src/shared/query.js:
  - `DEFAULT_VIEW` and `allGenres(games)`.
  - `queryLibrary(games, view, ctx)`, where `ctx = {text, rootIds, hideUnavailable}`. It filters per research R3, sorts with missing values last and name as the tie-breaker, and returns `{list, total, shownBytes}`.
  - Sort fields: `name` (`data.name || searchName`), `rating`, `metacritic`, `year` (from `data.released`), `size` (`size.bytes`), `added` (`addedAt`).
- [x] T004 [P] Create src/shared/dupes.js with `duplicateGroups(games)`, which returns a `Map<id, game[]>` containing only groups with 2 or more games, ignoring skipped games and games without `data.id`.
- [x] T005 [P] Create src/shared/pick.js with `pickGame(list, rng = Math.random, excludeKey)`, following research R8. It returns a game or `null`, and compares games by `folderPath`.
- [x] T006 [P] Create src/shared/versions.js with `compareVersions(a, b)`, which strips a leading `v`, compares numeric parts, and treats a missing part as 0.
- [x] T007 [P] Create src/shared/export.js:
  - `exportRows(games, {includePaths})` returns rows with title, folder, path?, size, rating, metacritic, year, genres, status, copies.
  - `toCsv(rows)` adds a BOM, quotes every field, doubles quotes, and uses CRLF.
  - `toHtml(rows, {title})` builds a self-contained page with escaped values, cover images, and a "Data from RAWG" footer link.
- [x] T008 [P] Add tests tests/format.test.js, tests/query.test.js, tests/dupes.test.js, tests/pick.test.js, tests/versions.test.js, and tests/export.test.js covering every rule above. Include missing values sorting last in both directions, AND-combined filters, a seeded RNG preferring Backlog, Reroll exclusion, CSV quoting with a comma, quote, and accented text, and HTML escaping.
- [x] T009 In src/index.html, add `<script>` tags for the new shared modules (before `js/api.js`), and add `js/triage.js`, `js/fixmatch.js`, and `js/actions.js` before `js/app.js`.
- [x] T010 In src/js/api.js:
  - Add the `rawgid_<id>` cache (same TTL and stale fallback).
  - `fetchGame` also writes `rawgid_<data.id>`.
  - Add `fetchGameById(id)` and `searchCandidates(term)` (research R1, R2).

## Phase 2: US1 Fix match (P1)

- [x] T011 [US1] In src/main.js and src/preload.js, add the `set-game-match` and `set-game-skipped` IPC calls. Make 001's `restoreGame` call `setGameSkipped(path, false)`.
- [x] T012 [US1] In src/js/app.js, load each game's data by `match.id` (`API.fetchGameById`) when `match` is set, otherwise by `searchName`.
- [x] T013 [US1] Create src/js/fixmatch.js `FixMatch.open(game, {onChanged})` with the dialog markup in src/index.html and styles in src/css/style.css:
  - A search input, pre-filled with the search name.
  - Up to 5 candidates, each with cover, name, and year. Picking one runs `setGameMatch`, then `onChanged`.
  - A **Not a game** button that runs `setGameSkipped(true)`.
  - A **Reset to automatic** button, shown only when `match` is set.
  - A no-key or offline message with an **Open Settings** button.
  - A "Data from RAWG" footer.
- [x] T014 [US1] In src/js/render.js, add a **Fix match** button to `detailPanel` and `modal` (both the found and not-found branches). Bind it in src/js/app.js.

## Phase 3: US2 Sort & filter (P1)

- [x] T015 [US2] In src/main.js and src/preload.js, add `set-view-settings`. In src/index.html and src/css/style.css, add a toolbar row under the topbar (shown with the library) containing:
  - a sort field select and a direction toggle
  - a **Filters** button that opens a panel with genre checkboxes, year min and max, minimum rating, match state, statuses, and Duplicates only
  - the "X of Y games · N GB" count
  - **Clear filters**
  - **Pick for me** and **Export** buttons (wired in US7 and US9)
- [x] T016 [US2] Create src/js/triage.js `Triage.init({getGames, onChange})`. It owns the view state, builds the genre list from the games, saves changes through `setViewSettings`, and exposes `getView()`, `setView(view)`, and `updateCount(shown, total, bytes)`. Clear filters resets the view apart from sort, and also clears the folder filter (through `Folders.setFilter([])`) and the search input.
- [x] T017 [US2] In src/js/app.js, replace the body of `filteredGames()` with `Shared.queryLibrary(games, Triage.getView(), {text, rootIds: Folders.getFilter(), hideUnavailable: Folders.getHideUnavailable()})`. Update the count, and load the saved `ui.view` at startup.

## Phase 4: US3 Sizes (P2)

- [x] T018 [US3] Create src/sizes.js (main process). It contains a queue with `start({rootId, force}, games, roots, send)`, which:
  - walks each game folder asynchronously, skipping symlinks
  - marks the size approximate on EACCES or EPERM
  - skips the folder when its fingerprint matches the saved one
  - saves each result with `putSize`
  - sends `size-progress` for each folder and `{done:true}` at the end
  - can be cancelled when the app quits (`app.on('before-quit')`)
- [x] T019 [US3] In src/main.js and src/preload.js, add `start-size-scan`, `get-sizes`, `get-free-space`, and the `onSizeProgress` subscription.
- [x] T020 [US3] In src/js/app.js:
  - after loading the library, apply the saved sizes, then call `startSizeScan({})`
  - on each progress event, update that game's `size` and re-render, throttled to at most once every 500 ms
- [x] T021 [US3] In src/js/render.js, show the size (`formatBytes`, with a "≈" prefix when approximate) or "Calculating…" on the card meta, list row, and detail.
- [x] T022 [US3] In src/js/folders.js, add a Size and Free column (from `getFreeSpace`) and a **Recalculate sizes** action per root, which calls `startSizeScan({rootId, force:true})`.

## Phase 5: US4 Duplicates (P2)

- [x] T023 [US4] In src/js/app.js, after loading data and after any match change, run `Shared.duplicateGroups(games)` and set `g.copies`. Make the Duplicates-only filter keep copies next to each other: in `queryLibrary`, when `duplicatesOnly` is set, sort by group id first.
- [x] T024 [US4] In src/js/render.js, add a "N copies" badge on cards, rows, and sidebar items. Add a "Copies" section to `detailPanel` and `modal` listing every copy with its folder name, path, size, and date, and an **Open in Explorer** button for each.

## Phase 6: US5 Quick actions (P2)

- [x] T025 [US5] In src/main.js and src/preload.js, add `show-in-folder`, `find-installers`, `run-installer` (checked again per research R6), and `copy-text`.
- [x] T026 [US5] Create src/js/actions.js `Actions.forGame(game)`, which returns the action list with enabled state and reason. It provides:
  - Open in Explorer
  - Run installer (finds installers lazily, asks for confirmation, lets the user choose when there are several)
  - Copy path, with a toast
  - Fix match
  - Set status
  
  Also add `Actions.showContextMenu(event, game)`, an HTML menu. Bind `contextmenu` on cards, rows, and sidebar items in src/js/app.js. Render an action bar in `detailPanel` and `modal` through `Render.actionsBar(game)`.

## Phase 7: US6 Status (P3)

- [x] T027 [US6] In src/main.js and src/preload.js, add `set-games-status`. In src/js/render.js, add status labels on cards, rows, and sidebar items. Add **Set status** to the context menu and the detail view, with the options Backlog, Installed, Played, Can delete, and Clear.
- [x] T028 [US6] Add multi-select in src/js/app.js (Grid and List): Ctrl-click toggles a card, Shift-click selects a range, and Escape clears the selection. Add a selection bar in src/index.html showing "N selected · Set status · Clear", which calls `setGamesStatus`.

## Phase 8: US7 Pick for me (P3)

- [x] T029 [US7] In src/js/triage.js and src/js/app.js, **Pick for me** calls `Shared.pickGame(currentFilteredList)` and shows a small dialog with the cover, name, and rating, and the buttons **Open**, **Reroll** (excluding the current game, disabled with a tooltip when it's the only option), and **Close**. When nothing can be picked, it explains why.

## Phase 9: US8 Update notice (P3)

- [x] T030 [US8] In src/main.js, add `check-for-update` (GitHub latest release, `User-Agent`, 5 s timeout, at most once every 24 h, silent on errors) and `set-update-settings`. Expose both in src/preload.js.
- [x] T031 [US8] In src/js/app.js and src/index.html, check for updates after startup. If there's a newer version that hasn't been dismissed, show a dismissible notice with the version, release notes, and a **Download** button (`openExternal(url)`). Add an "Check for updates" checkbox in Settings → About.

## Phase 10: US9 Export (P3)

- [x] T032 [US9] In src/main.js and src/preload.js, add `save-export` (save dialog plus write file) and `open-path` (restricted to the last path that was exported), plus `set-export-paths`.
- [x] T033 [US9] In src/js/triage.js, **Export** opens a small dialog with the format (CSV or HTML), an "Include folder paths" checkbox (default per format from `ui.exportPaths`), and an Export button. It builds the rows from the current filtered and sorted list with `Shared.exportRows`, then `toCsv` or `toHtml`, then `saveExport`. On success, a toast offers **Open file** and **Show in folder**.

## Phase 11: US10 & Polish

- [x] T034 [P] [US10] Check that the "Data from RAWG" link appears in the Fix match dialog (T013) and the HTML export (T007). Search src/ and README.md for "repack" or repack-group names in user-visible text, and fix any that appear.
- [x] T035 [P] Update README.md with a "Triage tools" section: Fix match, sort and filter, sizes, duplicates, quick actions, status, Pick for me, update notice, export. Keep the wording neutral.
- [ ] T036 **Partly done.** Tests, syntax checks and the Electron smoke test pass (see 001 T046). Fix match, the update check, export dialogs, Run installer and the context menu have not been tried by hand, because they need a RAWG key or native dialogs. Original task: Run `npm test` and a syntax check of every source file. Launch the app to smoke-test it, and work through quickstart.md as far as possible in this environment.

## Dependencies

Phase 1 comes before everything else. US1 and US2 can be done in either order. US4 needs US3 for sizes (it works without them, showing "Calculating…"). US7 needs US6 statuses. Phases 7–10 are otherwise independent. Polish comes last.
