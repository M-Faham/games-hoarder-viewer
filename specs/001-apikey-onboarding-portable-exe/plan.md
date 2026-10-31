# Implementation Plan: API Key Onboarding, Multiple Library Folders & Single-File Portable App

**Branch**: `001-apikey-onboarding-portable-exe` (not created; currently on `master`) | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-apikey-onboarding-portable-exe/spec.md`

## Summary

Make the app usable without editing code, and make it remember your setup:

1. **API key onboarding**: a Welcome page that walks through getting a RAWG key, checks it, and stores it encrypted with Electron `safeStorage` (DPAPI) in a main-process `config.json`. A Settings panel lets the user replace or remove it. RAWG errors are classified as `invalid`, `offline`, `rate_limited`, or `error`, so failures are never cached as "not found".
2. **Multiple named library folders**: a multi-select picker, a required unique name for each folder (30 characters or fewer), and saved roots and game decisions in `config.json`. Every root is rescanned at launch. Each card shows a folder badge, and a folder filter combines with search.
3. **Single-file portable exe**: the electron-builder target changes `nsis` → `portable`, with the `userData` path pinned so dev, packaged, and portable runs share one data folder.

Alignment with feature 002 (2026-10-31): games from unavailable folders are shown greyed out (with a *Hide unavailable* toggle) instead of hidden, skipped folders become restorable *hidden folders*, a "Data from RAWG" attribution link is added, and public text uses neutral wording plus an unsigned-build note (FR-014a/b/c, FR-021/a/b).

Supporting changes: a stale-cache fallback, HTML escaping in `render.js`, an `openExternal` URL allow-list, and a `node:test` suite for the pure logic.

## Technical Context

**Language/Version**: JavaScript (ES2022), Node.js 18+ for tooling; Electron ^41.2.1 runtime
**Primary Dependencies**: electron, electron-builder ^26.8.1. **No new runtime dependencies.**
**Storage**: `%APPDATA%\Games Hoarder Viewer\config.json` (new, main-process owned, atomic writes); renderer `localStorage` for the RAWG metadata cache (existing)
**Testing**: `node --test` (built in) for the shared pure modules; manual end-to-end with [quickstart.md](./quickstart.md)
**Target Platform**: Windows 10/11 x64
**Project Type**: Desktop app (Electron: main process + preload + one renderer page)
**Performance Goals**: The library from saved roots is visible within 2 s of launch for 300 fully cached games. The launch rescan is one `readdir` per root.
**Constraints**: One distributable file. Works offline using cached data. The full key never appears in the DOM. `contextIsolation` on, `nodeIntegration` off, and the CSP stays as it is.
**Scale/Scope**: Up to about 20 roots and about 1,000 games. 4 user stories, 26 functional requirements.

No NEEDS CLARIFICATION items remain. All unknowns are resolved in [research.md](./research.md), R1–R12.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` does **not** exist in this repo, so there are no project gates to check. Instead, the plan was checked against the codebase's own rules:

| Rule (from existing code) | Status |
|---|---|
| Renderer is sandboxed (`contextIsolation: true`, `nodeIntegration: false`, preload bridge only) | ✅ Kept. All file and crypto access goes through new IPC handlers |
| Strict CSP (`connect-src https://api.rawg.io`) | ✅ Unchanged. Validation uses the same host |
| Plain-script renderer modules (`API`, `Render`, `App` IIFEs, no bundler) | ✅ Kept. Shared logic uses a small UMD wrapper so it loads through `<script>` and `require()` without a bundler |
| No new dependencies unless needed | ✅ None added |

**Post-design re-check**: ✅ The contracts and data model keep these rules. Optional: run `/speckit-constitution` to formalise them.

## Project Structure

### Documentation (this feature)

```text
specs/001-apikey-onboarding-portable-exe/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0 — decisions R1–R12
├── data-model.md        # Phase 1 — config.json schema & entities
├── quickstart.md        # Phase 1 — validation scenarios
├── contracts/
│   ├── ipc.md           # Phase 1 — preload bridge contract
│   └── ui.md            # Phase 1 — screens & controls contract
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 — created by /speckit-tasks (not by this command)
```

### Source Code (repository root)

```text
src/
├── main.js              # [changed] pin userData; multi-select picker; register new IPC handlers; openExternal allow-list;
│                        #           cleanGameName moved to shared/
├── preload.js           # [changed] expose the API in contracts/ipc.md
├── config-store.js      # [new]     load/save config.json atomically; safeStorage encrypt/decrypt; root & game mutations
├── shared/              # [new]     UMD modules, used by main (require) and renderer (<script>)
│   ├── names.js         #           cleanGameName, validateRootName, defaultRootName
│   ├── paths.js         #           normalizePath, isSameOrNested
│   ├── rawg.js          #           classifyRawgResponse
│   └── reconcile.js     #           reconcileGames(saved, scans) → {games, added, removed}
├── index.html           # [changed] Welcome/API Key page, Settings modal, Name-folders dialog, folder filter, banner; load shared scripts
├── css/style.css        # [changed] styles for the new elements
├── assets/icon.ico      # [new]     app icon (build config already references it)
└── js/
    ├── api.js           # [changed] key from IPC; validateKey; typed results; stale-cache fallback; no caching of errors
    ├── render.js        # [changed] escapeHtml everywhere; folder badge; "Needs API key" state
    ├── onboarding.js    # [new]     Welcome page + key section of Settings
    ├── folders.js       # [new]     add-folders flow, naming dialog, Library Folders section, folder filter
    └── app.js           # [changed] startup routing; load/persist library; launch reconcile; filter in filteredGames()

tests/                   # [new]
├── names.test.js
├── paths.test.js
├── rawg.test.js
└── reconcile.test.js

package.json             # [changed] "test": "node --test tests/"; build.win.target → portable; build.files includes src/**
README.md                # [changed] in-app key setup, multiple named folders, portable build, SmartScreen note, Developer Mode alternative
```

**Structure Decision**: Keep the existing single-project Electron layout. New UI logic goes in two focused renderer modules (`onboarding.js`, `folders.js`) so `app.js` doesn't grow past about 500 lines. Pure logic goes in `src/shared/` so it can be unit-tested in Node without Electron.

## Implementation Order (input for /speckit-tasks)

Each phase can be shipped on its own, following the story priorities:

1. **Foundation**:
   - pin `userData`
   - `config-store.js`
   - `src/shared/*` + tests
   - `escapeHtml` in `render.js`
   - the `openExternal` allow-list
2. **US1, P1 (key onboarding)**:
   - key IPC
   - `API.validateKey` and the typed fetch results
   - the Welcome page
   - startup routing
   - the skip and stale-cache fallback
3. **US4, P1 (named multi-folders)**:
   - the multi-select picker
   - the naming dialog
   - `addRoots`, persistence, and launch reconcile
   - the folder badge and filter
   - the Library Folders section in Settings
4. **US2, P2 (key management)**: the Settings key section, the rejected-key banner, and `markApiKeyInvalid`.
5. **US3, P2 (portable build)**:
   - the `portable` target
   - the icon
   - `build.files`
   - checking that the build is a single exe
   - README
6. **Polish**: run the full [quickstart.md](./quickstart.md) pass.

## Risks

| Risk | Mitigation |
|---|---|
| Existing users lose their in-memory folder list | There's nothing saved today, so there's nothing to migrate. The first launch after the update looks like a fresh start, and the RAWG cache carries over once userData is pinned. Note: `npm start` users' current cache lives in `%APPDATA%\games-hoarder-viewer`. The first launch copies `Local Storage` from there if the new dir has none (a one-time, best-effort migration) |
| `safeStorage` unavailable on some systems | Plain-text fallback plus a visible "Stored without encryption" note (R3) |
| Portable exe start-up is slower (it unpacks to temp on each launch) | Expected with the portable target, typically 1–3 s. Mentioned in the README |
| The build fails without symlink privilege | The README documents running as Admin **or** turning on Developer Mode |
| SmartScreen warning on an unsigned exe | Out of scope. The README explains *Run anyway* |

## Complexity Tracking

No constitution violations to justify.

| Item | Why needed | Simpler alternative rejected because |
|---|---|---|
| UMD wrapper for `src/shared/*` | The same pure logic must run in main (Node `require`) and the sandboxed renderer (`<script>`), and be unit-testable | Duplicating the code in both processes would let validation rules drift apart. Adding a bundler is heavier than a 3-line wrapper |
