# Data Model: API Key Onboarding, Multiple Library Folders & Single-File Portable App

**Feature**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

All saved state, except the RAWG metadata cache, lives in one file that the main process owns:

```
%APPDATA%\Games Hoarder Viewer\config.json      ← this document
%APPDATA%\Games Hoarder Viewer\Local Storage\   ← existing rawg_* metadata cache (unchanged location, see R2)
```

---

## config.json (schema version 1)

```jsonc
{
  "version": 1,
  "apiKey": {                     // null when no key is saved
    "value": "<base64 ciphertext | plain key>",
    "encrypted": true,            // false only when safeStorage is unavailable (R3)
    "lastCheckedAt": 1793462400000,  // epoch ms, null if never checked
    "lastCheckResult": "ok"       // "ok" | "invalid" | "unchecked"
  },
  "roots": [                      // Library Folders, in the order they were added
    {
      "id": "r_lz3k9x",           // stable id, generated on add, never reused
      "path": "D:\\Games",        // absolute path as returned by the OS picker
      "name": "Main SSD",         // user-given name
      "addedAt": 1793462400000
    }
  ],
  "games": [                      // user decisions per game folder
    {
      "folderPath": "D:\\Games\\Elden.Ring-EMPRESS",
      "rootId": "r_lz3k9x",
      "folderName": "Elden.Ring-EMPRESS",
      "searchName": "Elden Ring", // edited or cleaned name used for RAWG lookup
      "skipped": false            // true = hidden folder ("Not a game" in feature 002)
    }
  ],
  "ui": {
    "folderFilter": [],           // root ids currently selected in the filter; [] = all
    "hideUnavailable": false      // FR-021a
  }
}
```

A missing, empty, or unparseable file is treated as `{ version: 1, apiKey: null, roots: [], games: [], ui: { folderFilter: [], hideUnavailable: false } }`. When loading, a missing `ui.hideUnavailable` defaults to `false`. A corrupt file is renamed to `config.corrupt-<ts>.json` before it is replaced, so the user's data is never silently lost.

---

## Entities

### ApiKeySetting  (spec: *API Key Setting*)

| Field | Type | Rules |
|---|---|---|
| `value` | string | Trimmed before saving (edge case: whitespace or line breaks). Never sent to the renderer for display. Only the masked form `••••••••XXXX` (last 4 characters) is sent (FR-010). |
| `encrypted` | boolean | Set from `safeStorage.isEncryptionAvailable()` when saving. |
| `lastCheckedAt` | number \| null | Updated on every validation. |
| `lastCheckResult` | `"ok" \| "invalid" \| "unchecked"` | `"unchecked"` = saved through *Save without checking* while offline (R4). Becomes `"invalid"` if a later request returns 401 or 403 (FR-009). |

**Lifecycle**

```
(none) ──save+validate ok──────────▶ ok
(none) ──save offline, unchecked───▶ unchecked ──first fetch ok──▶ ok
ok/unchecked ──RAWG 401/403────────▶ invalid  (user prompted to update, FR-009)
any ──replace──────────────────────▶ ok | unchecked
any ──remove───────────────────────▶ (none)  → welcome page on next render (US2-3)
```

### LibraryFolder  (spec: *Library Folder*; stored as `roots[]`)

| Field | Type | Rules |
|---|---|---|
| `id` | string | `r_` + base36 timestamp + random. Unique. |
| `path` | string | Absolute. Unique when compared case-insensitively after `path.normalize` and removing trailing separators (FR-020). |
| `name` | string | Required. 1–30 characters after trimming. Unique ignoring case (FR-022, FR-023). The default when added is `basename(path)`, with ` (2)`, ` (3)`… added if that clashes (R10). |
| `addedAt` | number | Epoch ms. |
| `available` | boolean | **Runtime only, not saved.** Set by each scan. `false` when `readdir` fails (FR-021). |
| `gameCount` | number | **Runtime only.** Count of non-skipped games with this `rootId` (FR-018). |

**Rules**
- Adding a path that already exists is refused with "already included" (US4-4).
- Adding a directory with zero subfolders is refused with "no games found there" (edge case).
- Removing a folder deletes its `games[]` entries and removes its id from `ui.folderFilter`. The `rawg_*` cache is **not** touched (FR-019).
- Renaming changes only `name`. Cards and the filter re-render with no rescan (FR-026).

### GameEntry  (stored as `games[]`; the in-memory form also carries `data`)

| Field | Type | Rules |
|---|---|---|
| `folderPath` | string | Primary key. Unique across the whole library (FR-020). |
| `rootId` | string | Must match an existing `roots[].id`. The root is always the direct parent of `folderPath` (R9). |
| `folderName` | string | `basename(folderPath)`. |
| `searchName` | string | Defaults to `cleanGameName(folderName)`. Can be edited on the confirm screen. |
| `skipped` | boolean | `true` = **hidden folder** (FR-021b). It is never rendered in the library and never offered for review again. It is listed under Settings → Hidden folders, and restoring it sets `skipped: false`. Feature 002's "Not a game" sets this same flag. |
| `data` | object \| null | **Runtime only.** Comes from the RAWG cache or a fetch. `null` means not found, or no key and no cache. |
| `dataState` | `"fresh" \| "stale" \| "none"` | **Runtime only.** Lets the UI show "metadata needs a key" on uncached games when no key is saved (FR-004a). |

**Launch reconciliation** (R8): for each available root, compare its `readdir` result with the saved `games` for that root:
- a path on disk but not saved → **new**: add it with the cleaned name and count it for the "N new games" toast.
- a path saved but not on disk → **vanished**: remove it from `games`.
- a path on both → **known**: keep it as is.

Games of unavailable roots are left untouched. They are **shown greyed out** with an "Unavailable" badge, using cached details where they exist, unless `ui.hideUnavailable` is `true` (FR-021, FR-021a).

### Folder filter  (`ui.folderFilter`)

- An array of root ids. Empty means no filtering.
- The visible set is games that are not `skipped`, whose `rootId` is in the filter (if the filter isn't empty), that are **not** from an unavailable root when `ui.hideUnavailable` is `true`, **and** that match the text search (FR-025, FR-021a).
- Ids of removed roots are dropped. If the array becomes empty, the filter is cleared (edge case).
- Saved so the filter is still set after a restart.
