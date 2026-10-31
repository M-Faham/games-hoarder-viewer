# Tasks: Reliable Matching, Folder Groups & Folder Tabs

**Input**: [spec.md](./spec.md). Conventions as in 001/002 (escape all HTML, UMD shared modules, IPC through preload).

## Phase 1: Shared logic + tests
- [x] T001 [P] [US1] src/shared/match.js: `normalizeName`, `matchScore(a, b)`, `isGoodMatch`, `bestMatch(searchName, results)` (FR-001, FR-002)
- [x] T002 [P] [US2] src/shared/ignore.js: `matchesIgnore(name, patterns)`, `DEFAULT_IGNORE` (FR-004)
- [x] T003 [P] tests/match.test.js, tests/ignore.test.js (include the user's real folder names)

## Phase 2: US1 matching
- [x] T004 [US1] src/js/api.js: search 5 results, pick `bestMatch`, new cache prefix `rawgm_` so old fuzzy lookups are ignored, `clearCache` clears old keys too (FR-001–003)

## Phase 3: US2 ignore list
- [x] T005 [US2] src/config-store.js: `ignore` list with defaults, `getIgnore`, `setIgnore`
- [x] T006 [US2] src/main.js + src/preload.js: filter ignored names in `readSubfolders`; `set-ignore-list`; `get-library` returns `ignore` (FR-005)
- [x] T007 [US2] Settings section "Ignored folders" (textarea + Save) in src/index.html and src/js/folders.js; app reloads the library after saving

## Phase 4: US4 tabs + US3 groups
- [x] T008 [US4] src/index.html: `#libraryBody` = `#folderTabs` aside + `#libraryViews` (toolbar stays above); remove the top-bar folder dropdown (FR-010)
- [x] T009 [US4] src/js/folders.js: render tabs (name, path, count, size, indent, unavailable, checkbox, solo click, All folders, Hide unavailable), remembered selection (FR-008, FR-009)
- [x] T010 [US3] src/index.html + src/js/app.js: **Scan inside** button on the confirm screen; on continue add those folders as library folders then reload (FR-006)
- [x] T011 [US3] src/js/actions.js + render.js + app.js: **Scan inside…** in the game menu and detail bar, with a name prompt (FR-007)

## Phase 5: US5 cards
- [x] T012 [US5] src/js/render.js: richer Grid card (developer, year, rating, Metacritic, genres, size, folder, description on hover), unmatched card with folder name + **Fix match** button; sidebar item sub-line (FR-011)

## Phase 6: Polish
- [x] T013 CSS in src/css/features.css; README; update smoke test
- [ ] T014 Hand-check with a real key (needs the user)
