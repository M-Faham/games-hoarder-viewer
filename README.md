# Games Hoarder Viewer

A Steam-like Windows desktop app for browsing your local game folders. Point it at one or more folders and it fetches cover art, ratings, descriptions, screenshots, and more from [RAWG](https://rawg.io). Then it helps you decide what to play, what to keep, and what to delete.

<img width="2102" height="1331" alt="Image" src="https://github.com/user-attachments/assets/a346d994-fc37-4b44-a9cc-4281618c8e02" />

<img width="3833" height="1750" alt="Image" src="https://github.com/user-attachments/assets/d701f53f-ab75-4ef0-91a3-342f5a3cbb1a" />

<img width="3839" height="2068" alt="Image" src="https://github.com/user-attachments/assets/e60ba843-5cc3-4799-9e19-9400fe49b3c2" />

<img width="3839" height="1977" alt="Image" src="https://github.com/user-attachments/assets/04cf95a8-9797-4ba8-8a25-07bfefe9832f" />

---

## Features

- **Multiple library folders**: pick several directories at once and give each one a name. The name shows on every game card, and you can filter the library by it. Your folders are remembered and rescanned on every launch.
- 3 view modes: **Grid**, **List**, **Sidebar**
- Each game card shows the cover (hover for the description), developer and year, rating and Metacritic score, genres, size on disk and its library folder. Open a game for screenshots, details and its folder path
- **Sort and filter** by name, rating, Metacritic, release year, size, or date added; filter by genre, year, rating, match state, status, and duplicates
- **Fix match**: if a game was matched wrongly (or not at all), pick the right one from RAWG, or mark the folder as "Not a game"
- **Disk size** per game and per library folder, with free space on each drive
- **Duplicates**: games that appear in more than one folder get a "2 copies" badge
- **Quick actions** (right-click a game): Open in Explorer, Run installer, Copy path
- **Status tags**: Backlog, Installed, Played, Can delete. Ctrl/Shift-click to select several games at once
- **Pick for me**: a random suggestion, preferring your Backlog and higher-rated games
- **Export** the current view to CSV or a shareable HTML page
- Edit or skip any detected game name before searching. Common tags and version numbers in folder names are cleaned up automatically
- API response caching: already-fetched games load instantly (7-day cache, and cached details stay available offline)
- Update notice when a newer version is published (checked once a day, can be turned off)
- Dark Steam-like UI

---

## Getting started

### Download

Download `Games Hoarder Viewer <version>.exe` from the releases page and run it. It is a single portable file: there is nothing to install, and it works from any folder, including a USB drive.

#### First run on Windows

The app is not code-signed, so Windows may show **"Windows protected your PC"** the first time you open it. Click **More info**, then **Run anyway**.

### Add your RAWG API key

On first launch the app walks you through getting a free RAWG API key:

1. Click **Get a free key** and create a free RAWG account.
2. Copy the key RAWG shows you.
3. Paste it into the app and click **Save key**.

The key is stored encrypted on your PC (using Windows' per-user encryption) and never leaves it except to talk to RAWG. You can replace or remove it any time in **Settings** (the gear icon). You can also click **Skip for now** to browse games that are already cached.

### Run from source

Requires [Node.js](https://nodejs.org/) v18 or newer.

```bash
npm install
npm start
```

---

## How to use

1. Click **Add Folders**, select one or more directories, and give each one a short name (for example "Main SSD" or "External").
2. The app scans every subfolder and cleans up its name.
3. A confirmation screen appears. Edit any name, or click **Skip** to hide a folder.
4. Click **Search All Games**. Cached games load instantly, new ones are fetched from RAWG.
5. Browse in Grid, List, or Sidebar view. Click a game for its full details.
6. Open **Settings** (gear icon) to manage library folders, restore hidden folders, or change your API key.

### Folders that are not games, and folders that hold games

Not every subfolder of your library is a game. For each one you can choose:

- **Hide** (confirm screen) or **Just hide it** (Fix match → Not a game): the folder is kept out of the library. Restore it under **Settings → Hidden folders**.
- **Has games inside** / **It has games in it**: the folder becomes a library folder of its own, so the games inside it are listed under the name you give it. Use it for category folders like `D:\Repacks\PC`.
- **Ignored folders** (Settings): names or patterns such as `*torrent-temp*` that are never treated as games, so download or temp folders never show up. `*` matches anything, and case is ignored.

If RAWG's best answer does not resemble the folder name, the game shows as **Not found** instead of a wrong game, and **Fix match** lets you pick the right one.

### Library folders

All your library folders are listed as tabs on the left, each with its name and its path underneath. Every tab is checked at first: uncheck a tab to hide that folder's games, click its title to show only that folder, or click **All folders** to show everything again. Folders inside other library folders are indented.

- Add as many directories as you like. Names must be unique (up to 30 characters).
- Rename or remove a folder in **Settings → Library folders**. Removing a folder removes its games from the library but keeps their cached details.
- If a folder can't be reached (for example, an unplugged drive), its games stay in the library greyed out as *Unavailable*. Use **Hide unavailable** at the top of the folder tabs to hide them.
- Folders you skipped are listed under **Settings → Hidden folders**, where you can restore them.

### Triage tools

- **Sort / Filters** are in the toolbar above the library. **Clear filters** resets everything except the sort.
- **Sizes** are worked out in the background and remembered. Use **Recalculate sizes** on a folder in Settings if you changed files deep inside a game folder.
- **Run installer** only looks for `setup` or `install` programs at the top level of a game folder, and asks before starting one.
- The app never deletes, moves, or changes your game folders. "Can delete" is just a label.

---

## Caching

After a game is fetched from RAWG, the result is saved locally for 7 days. Details older than that are still shown when you are offline or have no API key, and refreshed the next time they can be.

The **Clear Cache (N)** button in the top-right shows how many games are cached and lets you wipe them all to force a fresh fetch.

---

## Folder name cleaning examples

| Folder Name | Detected As |
|---|---|
| `God.of.War-v1.0.2` | `God of War` |
| `[Backup] Red Dead Redemption 2 v1.14` | `Red Dead Redemption 2` |
| `Cyberpunk_2077_v2.1` | `Cyberpunk 2077` |
| `Elden.Ring.(2022)` | `Elden Ring` |

---

## Your data

Settings, library folders, and your choices are stored in `%APPDATA%\Games Hoarder Viewer`. Delete that folder to reset the app.

---

## Building the .exe

> **Run your terminal as Administrator**, or turn on **Developer Mode** in Windows settings, before building. Otherwise the build fails when it tries to create symlinks.

```bash
npm run build
```

This creates a single portable `Games Hoarder Viewer <version>.exe` in the `dist/` folder. The first launch of a portable build takes a second or two longer because it unpacks itself to a temporary folder.

### Tests

```bash
npm test
```

---

## Project structure

```
games-hoarder-viewer/
├── src/
│   ├── main.js          ← Electron main process (IPC, quick actions, update check, export)
│   ├── preload.js       ← Secure IPC bridge
│   ├── config-store.js  ← Saved settings (config.json), encrypted API key
│   ├── sizes.js         ← Background folder-size calculation
│   ├── index.html       ← App shell
│   ├── shared/          ← Pure logic shared by the app and the tests
│   ├── css/
│   │   ├── style.css    ← Dark Steam theme
│   │   └── features.css ← Onboarding, folders, triage styles
│   └── js/
│       ├── api.js        ← RAWG API calls + cache
│       ├── render.js     ← HTML rendering (all 3 views)
│       ├── onboarding.js ← API key page + key settings
│       ├── folders.js    ← Library folders, naming, folder filter
│       ├── triage.js     ← Sort/filter toolbar, Pick for me, Export
│       ├── fixmatch.js   ← Fix match dialog
│       ├── actions.js    ← Right-click menu, installers, status
│       ├── ui.js         ← Toasts, dialogs, menus
│       └── app.js        ← App logic & state
├── tests/
└── package.json
```

---

Game data and images are provided by [RAWG](https://rawg.io).
