# Tasks: API Key Onboarding, Multiple Library Folders & Single-File Portable App

**Input**: Design documents from `specs/001-apikey-onboarding-portable-exe/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ipc.md](./contracts/ipc.md), [contracts/ui.md](./contracts/ui.md), [quickstart.md](./quickstart.md)

**Tests**: Included for the pure shared modules only, as decided in research R12 (`node --test`). UI behaviour is checked manually with [quickstart.md](./quickstart.md).

**Format**: `- [ ] T### [P?] [US#?] Description with file path`
- **[P]**: can run in parallel (different file, no dependency on an unfinished task)
- **[US#]**: user story from spec.md. US1 = key onboarding (P1), US4 = named multi-folders (P1), US2 = key management (P2), US3 = portable exe (P2)

**Conventions for every task**:
- Match the existing code style: IIFE modules (`const X = (() => { … return {…}; })();`), 2-space indent, `$ = id => document.getElementById(id)`.
- Never interpolate unescaped strings into HTML. Use `Render.escapeHtml` (added in T014).
- The renderer has no Node access. Everything that touches the file system or crypto goes through `window.electronAPI` (see contracts/ipc.md).

---

## Phase 1: Setup

- [x] T001 Add `"test": "node --test tests/"` to `scripts` in package.json, and create the empty folders `src/shared/` and `tests/`

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: shared pure logic and its tests, the config store, a stable data path, escaping, and typed RAWG results.

### Shared modules (UMD so the same file works with `require()` in main/tests and with `<script>` in the renderer)

Each file in `src/shared/` uses this wrapper and must not use `require` inside (no Node built-ins):
```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = Object.assign(root.Shared || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () { /* ... */ return { /* exports */ }; });
```

- [x] T002 [P] Create src/shared/paths.js exporting:
  - `normalizePath(p)`: converts `/` to `\`, removes trailing `\` (except on a drive root such as `C:\`), and lowercases.
  - `isSamePath(a, b)`.
  - `basename(p)`: splits on `\` or `/` and ignores a trailing separator.
- [x] T003 [P] Create src/shared/names.js:
  - Move `cleanGameName(name)` here **unchanged** from src/main.js.
  - Add `validateRootName(name, takenNames)`. It trims, then returns `{ ok: true, name }` or `{ ok: false, code }`, where `code` is one of `NAME_REQUIRED`, `NAME_TOO_LONG` (more than 30 characters), or `NAME_TAKEN` (case-insensitive match using `toLocaleLowerCase`).
  - Add `defaultRootName(dirPath, takenNames)`. It returns the basename, or `"<basename> (2)"`, `"(3)"`… until the name is free. If the basename is empty (a drive root like `D:\`), it uses the drive letter, for example `"D:"`.
  - All per research R10.
- [x] T004 [P] Create src/shared/rawg.js exporting `classifyRawgResponse({ networkError, status })`. It returns:
  - `'offline'` if `networkError` is truthy
  - `'invalid'` for 401 or 403
  - `'rate_limited'` for 429
  - `'ok'` for 200–299
  - `'error'` for anything else
  
  Per research R4.
- [x] T005 [P] Create src/shared/reconcile.js exporting `reconcileGames(savedGames, scans, cleanFn)`. Behaviour per data-model.md *Launch reconciliation*:
  - For each scan with `available: true`, compare `entries[].path` (using `isSamePath` logic inlined, or passed in as a 4th argument `samePath`) with the saved games for that root (`rootId === scan.id`).
  - Paths that are new become `{ folderPath, rootId, folderName, searchName: cleanFn(name), skipped: false }`.
  - Saved paths that have vanished are dropped.
  - Games of unavailable roots, and of root ids that aren't in `scans`, are left untouched.
  - Returns `{ games, added: GameRecord[], removedCount }`.
- [x] T006 [P] Create tests/paths.test.js (`node:test` + `node:assert`). Cover: mixed slashes, trailing slash, `C:\` kept, case-insensitive equality, basename with a trailing separator.
- [x] T007 [P] Create tests/names.test.js. Cover:
  - Regression cases from the current README table. These stay in the tests even after T044 rewrites the public README with neutral names, because the test file isn't user-facing: `God.of.War-FitGirl`→`God of War`, `[DODI] Red Dead Redemption 2 v1.14`→`Red Dead Redemption 2`, `Cyberpunk_2077_CODEX`→`Cyberpunk 2077`, `Elden.Ring-EMPRESS`→`Elden Ring`.
  - `validateRootName`: empty, whitespace only, 30 characters (ok), 31 characters (too long), a case-insensitive clash, trimming.
  - `defaultRootName`: suffixing with (2) and (3), and a drive root.
- [x] T008 [P] Create tests/rawg.test.js covering every branch of `classifyRawgResponse`, including 500 → `error` and 204 → `ok`.
- [x] T009 [P] Create tests/reconcile.test.js covering:
  - new, vanished, and known paths
  - an unavailable root's games kept
  - a game whose root id is missing from the scans kept
  - a saved `searchName`/`skipped` preserved for known paths
  - `added` contains only the new paths
- [x] T010 Pin the user-data folder in src/main.js, before `app.whenReady()`:
  - `app.setName('Games Hoarder Viewer')` and `app.setPath('userData', path.join(app.getPath('appData'), 'Games Hoarder Viewer'))`, per research R2.
  - Add a one-time migration: if `<userData>/Local Storage` is missing and `%APPDATA%\games-hoarder-viewer\Local Storage` exists, copy it recursively with `fs.cpSync(src, dst, { recursive: true })` inside try/catch (best effort, before any window is created).
- [x] T011 Create src/config-store.js (CommonJS, main process only), based on data-model.md. It requires `electron` (`app`, `safeStorage`), `fs`, `path`, `./shared/paths`, and `./shared/names`.
  - **File handling**:
    - `load()` reads `<userData>/config.json`. If the file is missing or empty, it returns the defaults `{version:1, apiKey:null, roots:[], games:[], ui:{folderFilter:[]}}`. If the JSON doesn't parse, it renames the file to `config.corrupt-<Date.now()>.json` and returns the defaults.
    - `save(cfg)` writes `config.json.tmp`, then `fs.renameSync` over `config.json`.
    - Keep one in-memory copy that is loaded lazily.
  - **Key functions**:
    - `getKeyStatus()` returns `{hasKey, masked, encrypted, lastCheckResult}`. `masked` is `'••••••••' + last4`.
    - `getPlainKey()` decrypts with `safeStorage.decryptString(Buffer.from(value,'base64'))` when `encrypted` is set, and returns `null` if decryption fails.
    - `setKey(key, validated)` trims. It encrypts if `safeStorage.isEncryptionAvailable()`, otherwise stores plain text with `encrypted:false`. It sets `lastCheckedAt` and sets `lastCheckResult` to `validated ? 'ok' : 'unchecked'`.
    - `markKeyInvalid()` and `clearKey()`.
  - **Root and game functions**:
    - `getLibrary()` returns `{roots, games, ui}` (no apiKey).
    - `addRoots(items)` is all-or-nothing. It validates every item with `validateRootName` against the existing names plus the earlier items in the batch, and checks `PATH_EXISTS` with `isSamePath`. On failure it returns `{error:'validation', code, details:[{index, code}]}`. On success it assigns ids (`'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6)`) and `addedAt`, saves, and returns `{roots}`.
    - `renameRoot(id, name)`.
    - `removeRoot(id)` removes the root, its games, and its id from `ui.folderFilter`.
    - `saveGames(records)` and `setFolderFilter(ids)`.
    - `setHideUnavailable(bool)` saves `ui.hideUnavailable`. When loading, a missing value defaults to `false`.
    - `restoreGame(folderPath)` sets `skipped:false` on the record whose `folderPath` `isSamePath` matches. If there is none, it returns `{error:'not_found'}` (FR-021b).
- [x] T012 In src/main.js:
  - Replace the local `cleanGameName` with `const { cleanGameName } = require('./shared/names');` and delete the old function.
  - Harden `open-external`: parse with `new URL(url)` and only call `shell.openExternal` when `protocol` is `http:` or `https:`. Otherwise, return without doing anything (research R11).
- [x] T013 In src/index.html, add `<script src="shared/paths.js"></script>`, `shared/names.js`, `shared/rawg.js`, and `shared/reconcile.js` **before** `js/api.js`. The CSP `script-src 'self'` already allows them.
- [x] T014 [P] Add `escapeHtml(s)` to src/js/render.js. It maps `& < > " '` to entities, and turns `null`/`undefined` into `''`. Export it. Apply it to **every** interpolated value in `gridCard`, `listItem`, `sidebarItem`, `detailPanel`, `infoRow`, and `modal`, including `game.searchName`, `game.folderPath`, `d.name`, `d.developers`, `d.publishers`, genres, platforms, the description, and the URLs in `src`, `data-url`, and `style="background-image:url('…')"` (research R11).
- [x] T015 Refactor src/js/api.js. Keep the module shape and add a private `let apiKey = null` plus an exported `setKey(k)` and `hasKey()`.
  - `cacheGet` returns `{ data, stale }`. Expired entries return `stale:true` and are **not** deleted. Missing entries return `undefined`.
  - Add a private `rawgFetch(url)` that wraps `fetch`. A thrown error becomes `{ kind:'offline' }`. Otherwise it returns `{ kind: Shared.classifyRawgResponse({status}), res }`.
  - Rewrite `fetchGame(searchName)` to return `{ data, state, error }`:
    1. A fresh cache entry returns `{data, state:'fresh'}`.
    2. With no key, return the stale entry as `{data, state:'stale'}` if there is one, otherwise `{data:null, state:'none', error:'no_key'}`.
    3. Otherwise, run the search, retry, and details calls through `rawgFetch`. If any of them is not `ok`, return the stale entry if there is one, otherwise `{data:null, state:'none', error: kind}`, and **do not cache**.
    4. Cache `null` only when an `ok` search returns empty results.
  - `fetchGameDetails` follows the same rules.
  - Keep `clearCache` and `cacheStats` as they are.
- [x] T016 Update `startSearch()` in src/js/app.js for the new `fetchGame` return shape. Store `data`, `dataState: state`, and `fetchError: error` on each game object, and remove the unused `beforeCount`/`afterCount`/`cacheHits` lines.

**Checkpoint**: `npm test` passes, and `npm start` still scans one folder the old way. The app has no key yet, so games show as unfetched without crashing.

---

## Phase 3: User Story 1 – First-run API key setup (P1) 🎯 MVP

**Goal**: A new user gets from first launch to a working key without editing code, or skips the step.
**Independent test**: quickstart.md §1, steps 1.1–1.6 and 1.9–1.10.

- [x] T017 [US1] In src/main.js, register `ipcMain.handle` for `get-api-key-status`, `get-api-key-for-requests`, `set-api-key` (args `key, opts`), `mark-api-key-invalid`, and `clear-api-key`. Each delegates to src/config-store.js (T011) and returns the shapes in contracts/ipc.md. Wrap each in try/catch, returning `{error: err.message}`.
- [x] T018 [US1] In src/preload.js, expose `getApiKeyStatus`, `getApiKeyForRequests`, `setApiKey(key, opts)`, `markApiKeyInvalid`, and `clearApiKey` on `window.electronAPI`.
- [x] T019 [US1] Extend src/js/api.js:
  - `async init()` calls `window.electronAPI.getApiKeyForRequests()`, then `setKey`.
  - `async validateKey(key)` calls `GET ${BASE}/games?key=<encoded key>&page_size=1` through `rawgFetch` and returns its `kind`.
  - Add an `onKeyRejected(cb)` registry. When any request inside `fetchGame` classifies as `invalid`, call `window.electronAPI.markApiKeyInvalid()` once, then call the registered callbacks.
- [x] T020 [US1] In src/index.html, replace the inner content of `#welcomeScreen` with the Welcome/API Key page from contracts/ui.md §1:
  - a heading and a one-line reason
  - an `<ol>` with the 4 steps
  - button `#btnGetKey` (Get a free key)
  - `<input type="password" id="apiKeyInput">` and a show/hide toggle `#btnToggleKey`
  - `#apiKeyMsg` for messages
  - button `#btnSaveKey`
  - a hidden link-button `#btnSaveUnchecked` (Save without checking)
  - button `#btnSkipKey` (Skip for now)
  
  Add an empty-library state `#emptyLibrary` with button `#btnWelcomePick` (text "Add Game Folders"), keeping that id so existing bindings still work.
- [x] T021 [P] [US1] In src/css/style.css, add styles for the Welcome/API Key page elements (steps list, key input row, message states `.msg-error`, `.msg-warn`, `.msg-ok`) and `#emptyLibrary`, using the existing CSS variables (`--accent`, `--text-2`, `--border`, …).
- [x] T022 [US1] Create src/js/onboarding.js as an IIFE `Onboarding` with `init({ onDone })`, and load it in src/index.html after `render.js` and before `app.js`.
  - `#btnGetKey` calls `electronAPI.openExternal('https://rawg.io/apidocs')`.
  - The toggle switches the input type.
  - `#btnSaveKey` works like this:
    - It trims the input. If the input isn't `/^[0-9a-f]{32}$/i`, show a soft warning but keep going.
    - It disables the buttons and shows "Checking…", then calls `API.validateKey`.
    - On `ok`, it calls `setApiKey(key,{validated:true})`, then `API.setKey(key)`, then `onDone()`.
    - On `invalid`, `rate_limited`, or `error`, it shows the exact messages from contracts/ui.md §1 (use a generic message for `error`).
    - On `offline`, it shows the offline message and unhides `#btnSaveUnchecked`. That button saves with `{validated:false}`, then calls `API.setKey` and `onDone()`.
  - `#btnSkipKey` sets an in-memory `sessionSkipped = true`, then calls `onDone()`.
  - Export `show()`, `hide()`, and `wasSkipped()`.
- [x] T023 [US1] Add startup routing in src/js/app.js. Make `init()` async:
  1. `await API.init()`.
  2. `const status = await electronAPI.getApiKeyStatus()`.
  3. If `!status.hasKey && !Onboarding.wasSkipped()`, show the Welcome page via `Onboarding.show()`. Otherwise call `showLibraryOrEmpty()`.
  
  `Onboarding.init({ onDone: showLibraryOrEmpty })`. For now, `showLibraryOrEmpty()` shows `#emptyLibrary`, or the library views if `games.length > 0`. US4 replaces this with saved-library loading. Remove the old `welcomeScreen.style.display = 'none'` coupling in `showConfirmModal` and hide both `#welcomeScreen` and `#emptyLibrary` there instead.
- [x] T024 [US1] In src/js/render.js, update the `!game.data` branches of `gridCard`, `listItem`, `sidebarItem`, `detailPanel`, and `modal`. When `game.fetchError === 'no_key'`, show a `<span class="not-found-tag needs-key">Needs API key</span>` and the detail text "Add a RAWG API key in Settings to load details". When `game.fetchError` is `offline` or `rate_limited`, show "Couldn't load – try again later". Otherwise keep "Not found". In `detailPanel` and `modal`, replace the old line "Try editing the folder name and rescanning" with "No match found for '<escaped searchName>'". Don't suggest renaming folders; feature 002 adds Fix match here. Add a `.needs-key` style in src/css/style.css.

**Checkpoint**: quickstart §1.1–1.6 and 1.9–1.10 pass. US1 is shippable on its own.

---

## Phase 4: User Story 4 – Manage multiple named library folders (P1)

**Goal**: Pick several directories at once, name each one, have them remembered, rescan them at launch, show a folder badge on every game, and filter by folder.
**Independent test**: quickstart.md §2 (2.1–2.13).

- [x] T025 [US4] In src/main.js:
  - Rename the `pick-directory` handler to `pick-directories`. Use `properties: ['openDirectory', 'multiSelections']`, title "Select your game folders", and return `result.canceled ? [] : result.filePaths`.
  - Change the `read-folders` catch to return `{ error: err.message, code: err.code }`.
  - Add a `scan-roots` handler. For each `configStore.getLibrary().roots`, it runs `readdirSync` (one level, directories only). It excludes entries whose path `isSamePath` to any **other** saved root (research R9), maps entries to `{name, path, cleaned}`, and returns `RootScan[]` per contracts/ipc.md. If one root's read throws, it returns `available:false, entries:[]` for that root.
- [x] T026 [US4] In src/main.js, add handlers for `get-library`, `add-roots` (before calling the store, it checks each path for `NO_SUBFOLDERS` and returns that code in `details` if there are none), `rename-root`, `remove-root`, `save-games`, `set-folder-filter`, `set-hide-unavailable`, and `restore-game`. Each delegates to src/config-store.js.
- [x] T027 [US4] Update src/preload.js. Replace `pickDirectory` with `pickDirectories`, and expose `scanRoots`, `getLibrary`, `addRoots(items)`, `renameRoot(id,name)`, `removeRoot(id)`, `saveGames(records)`, `setFolderFilter(ids)`, `setHideUnavailable(bool)`, and `restoreGame(folderPath)`.
- [x] T028 [US4] Add the following markup to src/index.html (contracts/ui.md §2–4):
  - **Name-folders dialog** `#nameFoldersOverlay`: header "Name your folders", a list `#nameFoldersList`, `#btnNameCancel`, and `#btnNameContinue`.
  - **Settings modal** `#settingsOverlay`, opened by a new gear button `#btnSettings` in `.topbar-right`. It contains:
    - `<section id="settingsKey">` (filled in US2)
    - `<section id="settingsFolders">` with the table `#foldersTable` and button `#btnAddFolders`
    - `<section id="settingsHidden">` with the list `#hiddenList` (FR-021b)
    - `<section id="settingsAbout">` with the app version and a "Data from RAWG" link (FR-014b)
  - **Hide unavailable** toggle: a checkbox `#chkHideUnavailable` at the bottom of `#folderFilterMenu` (FR-021a).
  - **Folder filter** `#folderFilterWrap`: button `#btnFolderFilter` and dropdown `#folderFilterMenu`, placed in `.topbar-center` next to `#searchWrap` and hidden until the library is shown.
  - **Toast**: the existing `.app-toast` element works. Allow an action button by building the toast content as DOM inside `showToast(msg, action)`.
- [x] T029 [P] [US4] In src/css/style.css, add styles for the name-folders dialog rows (path, input, inline `.row-error`), the settings modal, the folders table (status pill `.status-available` / `.status-unavailable`), the folder filter dropdown with checkboxes (greyed-out unavailable rows), the `.folder-badge` pill used on cards and lists and in the sidebar, detail, and modal views, and the toast action button.
- [x] T030 [US4] Create src/js/folders.js as an IIFE `Folders`, and load it in src/index.html after `onboarding.js`. It holds `roots` (saved, plus runtime `available` and `gameCount`) and exposes `init({ onRootsAdded, onRootsChanged, onFilterChanged })`, `setRoots(roots, scans)`, `rootName(id)`, `getFilter()`, `setFilter(ids)`, and `startAddFlow()`.
  - `startAddFlow()`:
    1. `pickDirectories()`. If the result is empty, stop.
    2. For each path, `readFolders(path)`. Mark rows as already saved (`isSamePath` against roots), unreadable, or with no subfolders, and exclude those with a reason.
    3. Render the rows in `#nameFoldersList`, pre-filled with `Shared.defaultRootName(path, takenNames)`, where `takenNames` grows as each row gets its default.
    4. Re-validate all rows live on every input with `Shared.validateRootName`, against saved names plus the other rows. Show the messages "Name is required", "Max 30 characters", and "Name already used". `#btnNameContinue` stays disabled while any row is invalid.
    5. Continue calls `addRoots(items)`. On `{error}`, map `details` back to the rows.
    6. On success, call `onRootsAdded(newRoots, entriesByRootId)`.
    7. Cancel closes the dialog with no changes.
- [x] T031 [US4] In src/js/folders.js, implement the Library Folders section in `#foldersTable`. Each row shows:
  - the name, as an inline `<input>` that saves on Enter or blur using `renameRoot`. On an error it shows the inline message and reverts on Escape. On success it calls `onRootsChanged()`.
  - the path, with a `title` tooltip.
  - `gameCount`.
  - the Available/Unavailable status.
  - a **Remove** button with `confirm("Remove '<name>'? Its games will leave the library. Cached game details are kept.")`. It then calls `removeRoot(id)`, drops the id from the filter, and calls `onRootsChanged()`.
  
  `#btnAddFolders` calls `startAddFlow()`. `#btnSettings` opens `#settingsOverlay`. A close button and Escape close it.

  Also fill in the **Hidden folders** section `#hiddenList` (FR-021b):
  - Take every game record with `skipped:true` from the library passed in through `setRoots(roots, scans, games)` (extend the signature).
  - Each row shows the folder name, the library folder name, and the path (escaped), plus a **Restore** button. Restore calls `restoreGame(folderPath)` and then `onRootsChanged()`.
  - When the list is empty, show "No hidden folders".
  
  The About section shows `Games Hoarder Viewer v<version>` (from a new `getAppVersion` IPC call that returns `app.getVersion()`, added to src/main.js and src/preload.js) and a "Data from RAWG" link that calls `openExternal('https://rawg.io')`.
- [x] T032 [US4] In src/js/folders.js, implement the folder filter:
  - `#btnFolderFilter` toggles `#folderFilterMenu`.
  - The menu has an "All folders" item plus one checkbox per root showing the name and game count. Unavailable roots stay selectable and are labelled "(unavailable)".
  - `#chkHideUnavailable` at the bottom of the menu (off by default) calls `setHideUnavailable(checked)` and then `onFilterChanged()`. Export `getHideUnavailable()`. The initial value comes from `lib.ui.hideUnavailable` (FR-021a).
  - Changing a checkbox runs `setFilter(ids)`, which calls `setFolderFilter(ids)` and `onFilterChanged()`.
  - The button label shows "All folders" or "N folders".
  - Clicking outside closes the menu.
  - Ids of removed roots are dropped automatically. An empty array means all folders.
- [x] T033 [US4] Rework folder adding in src/js/app.js:
  - Delete `pickFolder` and `addMoreFolders`.
  - Bind `#btnPickFolder`, `#btnWelcomePick`, and `#btnAddMoreFolders` to `Folders.startAddFlow()`.
  - `onRootsAdded(newRoots, entriesByRootId)` adds entries to `pendingFolders` with `rootId`, de-duplicated against `games` and `pendingFolders` by `isSamePath`, then calls `showConfirmModal()`.
  - In `showConfirmModal`, store `data-root-id` on each input. Escape all interpolated values with `Render.escapeHtml`.
  - In `startSearch`, keep `rootId` on each game. After the loop, call `electronAPI.saveGames(games.map(({folderPath, rootId, folderName, searchName, skipped}) => …))`.
- [x] T034 [US4] Replace `showLibraryOrEmpty()` in src/js/app.js with a full saved-library load:
  1. `const lib = await getLibrary()`, then `const scans = await scanRoots()`.
  2. `const { games: recs, added } = Shared.reconcileGames(lib.games, scans, Shared.cleanGameName, Shared.isSamePath)`.
  3. `await saveGames(recs)`.
  4. `Folders.setRoots(lib.roots, scans, recs)`, then `Folders.setFilter(lib.ui.folderFilter)` without saving again, and set the Hide unavailable state from `lib.ui.hideUnavailable`.
  5. If there are no roots, show `#emptyLibrary`.
  6. Otherwise show the loading screen and call `API.fetchGame` for each non-skipped record, with the existing progress bar. This includes records whose root is unavailable: those still get cached or stale details, and network fetches for them are fine because metadata doesn't depend on the drive. Set `g.unavailable = true` on games whose root scan has `available:false`. Skip the 100 ms sleep when the result came from cache.
  7. Build `games`, then render.
  8. If `added.length > 0`, show the toast "N new game(s) added" with the action **Review names**. The action loads those entries into `pendingFolders` and calls `showConfirmModal()`. On confirm, `startSearch` updates the existing records instead of appending duplicates: match by `folderPath` and replace.
  
  Games whose root is unavailable are rendered greyed out, unless Hide unavailable is on (see T035).
- [x] T035 [US4] In src/js/app.js:
  - Make `filteredGames()` exclude skipped games, exclude games with `unavailable:true` **only when** `Folders.getHideUnavailable()` is true (FR-021a), apply `Folders.getFilter()` (when it isn't empty, keep games with `rootId` in the filter), and then apply the text search.
  - Attach `rootName = Folders.rootName(g.rootId)` to each game before rendering.
  - Wire `onFilterChanged` and `onRootsChanged` to re-render without rescanning. `onRootsChanged` re-fetches `getLibrary()`, drops games of removed roots from `games`, updates the counts with `Folders.setRoots`, and re-renders (FR-019, FR-026).
  - Show `#folderFilterWrap` together with `#searchWrap`.
- [x] T036 [P] [US4] In src/js/render.js, add a `folderBadge(game)` helper that returns `<span class="folder-badge" title="<escaped folderPath>"><escaped rootName></span>`, or `''` when there is no `rootName`. Insert it in `gridCard` (in `.game-card-meta`), `listItem` (in `.list-sub`), `sidebarItem` (after the name), `detailPanel` (in `.detail-tags`), and `modal` (in `.modal-tags`), for both the found and not-found branches (FR-024).

  Also in src/js/render.js:
  - When `game.unavailable` is true, add the class `is-unavailable` to the card, row, or item root and an `<span class="unavailable-badge">Unavailable</span>` next to the folder badge (FR-021). Add matching styles in src/css/style.css: reduced opacity, greyscale cover, and the badge.
  - Add `attribution()`, which returns `<a href="#" class="rawg-link rawg-attrib" data-url="https://rawg.io">Data from RAWG</a>`. Add it to the end of `detailPanel` and `modal` output (FR-014b).
  
  In src/index.html, add a footer line `<div class="library-attrib">` containing the same link inside each of `#viewGrid`, `#viewList`, and `#viewSidebar`. In src/js/app.js, bind `.rawg-attrib` clicks in those footers to `openExternal`. The existing `.rawg-link` handlers already cover the detail panel and modal.

**Checkpoint**: quickstart §2 passes, and US1 still passes.

---

## Phase 5: User Story 2 – Change or remove the API key later (P2)

**Goal**: View the masked key, replace it, remove it, and be told when RAWG rejects it.
**Independent test**: quickstart.md §1.7, 1.8, 1.11.

- [x] T037 [US2] In src/index.html, fill `<section id="settingsKey">`:
  - `#keyMasked` text and `#keyCheckState` text.
  - `#keyUnencryptedNote` (hidden by default): "Stored without encryption on this PC".
  - `#settingsKeyInput` (password) and `#btnReplaceKey`.
  - `#settingsKeyMsg` and `#btnRemoveKey`.
  
  Also add a banner `#keyRejectedBanner` (hidden) under the topbar with the text "Your RAWG key was rejected" and button `#btnBannerUpdateKey`.
- [x] T038 [US2] In src/js/onboarding.js, add `initSettings({ onKeyRemoved })` and `refreshSettings()`:
  - `refreshSettings()` calls `getApiKeyStatus()` to fill in the masked key, the check state, and the unencrypted note, or "No key saved".
  - Replace runs the same validate-and-save logic as the Welcome page. Extract a shared `submitKey(inputEl, msgEl)` helper used by both, including the offline *Save without checking* path. On success it calls `API.setKey` and hides `#keyRejectedBanner`.
  - Remove runs `confirm()`, then `clearApiKey()`, then `API.setKey(null)`, then `onKeyRemoved()`.
  - The full key never goes into any element's text or value after saving. Clear the input on success (FR-010).
- [x] T039 [US2] In src/js/app.js:
  - Call `Onboarding.initSettings({ onKeyRemoved: () => { closeSettings(); Onboarding.show(); } })`.
  - Call `Onboarding.refreshSettings()` whenever `#settingsOverlay` opens.
  - Register `API.onKeyRejected(() => show #keyRejectedBanner)`.
  - `#btnBannerUpdateKey` opens Settings scrolled to `#settingsKey` (FR-009).
- [x] T040 [P] [US2] In src/css/style.css, add styles for the settings key section and `#keyRejectedBanner`, using the existing `--red`/`--yellow` variables.

**Checkpoint**: quickstart §1.7, 1.8, and 1.11 pass.

---

## Phase 6: User Story 3 – Single-file portable executable (P2)

**Goal**: `npm run build` produces exactly one `.exe` that runs from anywhere with no install step.
**Independent test**: quickstart.md §3 (3.1–3.5).

- [x] T041 [US3] In package.json `build`:
  - Set `"win": { "target": [{ "target": "portable", "arch": ["x64"] }], "icon": "src/assets/icon.ico" }`.
  - Add `"portable": { "artifactName": "${productName} ${version}.exe" }`.
  - Add `"files": ["src/**/*", "package.json"]` so `specs/`, `tests/`, and `.vscode/` are not packaged.
  - Remove nothing else (research R1).
- [ ] T042 [P] [US3] **Not done (no icon file could be produced here).** The `icon` key was removed from `build.win`, so the default Electron icon is used. Add src/assets/icon.ico and `"icon": "src/assets/icon.ico"` under `build.win` to change it. Original task: Add src/assets/icon.ico (a multi-size ICO containing at least a 256×256 image, based on the layered logo in src/index.html using the `--accent` colour). If an ICO can't be produced in this environment, remove the `"icon"` key from `build.win` in package.json instead, and note in README.md that the default Electron icon is used.
- [ ] T043 [US3] **Partly done.** Plain `npm run build` fails on this PC (no symlink privilege, see README). With `npx electron-builder --config.win.signAndEditExecutable=false` it produced exactly one portable exe (`dist/Games Hoarder Viewer 1.0.0.exe`, about 91 MB), and the unpacked app launched without errors. Still to do by hand: a normal `npm run build` as Administrator or in Developer Mode, and quickstart §3.2–3.5 with the real exe. Original task: Run `npm run build` (in an Administrator shell, or with Windows Developer Mode on). Check that `dist/` contains exactly one top-level `.exe` and no `*Setup*.exe`, then work through quickstart.md §3.1–3.5. Record the result in the PR or commit message.

**Checkpoint**: quickstart §3 passes.

---

## Phase 7: Polish & Cross-Cutting

- [x] T044 [P] Update README.md:
  - Replace "Setup step 2" (editing `api.js`) with the in-app key flow.
  - Add a "Library folders" section covering multi-select, required names, the folder badge, the filter, rename/remove, and unavailable drives. It replaces the old "Multiple Folders" section.
  - Change the build section to the portable exe. Mention Developer Mode as the alternative to Administrator.
  - Add a "First run on Windows" note: the app is not code-signed, so Windows may show "Windows protected your PC". Click *More info → Run anyway* (FR-014c).
  - **Neutral wording (FR-014a)**: change the intro to describe a library for local game folders. Remove "repacked" from the intro and the Features list. Rewrite the "Folder Name Cleaning Examples" table with neutral folder names, with no repack-group names: for example `God.of.War-v1.0.2`→`God of War`, `[Backup] Red Dead Redemption 2 v1.14`→`Red Dead Redemption 2`, `Cyberpunk_2077_Complete`→`Cyberpunk 2077`, `Elden.Ring.(2022)`→`Elden Ring`. Check each example against `cleanGameName` and adjust it until the output matches.
  - Add a "Data from RAWG" credit line with a link to https://rawg.io (FR-014b).
  - Add a data-location note: `%APPDATA%\Games Hoarder Viewer`.
  - Update the Project Structure tree for `src/shared/`, `src/config-store.js`, `src/js/onboarding.js`, `src/js/folders.js`, and `tests/`, and rename the root from `game-viewer/` to `games-hoarder-viewer/`.
- [x] T044a [P] Neutral in-app and package wording (FR-014a):
  - In src/index.html, change `.welcome-sub` / empty-library text "Your repacked games library, beautifully organized." to "Your local game library, beautifully organized." and the Confirm screen hint text to neutral wording.
  - In package.json, change `description` to "A Steam-like library browser for your local game folders".
  - Search src/ for user-visible strings that contain "repack", ignoring case, and make them neutral. Leave the regex inside `cleanGameName` alone, because it isn't user-visible.
- [x] T045 [P] Fix the wording in specs/001-apikey-onboarding-portable-exe/spec.md found by the pre-analysis:
  - In Assumptions, change "The existing name-review screen … still appears for newly found games" to say that the review screen appears when folders are added, and that new games found during the launch rescan are added automatically with a *Review names* toast (research R8).
  - In FR-018 and US4, say that the "Library Folders screen" is the Library Folders section of the Settings window.
- [x] T045a Apply the fixes from the `/speckit-analyze` report (2026-10-31) across src/js/app.js, src/js/folders.js, src/js/api.js, src/js/render.js, src/main.js, src/config-store.js:
  - **C1**: in the add flow, drop entries whose path `isSamePath`-matches any saved root or any root in the new batch. On `onRootsAdded`, remove existing games whose `folderPath` equals a new root path.
  - **C2**: after the library loads with no key and ≥1 game lacking cached details, show the toast "N games need an API key" with an action **Add key** that opens Settings.
  - **I1**: add a `mark-api-key-valid` IPC (store sets `lastCheckResult:'ok'`). `api.js` calls it once on the first `ok` response while the status is `unchecked`.
  - **I2**: `Folders.setFilter(ids, { persist = true })`. The initial load passes `persist:false`.
  - **U1**: if the Confirm Game Names screen is cancelled right after roots were added in the same flow, call `removeRoot` for those new roots.
  - **A1**: `reconcileGames` takes `samePath` as a required 4th parameter.
  - **U2**: at startup, show `#keyRejectedBanner` when `lastCheckResult === 'invalid'`.
  - **U3**: remove the inline `onerror` attributes (blocked by the CSP). Add one capture-phase `error` listener on `document` in app.js that hides a failed `<img>` and shows its next placeholder sibling.
  - **U4**: put CSS `url()` values through `encodeURI(u).replace(/'/g,'%27')`.
  - **U5**: `showConfirmModal` keeps the typed names and skip state already on screen when it re-renders.
- [ ] T046 **Partly done.** `npm test` passes (27 tests), and an automated Electron smoke test of the real app passed 34 of 35 checks (the 35th was a test-harness artifact). The remaining quickstart steps need a valid RAWG key, real folder dialogs and a human to look at the UI. Original task: Run `npm test`, then the full quickstart.md (§0–§3) on a clean profile. Fix any failures before marking the feature done.

---

## Dependencies & Execution Order

```
Phase 1 (T001)
   └─▶ Phase 2 Foundational (T002–T016)
          ├─▶ Phase 3 US1 (T017–T024)  🎯 MVP
          │      ├─▶ Phase 4 US4 (T025–T036)   needs T023 routing + T020 empty state
          │      └─▶ Phase 5 US2 (T037–T040)   needs Settings modal from T028 → do after US4 (or pull T028's modal shell forward)
          └─▶ Phase 6 US3 (T041–T043)          independent of US1/US2/US4 — can run any time after Phase 2
                    └─▶ Phase 7 Polish (T044–T046) after all stories
```

**Inside phases**:
- T002–T005 come before T006–T009 (tests import the modules). T011 needs T002 and T003. T015 needs T004 and T013. T016 needs T015.
- US1: T017 → T018 → T019 → (T020 ∥ T021) → T022 → T023 → T024.
- US4: T025 → T026 → T027 → (T028 ∥ T029) → T030 → T031 → T032 → T033 → T034 → T035. T036 [P] can run any time after T014.
- US2: T037 → T038 → T039. T040 [P].
- Files that several tasks edit (app.js, main.js, index.html, style.css) mean tasks without [P] in the same phase must run one after another.

## Parallel Opportunities

- **Phase 2**: T002, T003, T004, T005 together. Then T006, T007, T008, T009 together. T014 alongside any of them.
- **US1**: T021 (CSS) alongside T020/T022.
- **US4**: T029 (CSS) and T036 (render.js) alongside T030–T035.
- **US2**: T040 alongside T037–T039.
- **US3**: the whole phase (T041–T043) can run alongside US1, US4, and US2 once Phase 2 is done. T042 alongside T041.
- **Polish**: T044 alongside T045.

## Implementation Strategy

1. **MVP = Phase 1 + 2 + US1.** The app works for non-developers. Ship or demo here.
2. **+ US4.** Named, saved multi-folder libraries: the biggest everyday improvement.
3. **+ US2.** Key management and the rejected-key banner.
4. **+ US3.** The portable single-exe build. It can be done earlier, alongside the other work.
5. **Polish.** README, spec wording, and a full quickstart pass.

Stop at each **Checkpoint** and run the listed quickstart steps before moving on.
