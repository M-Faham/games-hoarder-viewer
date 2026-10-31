# Quickstart: Validating the Feature

**Feature**: [spec.md](./spec.md) · **Contracts**: [contracts/ipc.md](./contracts/ipc.md), [contracts/ui.md](./contracts/ui.md) · **Data**: [data-model.md](./data-model.md)

## Prerequisites

- Windows 10/11, Node.js 18+, and `npm install` already run
- A valid RAWG key (free from https://rawg.io/apidocs) and a deliberately wrong one, for example 32 `0`s
- Test folders:
  ```
  C:\gh-test\A\Elden.Ring-EMPRESS\
  C:\gh-test\A\[DODI] Red Dead Redemption 2 v1.14\
  C:\gh-test\B\Cyberpunk_2077_CODEX\
  C:\gh-test\B\God.of.War-FitGirl\
  C:\gh-test\Empty\                      (no subfolders)
  ```
  plus a USB stick or a `subst X: C:\gh-test\B` mapping to simulate an unplugged drive.

## Reset to a clean profile

```powershell
Remove-Item -Recurse -Force "$env:APPDATA\Games Hoarder Viewer" -ErrorAction SilentlyContinue
```

## 0. Unit tests

```powershell
npm test
```
Expected: all `tests/*.test.js` pass (name validation, nested roots, RAWG classification, reconcile, cleanGameName).

## 1. API key onboarding (US1, US2)

Run `npm start` on a clean profile.

| # | Action | Expected |
|---|---|---|
| 1.1 | Launch | The Welcome / API Key page shows with numbered steps |
| 1.2 | Click **Get a free key** | rawg.io/apidocs opens in the default browser, not in the app |
| 1.3 | Paste the wrong key and press Save | "RAWG didn't accept this key…" appears and nothing is saved (`config.json` has `apiKey: null`) |
| 1.4 | Turn off networking, paste the valid key, press Save | The offline message appears with *Save without checking* |
| 1.5 | Turn networking back on, paste `  <validkey>\n` (with spaces and a newline), press Save | Success, and the library opens. `config.json` → `apiKey.encrypted: true` and `value` is **not** the plain key |
| 1.6 | Restart the app | The Welcome page is skipped |
| 1.7 | Settings → API key | Shows `••••••••xxxx` only |
| 1.8 | Settings → Remove | The Welcome page shows |
| 1.9 | Click **Skip for now** | The library opens. Previously cached games have full metadata, uncached ones say "Needs API key" |
| 1.10 | Restart | The Welcome page shows again (skip lasts one session) |
| 1.11 | Save a valid key, then edit `config.json` to a different valid-looking but wrong plain value with `encrypted:false`, restart, add a new folder | A "key rejected – Update key" banner appears, and the game is **not** cached as "Not found" |

## 2. Multiple named folders (US4)

| # | Action | Expected |
|---|---|---|
| 2.1 | Open Folder → select `A`, `B`, and `Empty` in one dialog | The naming dialog lists A and B pre-filled with "A" and "B". `Empty` is shown as "no games found" and left out |
| 2.2 | Clear the name of B | Continue is disabled and the row shows "Name is required" |
| 2.3 | Name A "Main SSD" and B "main ssd" | Duplicate-name error on B |
| 2.4 | Name B "External", Continue → Confirm names → Search | 4 games appear. Each card shows a "Main SSD" or "External" badge in Grid, List, and Sidebar views and in the modal |
| 2.5 | Folder filter → only "External" | 2 games are shown. Typing "cyber" in search leaves 1 |
| 2.6 | Restart | The library loads with no picking, and the filter is still set |
| 2.7 | Add `C:\gh-test\A` again | "Already included", and nothing changes |
| 2.8 | Create `C:\gh-test\A\Hades-GOG\` and restart | Toast "1 new game added – Review names", and Hades appears under Main SSD |
| 2.9 | Settings → rename "External" to "USB" | Badges and the filter update right away with no loading screen |
| 2.10 | Unplug or remove `X:` (if B was added through X:), then restart | The rest of the library loads. USB's games are still shown, **greyed out with an "Unavailable" badge** and their cached details. Settings shows USB as *Unavailable*, and it stays in the list |
| 2.10a | Folder filter → tick **Hide unavailable**, then restart | USB's games are hidden, and the toggle is still on after the restart |
| 2.10b | Add a folder, **Skip** one game on Confirm names, then Search | The skipped game isn't in the library. Settings → Hidden folders lists it |
| 2.10c | Settings → Hidden folders → **Restore** | The game appears in the library and is no longer listed under Hidden folders |
| 2.11 | Settings → remove "Main SSD" | Its games disappear. The Clear Cache count is unchanged |
| 2.12 | Add `C:\gh-test` itself as a root named "All" while A is saved | `A` is **not** listed as a game under "All" (nested root skip) |
| 2.13 | Name a folder `<img src=x onerror=alert(1)>` | The text shows literally on cards, and no alert appears |
| 2.14 | Look at Grid, List, and Sidebar views, the detail panel, the modal, and Settings → About | Each shows a "Data from RAWG" link that opens rawg.io in the browser |
| 2.15 | Open a game that wasn't found | The text says "No match found for '…'" and doesn't suggest renaming folders |
| 2.16 | Search the README, the app's visible text, and the package.json description for "repack", FitGirl, DODI, CODEX, and EMPRESS, ignoring case | No matches. The README has a "First run on Windows" note about the SmartScreen warning |

## 3. Portable single-file build (US3)

```powershell
npm run build      # Administrator shell OR Developer Mode enabled
Get-ChildItem dist -File -Filter *.exe
```

| # | Action | Expected |
|---|---|---|
| 3.1 | Check `dist\` | Exactly one `Games Hoarder Viewer <version>.exe`. No `Setup` installer |
| 3.2 | Copy only that exe to `C:\elsewhere\` and double-click it | The app launches with no install step (accept SmartScreen *More info → Run anyway*) |
| 3.3 | Settings | Shows the same key, folders, and cache as the `npm start` runs (shared userData, R2) |
| 3.4 | Copy the exe to a read-only location (for example, make the folder read-only) and run it | It launches and saving settings still works |
| 3.5 | Launch the exe 10 times in a row | The key, folders, filter, and cache are kept every time (SC-005) |
