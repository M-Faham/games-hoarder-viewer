# Feature Specification: Library Triage & Release Readiness

**Feature Branch**: `002-library-triage`
**Created**: 2026-10-31
**Status**: Draft
**Depends on**: [001-apikey-onboarding-portable-exe](../001-apikey-onboarding-portable-exe/spec.md) (saved library folders, folder names and filter, saved per-user settings, portable executable)
**Input**: User description: "create a plan for all of these points". The points are the product review that followed feature 001:
- **Do next**: Fix match · Sort & filter · Disk size · Duplicates · Quick actions
- **Later**: Status tags · Pick something for me · Update notice · Export
- **Before sharing publicly**: RAWG attribution · neutral positioning · code signing
- **Don't do**: cloud sync and accounts · playtime tracking

## Clarifications

### Session 2026-10-31

- Q: Will the app be shared publicly, and should builds be code-signed? → A: Public, unsigned for now. Neutral positioning (US10b) is in scope. The README and release pages explain the Windows warning. Code signing is postponed.

## Overview

Feature 001 makes the app usable. This feature helps the user decide what to do with a large library: **what to play, what to keep, what to delete**. It also gets the app ready to share with other people. Each user story below can be built, tested, and shipped on its own.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fix a wrong or missing match (Priority: P1)

The user sees a card that shows the wrong game, for example "Hades II" for a "Hades" folder, or a card that says "Not found". They choose **Fix match**, type or edit a search term, and see up to 5 candidate games with cover, title, and release year. They pick the right one, or mark the folder as "Not a game". The card updates straight away, and the choice is remembered for that folder from then on.

**Why this priority**: Automatic matching from repack folder names will always fail on some folders. Right now a wrong or missing match can't be fixed, which undermines every other feature (sorting, sizes, duplicates).

**Independent Test**: Take a folder that matches the wrong game and a folder that matches nothing. Fix both from the UI, restart the app, and confirm both keep the chosen game.

**Acceptance Scenarios**:

1. **Given** any game card (matched or not found), **When** the user opens its detail view, **Then** a **Fix match** action is available.
2. **Given** the Fix match dialog is open, **When** the user searches, **Then** up to 5 candidates are shown, each with cover, title, and release year, and the search term starts out as the current search name.
3. **Given** the user picks a candidate, **When** they confirm, **Then** the card shows that game's details right away, and the same game is shown after a restart and after the cached details expire.
4. **Given** the user chooses **Not a game**, **When** they confirm, **Then** the folder is hidden from the library and listed under a "Hidden folders" section in Settings, where it can be restored.
5. **Given** a folder has a manual match, **When** the user chooses **Reset to automatic**, **Then** the manual choice is removed and automatic matching applies again.
6. **Given** no API key is saved or the app is offline, **When** the user opens Fix match, **Then** the dialog explains that searching needs a key and a connection, and offers to open Settings.

---

### User Story 2 - Sort and filter the library (Priority: P1)

The user sorts the library by name, rating, Metacritic score, release year, size, or date added, in ascending or descending order. They can also filter by one or more genres, a release-year range, a minimum rating, and whether a game was matched. These controls work together with the text search and the folder filter from feature 001.

**Why this priority**: "Sort by Metacritic" and "only RPGs" are the fastest ways to find the best games already on disk. All the data is already there.

**Independent Test**: On a library of 20 or more matched games, sort by Metacritic score from highest to lowest, then filter to one genre, and confirm the order and contents are correct. Restart and confirm the sort and filters are still set.

**Acceptance Scenarios**:

1. **Given** the library is shown, **When** the user picks a sort field and direction, **Then** all three views (Grid, List, Sidebar) use that order.
2. **Given** some games have no value for the sort field (for example, no Metacritic score or not matched), **When** sorting by that field, **Then** those games always go at the end, whatever the direction.
3. **Given** the user selects genres "RPG" and "Strategy", **When** the filter is applied, **Then** only games that have at least one of those genres are shown.
4. **Given** the user sets a year range and a minimum rating, **When** they are combined with text search and the folder filter, **Then** only games meeting **all** active conditions are shown.
5. **Given** any filter is active, **When** the user looks at the toolbar, **Then** a visible count shows "X of Y games", and a single **Clear filters** action resets all filters except the sort.
6. **Given** the user restarts the app, **When** the library loads, **Then** the sort and filters are as they left them.

---

### User Story 3 - See disk size per game and per folder (Priority: P2)

Each game shows how much disk space its folder uses. Each library folder in Settings shows its total size and the free space left on its drive. The user can sort by size (US2) to find the biggest space users.

**Why this priority**: Disk space is the main limit for people with big repack collections. Size information is what makes "what to delete" decisions possible.

**Independent Test**: Add a folder with games of known sizes. Confirm each card shows a size within 1% of what Windows Explorer reports, and that the folder total equals the sum of its games.

**Acceptance Scenarios**:

1. **Given** the library has loaded, **When** sizes have not been worked out yet, **Then** the library is fully usable right away, and sizes appear one by one as they are worked out in the background.
2. **Given** a game's size is known, **When** the library is shown, **Then** the card shows it in readable units (for example "54.3 GB").
3. **Given** the Library Folders section of Settings, **When** sizes are known, **Then** each folder shows its total game size and the free space on its drive.
4. **Given** a game folder has not changed since its size was worked out, **When** the app restarts, **Then** the saved size is shown immediately, without working it out again.
5. **Given** a game folder's contents changed, **When** the app next scans, **Then** its size is worked out again.
6. **Given** the user chooses **Recalculate sizes** for a library folder, **When** it is triggered, **Then** sizes for all games in that folder are worked out again.

---

### User Story 4 - Find duplicate copies (Priority: P2)

When two or more folders match the same game, for example an old repack and a newer one on different drives, each of those cards shows a "2 copies" badge. A **Duplicates** filter shows only these games, grouped together. Each copy shows its library folder name, path, and size, so the user can decide which to delete.

**Why this priority**: This builds directly on multiple folders (feature 001) and sizes (US3). It is the quickest way to free a lot of space.

**Independent Test**: Put two differently named folders that both match the same game in two library folders. Confirm both show "2 copies", and that the Duplicates filter groups them with folder name, path, and size.

**Acceptance Scenarios**:

1. **Given** two or more non-hidden folders match the same game, **When** the library is shown, **Then** each of their cards shows a copies badge with the number of copies.
2. **Given** the Duplicates filter is on, **When** the library is shown, **Then** only games with 2 or more copies are listed, with the copies of the same game next to each other.
3. **Given** a duplicate group, **When** the user opens one copy's detail view, **Then** all copies are listed with their library folder name, path, size, and folder date, and each one has an **Open in Explorer** action.
4. **Given** the user fixes the match of one copy so that it no longer matches (US1), **When** the library updates, **Then** the duplicate badges update right away.
5. **Given** folders were not matched to any game, **When** looking for duplicates, **Then** they are never reported as duplicates of each other.

---

### User Story 5 - Quick actions on a game (Priority: P2)

From any game's detail view or right-click menu, the user can **Open in Explorer**, **Run installer** (the game's setup program), or **Copy path**.

**Why this priority**: It turns the app from a viewer into the place where you act on your library, for little effort.

**Independent Test**: For a repack folder that contains `setup.exe`, use each action and confirm Explorer opens at the folder, the setup program starts, and the path is on the clipboard.

**Acceptance Scenarios**:

1. **Given** a game, **When** the user chooses **Open in Explorer**, **Then** Windows Explorer opens with the game folder selected.
2. **Given** the game folder contains exactly one likely installer at its top level, **When** the user chooses **Run installer**, **Then** the app asks for confirmation showing the file name, then starts it.
3. **Given** the folder contains several likely installers, **When** the user chooses **Run installer**, **Then** the app lists them and the user picks one.
4. **Given** the folder contains no likely installer, **When** the user views the actions, **Then** **Run installer** is shown disabled with the tooltip "No installer found".
5. **Given** a game, **When** the user chooses **Copy path**, **Then** the full folder path is copied to the clipboard and a confirmation appears.
6. **Given** the game's library folder is unavailable, **When** the user views the actions, **Then** the actions are disabled with the reason shown.

---

### User Story 6 - Tag games by status (Priority: P3)

The user marks each game with one status: **Backlog**, **Installed**, **Played**, or **Can delete**. The status shows on the card, can be set from the card's right-click menu or the detail view, and can be used as a filter (US2). Several games can be selected and given a status in one go.

**Why this priority**: It turns browsing into sorting the collection out, especially when combined with size and duplicates. It is useful but not needed for the triage loop.

**Independent Test**: Tag 5 games, filter by "Can delete" sorted by size, and confirm the list and the total size shown. Restart and confirm the tags are still there.

**Acceptance Scenarios**:

1. **Given** any game, **When** the user sets a status, **Then** a status label appears on its card in all views, and the status is still there after a restart.
2. **Given** a game has a status, **When** the user chooses **Clear status**, **Then** the label is removed.
3. **Given** the user selects several games (Ctrl/Shift-click in Grid or List view), **When** they set a status, **Then** all selected games get it.
4. **Given** the status filter is set to one or more statuses, **When** combined with other filters, **Then** only matching games show, and the toolbar shows the total size of the shown games.
5. **Given** a game folder is renamed or moved outside the app, **When** the app rescans, **Then** the status is lost for that folder, because it is tied to the folder path. This is noted in Assumptions.

---

### User Story 7 - "Pick something for me" (Priority: P3)

The user clicks **Pick for me** and the app suggests one game. Games marked **Backlog** come first, and games with higher ratings are more likely to be picked. The user can accept the suggestion (which opens its detail view) or **Reroll**.

**Why this priority**: It's a fun, cheap fix for choice paralysis in big libraries, but it isn't core.

**Independent Test**: With 10 matched games, 3 of them in Backlog, pick 30 times and confirm every pick is from the Backlog while one exists, and that higher-rated Backlog games come up more often.

**Acceptance Scenarios**:

1. **Given** at least one Backlog game exists within the current filters, **When** the user clicks **Pick for me**, **Then** the suggestion is always a Backlog game.
2. **Given** no Backlog games exist within the current filters, **When** the user clicks **Pick for me**, **Then** the suggestion comes from all matched games within the current filters, excluding **Played** and **Can delete**.
3. **Given** a suggestion is shown, **When** the user clicks **Reroll**, **Then** a different game is suggested if more than one is eligible.
4. **Given** nothing is eligible, **When** the user clicks **Pick for me**, **Then** a message explains that there is nothing to pick and why.

---

### User Story 8 - Update notice (Priority: P3)

At startup, the app checks once a day whether a newer version has been published. If there is one, it shows an unobtrusive notice with the version number, a short summary of what changed, and a **Download** link that opens the release page in the browser. The user can dismiss the notice for that version or turn update checks off.

**Why this priority**: A portable single-file app has no installer to update it, so users would otherwise stay on old versions forever.

**Independent Test**: Publish a newer version number than the running app and confirm the notice appears with the right version and opens the release page. Dismiss it and confirm it doesn't come back for that version.

**Acceptance Scenarios**:

1. **Given** a newer version is published, **When** the app starts and no check has run in the last 24 hours, **Then** a notice shows the new version and a **Download** link.
2. **Given** the user dismisses the notice, **When** the app restarts, **Then** the notice does not appear again for that version, but does for a later one.
3. **Given** update checks are turned off in Settings, **When** the app starts, **Then** no check is made.
4. **Given** the app is offline or the check fails, **When** the app starts, **Then** nothing is shown and the app works normally.
5. **Given** a newer version exists, **When** the user clicks **Download**, **Then** the release page opens in the default browser. The app never downloads or installs anything itself.

---

### User Story 9 - Export the library (Priority: P3)

The user exports the current library view, with the active filters and sort, to a **spreadsheet file (CSV)** or a **shareable page (HTML)**. The export includes title, library folder name, path, size, rating, Metacritic score, release year, genres, status, and copy count.

**Why this priority**: People like sharing their collection lists, and it doubles as a simple backup of their sorting decisions. Nice to have.

**Independent Test**: Filter to one library folder, export both formats, and confirm the row count matches the "X of Y" count. Check that the CSV opens correctly in a spreadsheet program, including titles with commas and non-English characters, and that the HTML page opens and shows covers.

**Acceptance Scenarios**:

1. **Given** filters are active, **When** the user exports, **Then** only the games currently shown are exported, in the current sort order.
2. **Given** an export to CSV, **When** it is opened in a spreadsheet program, **Then** every column lines up and non-English characters show correctly.
3. **Given** an export to HTML, **When** it is opened in a browser with no app running, **Then** it shows a readable list with covers (loaded from the internet) and the source attribution required by US10.
4. **Given** the user chooses where to save, **When** the export finishes, **Then** a confirmation offers **Open file** and **Show in folder**.
5. **Given** the export setting "Include folder paths" is off, **When** exporting, **Then** paths are left out (so drive layout isn't shared by accident). This setting is **off by default for HTML** and **on by default for CSV**.

---

### User Story 10 - Get ready for public release (Priority: P1 for attribution · P3 for the rest)

Before sharing the app with people beyond the author:
- **(a) Data-source attribution:** anywhere game data from RAWG is shown, a visible "Data from RAWG" link is shown too, as the data provider's terms require.
- **(b) Neutral positioning:** the app's name, description, and documentation describe it as a library for local game folders. Repack-group names are not used in marketing text, though name cleaning still works.
- **(c) Unsigned-build guidance:** the app is shared publicly without code signing, so new users are told in advance about the Windows warning and how to get past it.

**Why this priority**: Attribution is a condition of using the data source and costs very little, so it is P1. Positioning and the unsigned-build guidance matter for public distribution, so they are P3.

**Independent Test**: (a) Every screen that shows game data has a working "Data from RAWG" link. (b) The README, app description, and in-app text contain no repack-group names. (c) The README and release-page template contain the warning explanation and the *More info → Run anyway* steps.

**Acceptance Scenarios**:

1. **Given** any view that shows game data (all three library views, detail panel, modal, Fix match dialog, HTML export), **When** it is shown, **Then** a visible "Data from RAWG" link is present and opens the RAWG website in the browser.
2. **Given** the README, app description, and in-app text, **When** they are reviewed, **Then** they describe the product as a library for local game folders and do not mention repack groups by name.
3. **Given** a release build, **When** a new user downloads and opens it on a clean Windows PC, **Then** the README and release page explain in advance that Windows may show an "unrecognised app" warning and how to get past it (*More info → Run anyway*). Builds are **not** code-signed in this feature.

---

### Edge Cases

- **Fix match when RAWG returns nothing**: the dialog shows "No results" and suggests a shorter search term. The user can still choose **Not a game**.
- **The same game matched manually in two folders**: both count as duplicates (US4). That is intended.
- **Size calculation on a very large or slow drive** (network share, USB 2): it runs in the background, never freezes the UI, shows "Calculating…" per card, and can be cancelled by closing the app. It resumes on the next launch.
- **Access denied on some files inside a game folder**: the size counts everything it can read and is marked "≈" (approximate).
- **A library folder becomes unavailable while sizes are being worked out**: its remaining games are skipped, and the saved sizes are kept.
- **Run installer on a folder whose installer was deleted after scanning**: the app shows "Installer not found" and refreshes that game's actions.
- **Sorting by size before sizes are known**: games with unknown size go to the end (same rule as US2-2).
- **Pick for me when the only eligible game is the one being shown**: Reroll is disabled with the tooltip "No other games match".
- **Export file name already exists**: the standard Windows save dialog asks before overwriting.
- **The update check returns a version older than or equal to the running one**: no notice is shown.
- **The user deletes a game folder outside the app**: on the next scan its status, manual match, and saved size are removed with it, following the feature 001 rules for folders that disappear.

## Requirements *(mandatory)*

### Functional Requirements

**Fix match (US1)**

- **FR-001**: Every game detail view MUST offer a **Fix match** action, including games that weren't found.
- **FR-002**: Fix match MUST let the user edit the search term and MUST show up to 5 candidates, each with cover, title, and release year.
- **FR-003**: A chosen match MUST be saved per game folder and MUST take priority over automatic matching across restarts and after cached details expire.
- **FR-004**: The user MUST be able to mark a folder as **Not a game**. That hides it from the library and lists it under "Hidden folders" in Settings, from where it can be restored.
- **FR-005**: The user MUST be able to **Reset to automatic** for any folder that has a manual match.

**Sort & filter (US2)**

- **FR-006**: The library MUST support sorting by name, rating, Metacritic score, release year, size, and date added, ascending or descending. Games without a value for the sort field MUST always go last.
- **FR-007**: The library MUST support filtering by genres (any of the selected ones), release-year range, minimum rating, match state (matched / not matched), status (US6), and **Duplicates only** (US4).
- **FR-008**: All filters MUST combine with each other and with the text search and folder filter from feature 001, using AND logic between filter types.
- **FR-009**: When any filter is active, the toolbar MUST show "X of Y games" and the total size of the shown games where known. It MUST also offer one **Clear filters** action that keeps the sort.
- **FR-010**: Sort and filter settings MUST be kept across restarts.

**Disk size (US3)**

- **FR-011**: The app MUST work out the disk size of each game folder in the background, without blocking use of the library.
- **FR-012**: Sizes MUST be saved and reused while the folder hasn't changed, and worked out again when it has.
- **FR-013**: The Library Folders section MUST show each folder's total game size and the free space on its drive.
- **FR-014**: The user MUST be able to recalculate sizes for one library folder on demand.
- **FR-015**: Sizes that include unreadable files MUST be marked approximate.

**Duplicates (US4)**

- **FR-016**: Games in two or more non-hidden folders that are matched to the same game MUST show a copies badge with the number of copies.
- **FR-017**: The detail view of a duplicated game MUST list every copy with its library folder name, path, size, and folder date, plus an **Open in Explorer** action for each.
- **FR-018**: Folders that weren't matched MUST NOT be reported as duplicates.

**Quick actions (US5)**

- **FR-019**: Each game MUST offer **Open in Explorer** (with the folder selected), **Run installer**, and **Copy path**, from its detail view and from a right-click menu on its card.
- **FR-020**: **Run installer** MUST only look at the game folder's top level, MUST ask for confirmation showing the file name before starting it, and MUST let the user choose when there is more than one candidate. A "likely installer" is a program file whose name contains "setup" or "install", ignoring case.
- **FR-021**: Quick actions MUST be disabled, with the reason shown, when the game's library folder is unavailable or no installer is found.

**Status tags (US6)**

- **FR-022**: Each game MUST be able to have at most one status out of **Backlog**, **Installed**, **Played**, and **Can delete**. The status MUST be saved per game folder and kept across restarts.
- **FR-023**: The status MUST show on cards in all three views and MUST be settable from the right-click menu, the detail view, and for several selected games at once.

**Pick for me (US7)**

- **FR-024**: **Pick for me** MUST choose only from games that pass the current filters, MUST prefer Backlog games when any exist, MUST exclude **Played** and **Can delete** when falling back, and MUST make higher-rated games more likely to be picked.
- **FR-025**: The suggestion MUST offer **Open** and **Reroll**. Reroll MUST NOT repeat the current suggestion when another eligible game exists.

**Update notice (US8)**

- **FR-026**: The app MUST check for a newer published version at most once every 24 hours. It MUST do so quietly, and MUST NOT delay startup or show errors when the check fails.
- **FR-027**: When a newer version exists, the app MUST show a notice that can be dismissed, with the version, a short summary of changes, and a link to the release page that opens in the browser. Dismissing it MUST hide that version only.
- **FR-028**: Update checks MUST be possible to turn off in Settings. The app MUST NOT download or install updates itself.

**Export (US9)**

- **FR-029**: The user MUST be able to export the current library view (filters and sort applied) to CSV and to a self-contained HTML page.
- **FR-030**: Exports MUST include title, library folder name, size, rating, Metacritic score, release year, genres, status, and copy count. Folder paths MUST be optional: off by default for HTML, on by default for CSV.
- **FR-031**: CSV exports MUST open correctly in common spreadsheet programs, including titles with commas, quotes, and non-English characters.

**Release readiness (US10)**

- **FR-032**: Every view that shows game data from RAWG, including exports, MUST show a visible "Data from RAWG" link to the RAWG website.
- **FR-033**: The README, app description, and in-app text MUST describe the product as a library for local game folders, and MUST NOT name repack groups in marketing or description text. The name-cleaning behaviour is unchanged.
- **FR-034**: The app is distributed publicly **unsigned**. The README and every release page MUST explain the Windows "unrecognised app" warning and the steps to run the app anyway. Code signing is postponed (see Out of Scope).

### Key Entities

- **Game Override**: user decisions saved per game folder (folder path is the key). It holds the manual match (chosen game id, or "Not a game"), the status (none, Backlog, Installed, Played, or Can delete), and when it was last changed. It extends the game entries from feature 001.
- **Size Record**: per game folder. It holds the size in bytes, whether the size is approximate, when it was worked out, and a fingerprint of the folder used to tell whether it changed.
- **Library View Settings**: the saved sort field and direction, genre selection, year range, minimum rating, match-state, status and duplicates filters, and the export path preferences.
- **Update Check State**: when the last check ran, the newest version seen, the version the user dismissed, and whether checks are on.
- **Duplicate Group**: worked out on the fly, not saved. It is the set of non-hidden game folders that share the same matched game id.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can correct a wrong match in under 30 seconds, and 100% of corrections are still there after a restart and after cached details expire.
- **SC-002**: In a library of 300 games, changing any sort or filter updates the visible list in under half a second.
- **SC-003**: With sizes not yet known, the library becomes usable as fast as without this feature (no added startup delay). Sizes for 300 games on a local SSD are all shown within 2 minutes.
- **SC-004**: Shown sizes are within 1% of the size Windows Explorer reports for the same folder.
- **SC-005**: Every game matched in 2 or more folders is flagged as a duplicate, and folders that weren't matched are never flagged (0 false positives in the test library).
- **SC-006**: A user can go from "I want to free space" to a list of **Can delete** games and duplicates sorted by size, with the total size shown, in 3 clicks or fewer.
- **SC-007**: A CSV export of 300 games opens in a spreadsheet program with 0 misaligned rows or garbled characters.
- **SC-008**: 100% of screens and exports that show RAWG data show the attribution link.
- **SC-009**: A failed or offline update check adds 0 seconds to startup and shows no error.

## Assumptions

- Feature 001 is done first. This feature builds on its saved per-user settings, library folders, folder names and filter, the API key, and its folder-rescan rules.
- Manual matches, statuses, and sizes are tied to the **game folder path**. Renaming or moving a folder outside the app loses them. Following data across renames is out of scope.
- "Likely installer" means a program file at the top level of the game folder whose name contains "setup" or "install". Archives (.zip, .rar, .iso) are not opened or mounted.
- The app never deletes, moves, or changes game folders. "Can delete" is only a label, and the user deletes files themselves using Open in Explorer.
- Sizes count every file inside the game folder, including all subfolders.
- Pick for me uses the rating as its weight. Games without a rating get a neutral middle weight.
- The update check reads the project's public release listing. The app is published there along with release notes.
- The HTML export loads cover images from the internet when it is opened. It does not embed them.
- Status values are a fixed list of four. Custom tags are out of scope.
- **Already delivered by feature 001** (aligned 2026-10-31):
  - The "Hidden folders" list in Settings and its Restore action. Skipping a folder on the confirm screen in 001 is the same as **Not a game** here, and US1 adds a second way into the same list.
  - Games from unavailable library folders are shown greyed out rather than hidden. That is why US4 duplicates and US5 disabled actions can work for them.
  - The "Data from RAWG" link on the library, detail, modal, and About screens. US10a only needs to add it to the new screens (Fix match dialog, HTML export).
  - Neutral README and in-app wording, and the unsigned-build note. US10b and US10c only need to keep new text in line with them.

## Out of Scope

- Cloud sync, user accounts, or sharing state across devices.
- Playtime tracking or detecting running games.
- Downloading or installing app updates automatically.
- Deleting, moving, or renaming game folders from inside the app.
- Opening or mounting archives or disk images to look for installers.
- Custom or user-defined tags.
- Code signing, paid or through a free open-source programme. It is postponed until there is real public demand (Clarification Q1).
