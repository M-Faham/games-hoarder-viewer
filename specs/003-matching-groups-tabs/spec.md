# Feature Specification: Reliable Matching, Folder Groups & Folder Tabs

**Feature Branch**: `003-matching-groups-tabs` (none created; working on `master`)
**Created**: 2026-10-31
**Status**: Draft
**Depends on**: [001](../001-apikey-onboarding-portable-exe/spec.md), [002](../002-library-triage/spec.md)
**Input**: User report: a library folder `D:\Repacks` holds games plus other folders. `0 - torrent-temp` (a download temp folder) was shown as "Torrent Tycoon", and `0 - PC` (a folder holding more games) was shown as "Resident Evil 0". Requests: (1) treat such folders properly, with groups set per directory; (2) show all library folders as tabs on the side, all selected by default, each showing its name with its path underneath; (3) put more information on the game card, which "seems useless".

## User Scenarios & Testing

### User Story 1 - Wrong matches are not shown as fact (Priority: P1)
When RAWG's best result does not resemble the folder name, the game shows as "Not found" instead of a wrong game. When several RAWG results come back, the closest one is used.

**Independent Test**: A folder called `0 - torrent-temp` shows "Not found", not "Torrent Tycoon". `0 - PC` shows "Not found", not "Resident Evil 0". `Grand Theft Auto V Enhanced` still matches "Grand Theft Auto V".

**Acceptance Scenarios**:
1. **Given** a folder name whose cleaned form shares fewer than half of its words with RAWG's best result, **When** it is looked up, **Then** it shows "Not found" and Fix match is available.
2. **Given** RAWG returns several results, **When** one of the first 5 is a close match, **Then** that one is used, not necessarily the first.
3. **Given** a name with a sequel number (for example "Witcher 3"), **When** RAWG returns a different number, **Then** that result is rejected.
4. **Given** the user upgrades from a version that stored fuzzy matches, **When** the app starts, **Then** the old lookups are not reused, so wrong matches disappear without clearing the cache by hand.

### User Story 2 - Ignore list (Priority: P1)
In Settings the user keeps a list of folder names or patterns (`*` matches anything) that are never treated as games, for example `*torrent-temp*`. Matching folders never appear in the library or on the confirm screen, and are not re-added on later launches.

**Acceptance Scenarios**:
1. **Given** the ignore list contains `*torrent-temp*`, **When** a library folder is scanned, **Then** `0 - torrent-temp` is not listed.
2. **Given** a pattern is added in Settings, **When** it is saved, **Then** the library reloads and matching games are gone.
3. **Given** a fresh profile, **When** Settings is opened, **Then** the list already holds common non-game names (`$RECYCLE.BIN`, `System Volume Information`, `temp`, `tmp`, `*torrent-temp*`), and the user can edit them.
4. Matching ignores letter case.

### User Story 3 - Groups: scan inside a folder (Priority: P1)
A folder such as `0 - PC` that holds more games can be turned into its own library folder with one action, **Scan inside**. It is offered on the confirm screen (next to Skip) and on any game's right-click menu and detail view. The user names the group (a default is suggested). Its games then appear under that name, and the folder itself is no longer listed as a game.

**Acceptance Scenarios**:
1. **Given** the confirm screen, **When** the user clicks **Scan inside** on `0 - PC` and continues, **Then** `0 - PC` is added as a library folder and its subfolders are added as games.
2. **Given** a game already in the library, **When** the user chooses **Scan inside…** from its menu and confirms a name, **Then** it becomes a library folder and leaves the games list.
3. **Given** a saved folder and one of its subfolders are both library folders, **When** scanning, **Then** each game is listed once, under the deeper folder (existing rule).
4. **Given** the confirm screen (the first scan of a library folder, and "Review names"), **When** the user looks at a folder, **Then** it offers two choices: **Hide** or **Has games inside**.
5. **Given** a game card, **When** the user opens Fix match and chooses **Not a game**, **Then** the app asks "Just hide it" or "It has games in it". The first hides the folder (restorable in Settings), the second makes it a group.
6. **Given** a group is removed in Settings, **When** the library reloads, **Then** its folder reappears as a normal game entry of its parent.

### User Story 4 - Folder tabs on the side (Priority: P1)
The library has a left panel listing every library folder as a tab: the **name** as the title and the **path** underneath, with the number of games and total size. All tabs are selected at first. The user can check or uncheck tabs to choose which folders are shown, click a tab title to show only that folder, or click **All folders** to show everything. Folders nested in other library folders are indented under them. Unavailable folders are marked. A **Hide unavailable** checkbox sits at the top of the panel.

**Acceptance Scenarios**:
1. **Given** several library folders, **When** the library opens, **Then** every tab is checked and all games are shown.
2. **Given** the user unchecks a tab, **When** the view updates, **Then** that folder's games are hidden and the games count reflects it.
3. **Given** the user clicks a tab's title, **When** the view updates, **Then** only that folder is shown.
4. **Given** only some tabs are checked, **When** the user clicks **All folders**, **Then** all tabs are checked again.
5. **Given** the user would uncheck the last checked tab, **Then** nothing changes (at least one folder stays selected).
6. **Given** the selection, **When** the app restarts, **Then** it is the same as before.

### User Story 5 - Richer game cards (Priority: P2)
Each Grid card shows: cover, title, developer and year, rating and Metacritic score, up to two genres, size on disk, the library folder name, and badges (status, copies, unavailable). Hovering the cover shows the start of the description. Cards without a match show the folder name, why there is no match, and a **Fix match** button. Sidebar items show year and size under the name.

**Acceptance Scenarios**:
1. **Given** a matched game, **When** the Grid is shown, **Then** the card shows all the items above that exist for that game (missing ones are left out, not shown as blanks).
2. **Given** an unmatched game, **When** the Grid is shown, **Then** its card shows the folder name, the reason, and a working **Fix match** button.

## Requirements

- **FR-001**: A lookup result MUST only be used if the similarity between the searched name and RAWG's result name is at least 0.5 (shared words divided by the larger word count, after ignoring case, punctuation, bracketed text, and edition words such as "Enhanced" or "Complete"). When both names contain numbers, the numbers MUST be identical.
- **FR-002**: Lookups MUST consider the first 5 RAWG results and use the best-scoring acceptable one; if none is acceptable the game is "Not found".
- **FR-003**: Lookup results from earlier versions MUST NOT be reused.
- **FR-004**: The app MUST keep an ignore list of folder-name patterns (case-insensitive, `*` and `?` wildcards), editable in Settings, with the defaults in US2.
- **FR-005**: Ignored folders MUST be excluded from every scan (adding folders, the launch rescan) and from the confirm screen.
- **FR-006**: The confirm screen MUST offer **Scan inside** per folder. Chosen folders MUST be added as library folders with a unique name (30 characters or fewer) and their subfolders scanned.
- **FR-007**: A game's menu and detail view MUST offer **Scan inside…**, asking for the group's name.
- **FR-008**: The library MUST show one tab per library folder in a side panel, with name, path, game count, and total size; nested folders MUST be indented; unavailable folders MUST be marked.
- **FR-009**: Tabs MUST support check/uncheck, "show only this", "All folders", and a **Hide unavailable** option. At least one folder MUST stay selected. The selection MUST be remembered.
- **FR-010**: The old folder-filter dropdown in the top bar MUST be replaced by the tabs panel.
- **FR-011**: Grid cards MUST show the items listed in US5, and unmatched cards MUST offer **Fix match** directly.

## Success Criteria

- **SC-001**: In the reported library, `0 - torrent-temp` and `0 - PC` no longer show wrong games (0 false matches among folders whose names share fewer than half their words with RAWG's answer).
- **SC-002**: Real games still match: all folder names in the README examples and the user's screenshot (CONTROL Resonant, Five Nights at Freddy's – Security Breach, Grand Theft Auto V Enhanced, REPLACED) are accepted.
- **SC-003**: A user can turn a folder into a group in 2 clicks from the confirm screen or 3 from a game's menu.
- **SC-004**: A user can show a single folder's games with 1 click on its tab.

## Assumptions

- A "group" is the existing library-folder concept applied to a subfolder (001 FR-020 and the nested-folder rule already guarantee each game is listed once). No new storage concept is added.
- Scanning inside goes exactly one level deeper per group; a group inside a group works the same way.
- Words such as "Enhanced" or "Complete" are treated as noise only for similarity checks, never when searching RAWG.
- Turning a game into a group removes the game's saved status and match, because it is no longer a game.

## Out of Scope

- Automatic detection of which folders are groups.
- Tabs for individual subfolders other than library folders.
