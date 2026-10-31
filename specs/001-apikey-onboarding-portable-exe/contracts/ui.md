# Contract: Screens & Controls

**Feature**: [spec.md](../spec.md)

What the user sees and what each control does. Styling follows the existing dark theme in `src/css/style.css`. This contract fixes the elements and their behaviour, not their pixels.

---

## Startup routing

```
launch
  ├─ no key saved & not skipped this session ─▶ Welcome / API Key page
  ├─ roots saved ──────────────────────────────▶ Loading (scan + cache/fetch) ─▶ Library
  └─ no roots ─────────────────────────────────▶ Empty library ("Add Game Folders")
```
"Skip for now" only lasts for the current session (US1-5). The next launch shows the Welcome page again while no key is saved.

---

## 1. Welcome / API Key page  (replaces the current welcome screen's first step)

| Element | Behaviour |
|---|---|
| Heading + one-sentence explanation of why a key is needed | static |
| Numbered steps (1 Create a free RAWG account · 2 Open the API page · 3 Copy the key · 4 Paste it below) | static (FR-002) |
| **Get a free key** button | `openExternal("https://rawg.io/apidocs")` (FR-003) |
| Key input (password-style, with show/hide toggle) | trimmed on submit. A soft warning if it isn't 32 hex characters |
| **Save key** button | runs `API.validateKey` → on `ok`: `setApiKey` and go to the library. On `invalid` / `rate_limited` / `error`: inline message, stay on the page |
| *Save without checking* link | only shown after an `offline` result. Calls `setApiKey(key, {validated:false})` |
| **Skip for now** | goes to the library without a key (FR-004a) |

Inline messages:
- `invalid`: "RAWG didn't accept this key. Check that you copied all of it."
- `offline`: "Couldn't reach RAWG, so the key wasn't checked. Check your connection and try again, or save it without checking."
- `rate_limited`: "RAWG is limiting requests right now. Wait a minute and try again."

---

## 2. Settings panel  (new topbar gear button → modal)

**API key section** (FR-008):
- Shows the masked key and the last check result, or "No key saved".
- **Replace**: the same input and validation as the Welcome page.
- **Remove**: asks for confirmation, calls `clearApiKey`, then shows the Welcome page (US2-3).
- If storage isn't encrypted, adds the note "Stored without encryption on this PC".

**Library Folders section** (FR-018). This is the *Library Folders screen*:

| Column | Content |
|---|---|
| Name | editable inline. Save on Enter or blur. Validation errors show inline (FR-022, FR-023, FR-026) |
| Path | read-only, with a tooltip for long paths |
| Games | number of non-skipped games |
| Status | `Available` / `Unavailable` (FR-021) |
| Action | **Remove**, with confirmation that says cached metadata is kept (FR-019) |

The **Add folders…** button starts the add flow (section 3).

**Hidden folders section** (FR-021b): lists every skipped game folder with its folder name, library folder name, and path, plus a **Restore** button. Restoring sets `skipped:false`, and the game shows up (and is looked up if needed) the next time the library loads. When there are none, it shows "No hidden folders".

**About section** (FR-014b): the app version and the "Data from RAWG" link.

---

## 3. Add-folders flow

1. `pickDirectories()`, with multi-select (FR-015). If cancelled, nothing happens.
2. **Name your folders** dialog: one row per selected path, showing the path and a name input pre-filled with the default (R10).
   - Rows whose path is already saved, or that have no subfolders, show the reason and are left out.
   - **Continue** stays disabled until every remaining row has a valid name (FR-022). Errors are inline per row.
   - **Cancel** adds nothing.
3. `addRoots(...)`, then the existing **Confirm Game Names** screen for the new games (edit or skip), then Search, then Library.

The topbar **Open Folder** button and the empty-library **Add Game Folders** button both start this flow. The confirm screen's **Add More Folders** button runs steps 1 and 2 and then appends to the current confirm list.

---

## 4. Library additions

| Element | Behaviour |
|---|---|
| **Folder badge** on every Grid card, List row, Sidebar item, Detail panel, and Modal | shows the root `name`. Clicking it is not required (FR-024) |
| **Folder filter** (topbar, next to search): a dropdown with one checkbox per root plus "All folders" | selecting folders limits the view to them and combines with text search (FR-025). Saved through `setFolderFilter`. Reachable in 2 clicks (SC-007) |
| Unavailable roots | their games are **shown greyed out** with an "Unavailable" badge and cached details where they exist (FR-021). The filter lists the roots with "(unavailable)", and they can still be selected. A **Hide unavailable** toggle at the bottom of the filter menu (off by default, saved) hides those games (FR-021a) |
| **Data from RAWG** link | a small attribution line in the library footer (Grid, List, and Sidebar views), in the detail panel, and in the modal, which opens `https://rawg.io` through `openExternal` (FR-014b) |
| Not-found game detail text | "No match found for '<search name>'". It does **not** tell the user to rename folders. Feature 002 adds the Fix match action here |
| Uncached game with no key | the card shows the folder name and a "Needs API key" tag instead of "Not found" (FR-004a) |
| New-games toast after launch scan | "N new games added – Review names" opens the confirm screen for those games (R8) |
| Key-rejected banner | shown when any fetch returns `invalid`: "Your RAWG key was rejected – Update key" opens Settings (FR-009) |
