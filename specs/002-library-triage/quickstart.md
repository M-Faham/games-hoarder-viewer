# Quickstart: Validating Library Triage

**Prerequisite**: feature 001 works (see its [quickstart](../001-apikey-onboarding-portable-exe/quickstart.md)), there is a valid key, and two library folders are saved, *Main* and *External*.
Test data: a wrongly matched folder (for example `Hades` that matches "Hades II"), a folder that doesn't match anything (`zzqx-unknown`), the same game in both library folders (for example `Elden.Ring-v1.0` in Main and `Elden Ring Deluxe` in External), and a folder containing `setup.exe`.

## 0. Unit tests
`npm test` → all tests pass, including query, duplicates, pick, versions, and export.

## US1 Fix match
1. Open `Hades` → **Fix match** → search "Hades" → up to 5 candidates with cover and year → pick "Hades" (2020). The card updates.
2. Restart. It still shows Hades. Delete the `rawg_hades` cache entry (or clear the cache) and restart: it is still Hades.
3. `zzqx-unknown` → Fix match → **Not a game**. It disappears and is listed under Settings → Hidden folders. Restore it and it comes back.
4. On a manually matched game, choose **Reset to automatic**, and the automatic match comes back.
5. Remove the key (or go offline), then open Fix match. The message offers to open Settings.

## US2 Sort & filter
1. Sort by Metacritic, highest first. Games without a score are at the end. The sort applies in all 3 views.
2. Genres RPG + Strategy, years 2015–2023, rating ≥ 4. "X of Y games" is correct, and so is the total size.
3. **Clear filters**: everything is shown again, and the sort is kept. Restart: the sort and filters are as you left them.

## US3 Sizes
1. On first load, cards show "Calculating…" and then their sizes, and the library can be used the whole time. Compare 3 sizes with Explorer's Properties: they are within 1%.
2. Settings → Library Folders shows each folder's total size and the free space on its drive. **Recalculate sizes** works out the sizes again.
3. Restart: sizes appear immediately. Add a file to a game folder and restart: that game's size changes.

## US4 Duplicates
1. Both Elden Ring copies show "2 copies". The **Duplicates only** filter shows them next to each other.
2. The detail view lists both copies with folder name, path, size, and date, each with **Open in Explorer**.
3. Fix the match of one copy to another game, and the badge disappears from both.

## US5 Quick actions
1. Right-click a card, then **Open in Explorer**: Explorer opens with the folder selected. **Copy path** puts the path on the clipboard and shows a toast.
2. A game with `setup.exe`: **Run installer** asks for confirmation, then starts it. A folder with two installers asks you to choose. A folder with none shows the action disabled.
3. A game on an unavailable drive: the actions are disabled and the reason is shown.

## US6 Status
1. Ctrl-click 3 cards, then use the selection bar → **Set status** → Can delete. The labels appear. Filter by Can delete and sort by size: the total size is shown. Restart and the statuses are still there.

## US7 Pick for me
1. Mark 3 games Backlog and click **Pick for me** 10 times: every pick is from those 3. **Reroll** never shows the same game twice in a row.
2. Clear Backlog: picks come from matched games that are not Played or Can delete.

## US8 Update notice
1. Temporarily set `"version": "0.0.1"` in package.json and run `npm start`. A notice shows the latest GitHub release (if one exists). Dismiss it and restart: it doesn't show again.
2. Turn off update checks in Settings: no check is made. Go offline: there's no error and no delay.

## US9 Export
1. Filter to External and export CSV: the row count matches "X of Y". It opens in Excel with names that contain commas and accents shown correctly.
2. Export HTML: it opens in a browser with covers and "Data from RAWG". Paths are not included by default.

## US10 Release readiness
1. "Data from RAWG" appears in the Fix match dialog and in the HTML export, as well as in the places from 001.
2. Searching the README and the app's visible text for "repack" or repack-group names finds nothing.
