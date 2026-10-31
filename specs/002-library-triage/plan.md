# Implementation Plan: Library Triage & Release Readiness

**Branch**: none (working on `master`, uncommitted) | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)
**Depends on**: [001 plan](../001-apikey-onboarding-portable-exe/plan.md), which must be implemented first.

## Summary

This adds triage tools on top of 001's saved library:
- **Fix match**: manual matches by RAWG id, with a cache keyed by id.
- **Sort and filter**: a pure, unit-tested query function.
- **Disk sizes**: worked out in the background by the main process, using cheap fingerprints.
- **Duplicates**, grouped by RAWG id.
- **Quick actions**: Explorer, installer, and copy path, all checked again in the main process.
- **Status tags** with multi-select.
- **Pick for me**: a weighted random pick.
- **Update check**: GitHub releases, fetched from the main process.
- **Export**: CSV and HTML.
- **Release readiness**: attribution in the new screens.

Design decisions are in [research.md](./research.md), R1–R11.

## Technical Context

**Language/Version**: JavaScript (ES2022); Electron 41.2.1 (Node 24 inside), with Node 22 for tests
**Primary Dependencies**: none added (Electron `shell`, `clipboard`, `dialog`, `net`/`fetch`, `fs.promises.statfs`)
**Storage**: 001's `config.json`, with the new fields from [data-model.md](./data-model.md); the `localStorage` cache gets `rawgid_<id>` entries
**Testing**: `node --test` for `src/shared/{query,dupes,pick,versions,export,fingerprint}.js`; manual [quickstart.md](./quickstart.md)
**Target Platform**: Windows 10/11 x64, portable exe
**Performance Goals**: re-running the query on 300 games takes under 0.5 s (SC-002); sizes don't delay startup (SC-003)
**Constraints**: the CSP stays unchanged, so the update check runs in the main process; the app never deletes or moves game files; installer launches are re-checked in the main process
**Scale/Scope**: about 1,000 games; 10 stories and 34 requirements

## Constitution Check

There is no `.specify/memory/constitution.md`, so the same codebase rules as 001 apply: sandboxed renderer, strict CSP, plain IIFE and UMD scripts, no new dependencies. ✅ All are kept, including after the design work.

## Project Structure

```text
src/
├── main.js            [changed] IPC for overrides, sizes, quick actions, update check, export
├── preload.js         [changed] expose the 002 bridge (contracts/ipc.md)
├── config-store.js    [changed] new fields + defaults; setGameMatch/Skipped/Status, view, sizes, update
├── sizes.js           [new]     background size queue (main process)
├── shared/
│   ├── query.js       [new]     queryLibrary, genre list, clear-filters defaults
│   ├── dupes.js       [new]     duplicateGroups
│   ├── pick.js        [new]     pickGame
│   ├── versions.js    [new]     compareVersions
│   ├── export.js      [new]     toCsv, toHtml, exportRows
│   └── format.js      [new]     formatBytes, fingerprint
├── js/
│   ├── api.js         [changed] searchCandidates, fetchGameById, rawgid_ cache
│   ├── render.js      [changed] size, copies, status, selection, unavailable, quick-action UI
│   ├── triage.js      [new]     toolbar: sort/filter panel, Clear filters, X of Y, Pick for me, Export, selection bar
│   ├── fixmatch.js    [new]     Fix match dialog
│   ├── actions.js     [new]     context menu + detail actions, installers
│   └── app.js         [changed] wiring, sizes, duplicates, update notice
├── index.html / css/style.css   [changed]
tests/ query, dupes, pick, versions, export, format (.test.js)
README.md              [changed] new features, neutral wording kept
```

## Implementation Order

1. **Foundation**: config fields, the shared modules and their tests, and the API id cache.
2. **US1 Fix match** and **US2 Sort & filter** (P1), plus **US10a attribution** in the new screens.
3. **US3 Sizes**, then **US4 Duplicates** (which uses sizes), then **US5 Quick actions** (P2).
4. **US6 Status**, then **US7 Pick for me** (which uses status), then **US8 Update notice**, then **US9 Export** (P3).
5. **Polish**: README, quickstart.

## Risks

| Risk | Mitigation |
|---|---|
| Size calculation on huge or slow drives | Async, one folder at a time, and cancellable. Results are saved, so it continues where it left off |
| Fingerprints miss changes deep inside a folder | Documented; the **Recalculate sizes** action |
| A compromised renderer launches programs | `runInstaller` only allows files that `findInstallers` itself lists for that game folder |
| GitHub API rate limit (60 per hour without a token) | At most one check every 24 h |
