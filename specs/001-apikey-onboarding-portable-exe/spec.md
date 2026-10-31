# Feature Specification: API Key Onboarding, Multiple Library Folders & Single-File Portable App

**Feature Branch**: `001-apikey-onboarding-portable-exe`
**Created**: 2026-10-31
**Status**: Draft
**Input**: User description: "Now I want to add a couple of things first a intial page that help the user get the api key which is going to be dynamic and the second thing the exe and its files should be a single file and a" *(input was cut off after "and a")*

## Clarifications

### Session 2026-10-31

- Q: What did the cut-off part of the original request ("...a single file and a") mean? → A: Portable only — one `.exe` that runs from anywhere with no installer; the installer build is dropped.
- Q: Can the user get past the welcome page without a key? → A: Yes — "Skip for now" is offered; cached games load normally, uncached games show without metadata, and the app prompts for a key when a fetch is needed.
- Q: How should the API key be stored? → A: Encrypted with the operating system's per-user encryption, falling back to plain local storage if encryption is unavailable.
- Q: (User addition) Should the user be able to add multiple directories, not just one? → A: Yes. The folder picker allows selecting several directories at once, and the app keeps a saved list of library folders that the user can add to and remove from. The list is remembered and rescanned on each launch.
- Q: (User addition) Should each added directory have a name? → A: Yes. The user must give every library folder a name. That name appears on each game card from that folder, and the user can filter the library by it.
- Q: (Alignment with feature 002) How should 001 change so it doesn't conflict with 002? → A: (1) Games in an unavailable library folder are shown greyed out with an "Unavailable" badge instead of being hidden, and a "Hide unavailable" toggle is added. (2) Skipped folders are kept as "hidden folders" and can be restored from Settings. (3) Public text describes the app as a library for local game folders, with no repack-group names. (4) A "Data from RAWG" attribution link is shown wherever RAWG data appears. (5) The not-found text no longer tells the user to rename folders.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-run API key setup (Priority: P1)

A new user opens the app for the first time. Instead of having to edit source files, they see a welcome page that explains why a RAWG key is needed and shows step by step how to get a free key. The page has a button that opens the RAWG sign-up page in their browser and a field where they paste the key. The app checks the key, saves it, and takes the user to the normal library screen.

**Why this priority**: Right now the app cannot fetch any game data unless the user edits code. The packaged .exe can't be used by non-developers at all. This story makes the app usable.

**Independent Test**: Start the app on a clean profile with no key saved. Follow the on-screen steps, paste a valid key, and confirm that a folder scan fetches game metadata.

**Acceptance Scenarios**:

1. **Given** no API key is saved, **When** the user launches the app, **Then** the welcome/API key page shows instead of the library screen.
2. **Given** the welcome page is shown, **When** the user clicks "Get a free key", **Then** the RAWG key page opens in the system's default browser.
3. **Given** the user pastes a valid key and confirms, **When** the key is checked, **Then** the app shows success, saves the key, and goes to the library screen.
4. **Given** the user pastes an invalid key, **When** the key is checked, **Then** the app shows a clear error, does not save the key, and lets the user try again.
5. **Given** the welcome page is shown, **When** the user clicks "Skip for now", **Then** the library screen opens without a key, and the welcome page shows again on the next launch while no key is saved.
6. **Given** a valid key was saved before, **When** the user relaunches the app, **Then** the library screen opens directly and the welcome page is not shown.

---

### User Story 2 - Change or remove the API key later (Priority: P2)

A user whose key expired, or who wants a different key, opens a settings entry in the app. They can see that a key is set (masked), replace it with a new one, or remove it.

**Why this priority**: Keys can be revoked or hit rate limits. Without a way to change the key in the app, users would be stuck. This depends on Story 1.

**Independent Test**: With a key saved, open settings, replace it with another valid key, and confirm scans still work. Then remove the key and confirm the welcome page shows again.

**Acceptance Scenarios**:

1. **Given** a key is saved, **When** the user opens API key settings, **Then** the current key shows masked (for example, only the last 4 characters visible).
2. **Given** the user enters a new valid key, **When** they save, **Then** the new key replaces the old one and is used for all later requests.
3. **Given** the user removes the key, **When** they confirm, **Then** the key is deleted and the welcome page shows.
4. **Given** a saved key starts being rejected by RAWG during a scan, **When** the rejection happens, **Then** the user is told the key is invalid and is offered a way to update it.

---

### User Story 3 - Single-file portable executable (Priority: P2)

A user downloads a single .exe file. They can run it from anywhere, such as the desktop, a USB drive, or the downloads folder, without running an installer and without a folder of extra files next to it.

**Why this priority**: It makes the app much easier to share and run. It doesn't depend on the other stories, but it matters most once the app can be used without code edits (Story 1).

**Independent Test**: Run the build. Confirm the output is one .exe file. Copy only that file to another Windows machine or folder, double-click it, and confirm the app launches and works.

**Acceptance Scenarios**:

1. **Given** the project is built, **When** the build finishes, **Then** the deliverable is exactly one executable file.
2. **Given** only that executable is copied to a new location, **When** the user double-clicks it, **Then** the app launches with no installer step and no other files needed next to it.
3. **Given** the user saved an API key and cached games in a previous run, **When** they launch the same executable again, **Then** the key and cache are still there.

---

### User Story 4 - Manage multiple library folders (Priority: P1)

A user keeps games in several places, such as `D:\Games`, `E:\Repacks`, and an external drive. They pick several of these directories at once from the folder picker, then give each one a short name such as "Main SSD", "Repacks", or "External". That name appears on every game card from that folder, and the user can filter the library to show one or more of these folders. The app remembers the whole list, so on the next launch the library is rebuilt from all of them without picking again. From a "Library Folders" screen they can see every saved folder, add more, or remove one.

**Why this priority**: Today the picker takes one directory at a time, and the folder list is lost when the app closes, so the user must pick every folder again on each launch. That is the biggest everyday friction once the API key is set up.

**Independent Test**: Pick two or more directories in one picker dialog and confirm that games from all of them appear. Close and reopen the app and confirm the same games load with no picking. Remove one folder and confirm its games disappear from the library.

**Acceptance Scenarios**:

1. **Given** the folder picker is open, **When** the user selects several directories and confirms, **Then** all selected directories are added to the saved folder list and their subfolders are scanned.
2. **Given** at least one folder is saved, **When** the user relaunches the app, **Then** all saved folders are rescanned and the library is shown without a picker step.
3. **Given** the Library Folders screen is open, **When** the user removes a folder, **Then** it leaves the saved list and its games leave the library. The cached metadata for those games is kept.
4. **Given** a directory is already in the saved list, **When** the user adds it again, **Then** it is not duplicated and the user is told it is already included.
5. **Given** a rescan at launch finds new subfolders in a saved directory, **When** the scan completes, **Then** the new games are added to the library automatically, using cache or fetching as usual.
6. **Given** the user has selected one or more directories, **When** they continue, **Then** the app asks for a name for each directory, pre-filled with the directory's own folder name, and does not add any directory until every one has a non-empty name.
7. **Given** a name is already used by another saved folder, **When** the user enters it again, **Then** the app rejects it and asks for a different name. The check ignores letter case.
8. **Given** games from a named folder are in the library, **When** the user views them in Grid, List, or Sidebar view or opens the detail panel, **Then** each game shows its folder's name.
9. **Given** the library holds games from several named folders, **When** the user picks one or more folder names in the folder filter, **Then** only games from those folders are shown. Clearing the filter shows all games again.
10. **Given** the user renames a folder on the Library Folders screen, **When** they save, **Then** the new name shows on all its game cards and in the filter right away.

---

### Edge Cases

- No internet connection while checking a key: the app says it couldn't check the key because it is offline. It doesn't call the key invalid. The user can retry, or save the key anyway without checking.
- The pasted key has spaces before or after it, or line breaks: these are trimmed before checking.
- The user closes the app on the welcome page without entering a key: the welcome page shows again on next launch.
- The user chooses "Skip for now" and then scans a folder: cached games show full metadata, uncached games show by folder name only, and the app shows a prompt offering to add a key so it can fetch the rest.
- RAWG rate limit during checking or a scan: this is shown as "rate limited, try later", not as an invalid key.
- The portable executable runs from a read-only location, such as a locked USB drive: user data is saved in a writable per-user location, not next to the .exe.
- A saved folder is missing at launch, for example because an external drive is unplugged: the folder stays in the saved list and is shown as unavailable, and the rest of the library loads normally. It is not removed automatically. Its games stay in the library, greyed out with an "Unavailable" badge and showing their cached details. A "Hide unavailable" toggle in the folder filter hides them.
- The user skips a folder on the Confirm Game Names screen: it is not shown in the library, is listed under "Hidden folders" in Settings, and can be restored from there. Restoring it brings it back into the library on the next load.
- The user selects a directory nested inside one that is already saved, or a parent of one: the two are not merged, but the same game folder is never listed twice in the library.
- A selected directory has no subfolders: the user is told no games were found there, and it is not added to the saved list.
- A game folder sits inside two saved directories because one is nested in the other: the game is listed once and carries the name of the deeper (more specific) saved folder.
- The folder filter is active and the user removes one of the filtered folders: that folder leaves the filter. If no filtered folders are left, the filter is cleared and all games show.
- The user cancels the naming step: none of the selected directories are added.

## Requirements *(mandatory)*

### Functional Requirements

**API key onboarding**

- **FR-001**: The app MUST check for a saved API key at startup and show the welcome/API key page when none is found.
- **FR-002**: The welcome page MUST give clear, numbered instructions for getting a free RAWG API key.
- **FR-003**: The welcome page MUST have an action that opens the RAWG API key page in the user's default external browser, not inside the app window.
- **FR-004**: The welcome page MUST have an input for pasting the key and a confirm action.
- **FR-004a**: The welcome page MUST offer a "Skip for now" action that opens the library screen without a key. While no key is saved, cached games MUST load normally, uncached games MUST appear without metadata, and the app MUST prompt for a key whenever a fetch would be needed.
- **FR-005**: The app MUST check the key with a lightweight test request to RAWG before saving it, and MUST tell apart "invalid key", "offline/unreachable", and "rate limited".
- **FR-006**: The app MUST save a valid key on the user's machine so it is kept across restarts and app updates. The saved key MUST be encrypted with the operating system's per-user encryption, so other user accounts cannot read it. If that encryption is unavailable, the app MAY fall back to plain local storage.
- **FR-007**: The key MUST be supplied at runtime ("dynamic"). It MUST NOT be hard-coded in the source or the built executable.
- **FR-008**: The app MUST provide a settings entry for viewing the masked key, replacing it, and removing it.
- **FR-009**: When RAWG rejects the saved key during normal use, the app MUST tell the user and offer a direct path to update the key.
- **FR-010**: The full key MUST NOT appear anywhere in the UI after saving. Only a masked form may be shown.

**Portable single-file build**

- **FR-011**: The build process MUST produce one self-contained Windows executable as its only deliverable. No installer is produced.
- **FR-012**: The executable MUST run without an installation step and without any other files next to it.
- **FR-013**: User data (API key, metadata cache, library state) MUST be saved in a per-user writable location so it is kept across launches no matter where the executable is.
- **FR-014**: The README MUST be updated. It must say the key is entered in the app instead of in source code, describe the single-file build, and describe managing multiple library folders.
- **FR-014a**: The README, app description, and in-app text MUST describe the product as a library for local game folders, and MUST NOT name repack groups. Examples of name cleaning MUST use neutral folder names. The name-cleaning behaviour itself is unchanged.
- **FR-014b**: Every view that shows game data from RAWG (Grid, List, Sidebar, detail panel, modal) MUST show a visible "Data from RAWG" link that opens the RAWG website in the browser.
- **FR-014c**: The README MUST explain that the app is not code-signed, that Windows may show an "unrecognised app" warning, and how to get past it (*More info → Run anyway*).

**Multiple library folders**

- **FR-015**: The folder picker MUST let the user select more than one directory in a single dialog.
- **FR-016**: The app MUST keep a saved list of library folders that is kept across restarts.
- **FR-017**: At launch, the app MUST rescan every saved folder and build the library from all of them without asking the user to pick folders again.
- **FR-018**: The app MUST provide a Library Folders screen that lists every saved folder with its name, path, game count, and availability, and lets the user add, rename, and remove folders.
- **FR-019**: Removing a folder MUST remove its games from the library but MUST NOT clear their cached metadata.
- **FR-020**: The app MUST NOT add the same directory twice, and MUST NOT list the same game folder twice in the library.
- **FR-021**: A saved folder that cannot be reached at launch MUST be marked unavailable, MUST NOT stop the rest of the library from loading, and MUST stay in the saved list until the user removes it. Its games MUST stay visible, greyed out with an "Unavailable" badge, using cached details where they exist.
- **FR-021a**: The folder filter MUST offer a "Hide unavailable" toggle (off by default) that hides games from unavailable folders. The toggle MUST be kept across restarts.
- **FR-021b**: Folders skipped on the Confirm Game Names screen MUST be kept as hidden folders. They MUST NOT appear in the library, MUST NOT be offered for review again, and MUST be listed under "Hidden folders" in Settings, where the user can restore each one.
- **FR-022**: Every library folder MUST have a user-given name. When directories are added, the app MUST ask for a name for each one, pre-filled with the directory's own folder name, and MUST NOT save any directory without a non-empty name.
- **FR-023**: Folder names MUST be unique among saved folders, ignoring letter case, and MUST be at most 30 characters after trimming spaces.
- **FR-024**: Each game MUST show the name of the folder it came from on its game card in all three views (Grid, List, Sidebar) and in the game detail panel.
- **FR-025**: The library MUST offer a folder filter that lets the user show games from one or more selected folder names. It MUST work together with the app's other search and filter controls.
- **FR-026**: Renaming a folder MUST update its name on all game cards and in the folder filter without a rescan.

### Key Entities

- **API Key Setting**: The user's RAWG key. Its attributes are the key value (stored encrypted), whether encryption was used, when it was last checked, and the last check result. There is one per user profile.
- **Library Folder**: A directory the user added as a source of games. Its attributes are the full path, a user-given name (required, unique ignoring case, 30 characters or fewer), when it was added, and its availability at the last scan. There are many per user profile, and each path is unique.
- **Game Entry**: A game folder inside a library folder. Its attributes are the folder path (unique), the library folder it belongs to, the search name used to look it up, and whether it is hidden (skipped).
- **Portable Executable**: The single distributable file that holds the whole app.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user with no prior knowledge can go from first launch to a working library scan in under 3 minutes, including getting a key from RAWG.
- **SC-002**: 0 source-file edits are needed for an end user to start using the app.
- **SC-003**: Invalid keys are rejected with a clear message 100% of the time, and the problem is never shown as a vague later failure during a scan.
- **SC-004**: The distributable is exactly 1 file, and it launches when copied by itself to a clean folder.
- **SC-005**: The saved key, game cache, and library folder list are kept across at least 10 consecutive launches of the portable executable.
- **SC-006**: A user can add 3 or more game directories in one picker action, and on later launches the full library appears with 0 folder-picking steps.
- **SC-007**: In a library spread across 3 or more named folders, a user can narrow the view to a single folder's games in 2 clicks or fewer, and every visible game card shows its folder name.

## Assumptions

- "Dynamic" API key means the user enters the key at runtime in the app and can change it any time. It is not baked into the build.
- Windows is the only target platform, the same as today.
- The single portable executable may unpack itself to a temp location at launch. This is fine as long as the user only deals with one file.
- The current installer-based build is dropped and replaced by the portable build (see Clarifications).
- The name-review screen (edit or skip detected names) appears whenever folders are added through the picker. Games found by the launch rescan in folders that were already saved are added automatically with cleaned names, and a "Review names" toast opens the same screen for them. Games already in the library from earlier launches are not reviewed again.
- The "Library Folders screen" in this spec is implemented as the Library folders section of the Settings window.
- Saved folders are tracked per user profile, the same as the API key and cache.
- The app is shared publicly without code signing (decided in feature 002, Clarification Q1). That is why attribution, neutral wording, and the unsigned-build note are included here, in the first shareable build.
- "Hidden folder" here is the same concept as "Not a game" in feature 002. Feature 002 adds a second way to hide a folder (from Fix match) but keeps the same list and restore action.
