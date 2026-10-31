# Data Model: Library Triage

Extends 001's `config.json` ([001 data model](../001-apikey-onboarding-portable-exe/data-model.md)). All new fields are optional. When loading, any missing field is filled in from the defaults below, so a config from 001 loads without a migration step.

```jsonc
{
  "version": 1,
  "apiKey": { /* 001 */ },
  "roots": [ /* 001 */ ],
  "games": [
    {
      "folderPath": "...", "rootId": "...", "folderName": "...", "searchName": "...",
      "skipped": false,                 // 001 hidden folder == 002 "Not a game"
      "match": null,                    // NEW  { "type": "id", "id": 3498 } | null (automatic)
      "status": null,                   // NEW  null | "backlog" | "installed" | "played" | "delete"
      "addedAt": 1793462400000          // NEW  first time this folder was seen (sort by date added); backfilled with load time
    }
  ],
  "sizes": {                            // NEW  keyed by normalizePath(folderPath)
    "d:\\games\\elden ring": { "bytes": 58291234816, "approx": false, "computedAt": 1793462400000, "fp": "1793..|42|..." }
  },
  "ui": {
    "folderFilter": [], "hideUnavailable": false,          // 001
    "view": {                                              // NEW
      "sort": { "field": "name", "dir": "asc" },          // name|rating|metacritic|year|size|added
      "genres": [], "yearMin": null, "yearMax": null, "ratingMin": null,
      "match": "all", "statuses": [], "duplicatesOnly": false
    },
    "exportPaths": { "csv": true, "html": false }          // NEW
  },
  "update": {                                              // NEW
    "enabled": true, "lastCheckAt": null, "latest": null, "dismissed": null
  }
}
```

## Entities

| Entity | Fields | Rules |
|---|---|---|
| **Game Override** (fields on a `games[]` record) | `match`, `status`, `addedAt`, `skipped` | `match` takes priority over the search name (FR-003). **Reset to automatic** sets `match:null`. **Not a game** sets `skipped:true`. A status is one of the 4 values or `null` (FR-022). Records whose folder disappears are removed by 001's reconciliation, which also drops their overrides. |
| **Size Record** | `bytes`, `approx`, `computedAt`, `fp` | Reused while `fp` is unchanged (FR-012). Removed when its game record is removed. **Recalculate** deletes the entries for one root. |
| **Library View Settings** | `ui.view`, `ui.exportPaths` | Kept across restarts (FR-010). **Clear filters** resets `view` apart from `sort`, and also clears `folderFilter` and the text search. |
| **Update Check State** | `enabled`, `lastCheckAt`, `latest {version,url,notes}`, `dismissed` (version string) | The notice shows when `latest.version > app version` and `latest.version !== dismissed`. |
| **Duplicate Group** (runtime only) | `id → [game]` | Only non-skipped games with `data.id`. Size ≥ 2 (FR-016, FR-018). |

## Runtime-only fields on in-memory game objects

`data`, `dataState`, `fetchError`, `unavailable`, `rootName` (from 001), plus the new `size` (`{bytes, approx}` or `undefined` while calculating), `copies` (number), and `installers` (loaded lazily when the detail view opens).
