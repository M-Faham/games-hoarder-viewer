# Research: API Key Onboarding, Multiple Library Folders & Single-File Portable App

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-10-31

Each entry: Decision / Rationale / Alternatives considered.

---

## R1. Single-file portable build

**Decision**: Switch the electron-builder Windows target from `nsis` to `portable` (x64). The output is `dist/Games Hoarder Viewer <version>.exe`.

**Rationale**: The `portable` target produces one self-extracting exe. It unpacks to a temp folder at launch and needs no install step, which meets FR-011 and FR-012. The spec already allows temp extraction (see Assumptions). The current setup already uses electron-builder, so only `package.json` changes.

**Alternatives considered**:
- NSIS one-click installer: still an installer, which Clarification Q1 rejects.
- `zip` / `dir` targets: these produce many files, which fails SC-004.
- Third-party single-exe packers (Enigma Virtual Box and similar): an extra tool and licence for no benefit over `portable`.

**Notes**:
- `win.icon` points at `src/assets/icon.ico`, which does not exist. Either add a real icon at that path or remove the key. Electron-builder then falls back to the default Electron icon. The plan adds an icon file.
- Building on Windows needs symlink privilege when electron-builder unpacks `winCodeSign`. Running as Administrator works, as the README says, and so does turning on Windows Developer Mode. The README update should mention Developer Mode as the alternative that doesn't need an elevated shell.
- The exe is unsigned, so Windows SmartScreen shows "Windows protected your PC" on first run. This is out of scope here (deferred in the clarify step). The README will tell users to click *More info → Run anyway*.

---

## R2. Stable user-data location (dev vs packaged vs portable)

**Decision**: In `main.js`, before `app.whenReady()`, call `app.setName('Games Hoarder Viewer')` and `app.setPath('userData', path.join(app.getPath('appData'), 'Games Hoarder Viewer'))`.

**Rationale**: Electron names `userData` after `productName`/`name` from the packaged `package.json`. Running with `npm start` resolves to `%APPDATA%\games-hoarder-viewer`, while the packaged build resolves to `%APPDATA%\Games Hoarder Viewer`. Pinning the path means dev and packaged runs share one key, folder list, and cache. It also keeps data outside the exe's own folder, so a read-only USB drive still works (FR-013 and that edge case). The portable exe's temp extraction folder changes on every launch, so storing anything next to the extracted app would lose it.

**Alternatives considered**:
- Store beside the exe via `PORTABLE_EXECUTABLE_DIR`: rejected in Clarification Q1 (option C), and it breaks on read-only media.
- Leave the defaults: dev and release data would split silently, which is confusing during testing.

---

## R3. API key storage

**Decision**: The main process stores the key in `<userData>/config.json`, encrypted with Electron `safeStorage.encryptString()` (DPAPI on Windows) and saved as base64. If `safeStorage.isEncryptionAvailable()` is `false`, the key is saved as plain text and marked `"encrypted": false`. The plain key never leaves the main process except through one `getApiKeyForRequests` IPC call, which the renderer uses to make RAWG requests.

**Rationale**: This is Clarification Q3 (option B). `safeStorage` is built into Electron, so no native module is needed. DPAPI ties the ciphertext to the current Windows user, which satisfies FR-006.

**Alternatives considered**:
- `keytar` / Credential Manager: a native module that needs a rebuild per Electron version, and option C was not chosen.
- `localStorage`: plain text, and only readable from the renderer.
- Moving all RAWG calls into the main process so the key never reaches the renderer: a cleaner boundary, but it means rewriting `api.js` and the CSP for little gain. The key is free and read-only, and the renderer is our own code with `contextIsolation` on. This is possible future hardening.

---

## R4. Key validation and error classification

**Decision**: Validate with `GET https://api.rawg.io/api/games?key=<k>&page_size=1`. Classify the result as:

| Outcome | Classification |
|---|---|
| `fetch` throws (network / DNS / CORS-level failure) | `offline` |
| HTTP 401 or 403 | `invalid` |
| HTTP 429 | `rate_limited` |
| HTTP 2xx with a `results` array | `ok` |
| any other status | `error` (shown as "RAWG is having problems, try again later") |

The same classifier wraps every RAWG call in `api.js`. Only `ok` + empty results is cached as "not found". The other cases return a typed error and are never cached. This fixes the existing bug where a 401 on the retry path was cached as `null` for 7 days.

**Rationale**: FR-005, FR-009, SC-003, and the offline and rate-limit edge cases. The request is the cheapest real endpoint, using one result.

**Alternatives considered**: Checking the key format only (RAWG keys are 32 hex characters). This alone can't detect revoked keys. It is still used as a quick pre-check, with a soft warning rather than a block.

**Offline "save anyway"**: When the result is `offline`, the welcome page offers *Save without checking*. The key is saved with `lastCheck: "unchecked"` and validated on the first real fetch (FR-009 then applies).

---

## R5. Multi-directory picker

**Decision**: `dialog.showOpenDialog({ properties: ['openDirectory', 'multiSelections'] })` returns `filePaths[]`.

**Rationale**: It is built in and works on Windows (FR-015).

**Alternatives considered**: A custom in-app folder browser is unnecessary.

---

## R6. Persisting library folders and the game list

**Decision**: Store both in `<userData>/config.json`, which the main process owns. Writes are atomic: write `config.json.tmp`, then `fs.renameSync`. The renderer reads and writes through IPC (see [contracts/ipc.md](./contracts/ipc.md)). The schema is in [data-model.md](./data-model.md).

The game list stores only `folderPath`, `rootId`, `searchName`, and `skipped`, because these are the user's decisions from the review screen. RAWG metadata stays in the existing `localStorage` cache (`rawg_<searchname>`). That cache is under `userData` too, so R2 keeps it stable.

**Rationale**: FR-016 and FR-017, plus the assumption that "games already in the library are not reviewed again". One JSON file is easy to inspect and back up. There will be hundreds of entries at most, so no database is needed.

**Alternatives considered**:
- `electron-store`: a new dependency for something about 40 lines of code can do.
- Keeping folders in `localStorage`: possible, but splits config across two stores while the key must live in the main process anyway.

---

## R7. Cache behaviour without a key or when offline (stale fallback)

**Decision**: `cacheGet` returns expired entries flagged as `stale` instead of deleting them. `fetchGame` uses fresh cache first. Next it tries the network if a key exists. If there is no key, or the fetch fails as `offline`, `rate_limited`, or `error`, it falls back to the stale entry. An entry is only replaced after a successful fetch.

**Rationale**: FR-004a says "cached games MUST load normally" without a key. Before this change, once 7 days passed, an offline or keyless launch would show bare folder names for games the user had already looked up. Clearing the cache still deletes everything.

**Alternatives considered**: Removing the TTL. That loses rating and description updates for no reason.

---

## R8. Launch rescan and new subfolders

**Decision**: At startup, rescan every saved root in the main process (`readdir`, one level deep, as today). The renderer diffs the result against the saved game list:
- **Known** paths keep their saved `searchName` and `skipped` state. No review.
- **New** paths are added automatically using `cleanGameName()` (spec US4 scenario 5). A toast offers "*N new games added – Review names*", which opens the existing confirm screen for just those entries.
- **Vanished** paths (folder deleted) are dropped from the saved game list.
- **Unreachable roots** (`readdir` throws ENOENT/EACCES/ENODEV) are marked `available: false`. Their saved games are kept and **shown greyed out** with an "Unavailable" badge (unless *Hide unavailable* is on), and the Library Folders section shows them as *Unavailable*. They stay visible so that feature 002 can still count duplicates and show disabled quick actions for games on unplugged drives.

When the user adds folders through the picker, the confirm screen is always shown, as today.

**Rationale**: This matches US4 scenario 5 ("added automatically") and the assumption that the review screen is for newly found games, without blocking startup behind a modal.

**Alternatives considered**: Always blocking startup with the review modal when new folders appear. Rejected because it gets in the way of the "0 picking steps" in SC-006.

---

## R9. Nested saved roots

**Decision**: When scanning root A, skip any direct subfolder whose path equals another saved root, comparing case-insensitively with normalised separators. Games are always direct children of a root, so each game path has exactly one parent root. That rules out duplicates and matches "the deeper saved folder wins".

**Rationale**: Without the skip, `D:\Games\Repacks` (itself a root) would also appear as a "game" called "Repacks" under `D:\Games`.

---

## R10. Folder name rules

**Decision**: Trim, then require a length of 1–30. Uniqueness is checked with `toLocaleLowerCase()` across saved roots plus the other names in the same add batch. The default is `path.basename(root)`. If the default clashes, a numeric suffix is added (`Games (2)`). This logic lives in one pure function used by both the add dialog and the rename flow.

---

## R11. HTML escaping (security)

**Decision**: Add `escapeHtml()` to `render.js`. Apply it to every interpolated string from disk, the user, or RAWG: folder labels, folder names, paths, `searchName`, game names, developers, genres, and descriptions. URLs placed in `src` and `data-url` attributes are escaped as attributes.

**Rationale**: User-typed folder labels are now rendered on every card, so a label like `<img onerror=…>` would run script. Other filenames that Windows allows (`&`, `'`) already break markup today.

**Related hardening**: The `open-external` IPC handler will only accept `http:` and `https:` URLs, because the welcome page adds new external links.

---

## R12. Testing approach

**Decision**:
- **Automated**: add `npm test` → `node --test tests/`. Unit tests cover the pure logic that carries the most risk:
  - folder-name validation (R10)
  - root assignment and nested-root skipping (R9)
  - RAWG response classification (R4)
  - launch-diff logic (R8)
  - `cleanGameName` regression cases from the README table
  
  These functions move to small CommonJS-compatible modules that both Node and the renderer can load.
- **Manual / end-to-end**: [quickstart.md](./quickstart.md) has scripted scenarios for onboarding, the portable exe, and multi-folder flows.

**Rationale**: The project has no test setup yet. The built-in `node:test` adds no dependencies, and the risky logic is pure and easy to test. Driving the UI with Playwright-for-Electron is not worth it for a three-file renderer.
