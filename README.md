# Games Hoarder Viewer

A Steam-like Windows desktop app for browsing your repacked games library. Point it at a folder full of repacked games and it automatically fetches cover art, ratings, descriptions, screenshots, and more from RAWG.

![Library Grid View](screenshots/grid.png)

![Welcome Screen](screenshots/welcome.png)

---

## Features

- Pick one or multiple game folders — new games get appended to your library
- Edit or skip any detected game name before searching
- Auto-strips repacker tags: FitGirl, DODI, CODEX, EMPRESS, version numbers, etc.
- 3 view modes: **Grid**, **List**, **Sidebar**
- Each game shows: cover art, RAWG rating, Metacritic score, description, screenshots, developer, release year, genres, and local folder path
- API response caching — already-fetched games load instantly on future scans (7-day cache)
- Dark Steam-like UI

---

## Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18 or newer

### 2. Get a free RAWG API key
Sign up at [rawg.io/apidocs](https://rawg.io/apidocs) — it's free and instant.  
Then open `src/js/api.js` and replace the `API_KEY` value with your key.

### 3. Install and run

```bash
npm install
npm start
```

---

## How to Use

1. Click **Choose Games Folder** (or **Open Folder** in the topbar)
2. The app scans all subfolders and strips repacker tags from each name
3. A confirmation screen appears — edit any name, or click **Skip** to exclude a game
4. Click **Add More Folders** to include games from another drive or directory
5. Click **Search All Games** — already-cached games load instantly, new ones are fetched from RAWG
6. Browse your library in Grid, List, or Sidebar view
7. Click any game to open its full detail panel

---

## Multiple Folders

You can combine games from different locations into one library. Either:
- Click **Open Folder** again while the library is already loaded — new games get appended
- Click **Add More Folders** inside the confirmation screen to queue up another directory before searching

Duplicate folders are automatically skipped.

---

## Caching

After a game is fetched from RAWG, the result is saved locally for 7 days.  
The next time you scan a folder containing that game, it loads from cache — no API call needed.

The **Clear Cache (N)** button in the top-right shows how many games are cached and lets you wipe them all to force a fresh fetch.

---

## Folder Name Cleaning Examples

| Folder Name | Detected As |
|---|---|
| `God.of.War-FitGirl` | `God of War` |
| `[DODI] Red Dead Redemption 2 v1.14` | `Red Dead Redemption 2` |
| `Cyberpunk_2077_CODEX` | `Cyberpunk 2077` |
| `Elden.Ring-EMPRESS` | `Elden Ring` |

---

## Building a .exe

> **Run your terminal as Administrator** before building, otherwise the build will fail trying to create symlinks.

```bash
npm run build
```

This creates a `.exe` installer in the `dist/` folder.

---

## Project Structure

```
game-viewer/
├── src/
│   ├── main.js         ← Electron main process
│   ├── preload.js      ← Secure IPC bridge
│   ├── index.html      ← App shell
│   ├── css/
│   │   └── style.css   ← Dark Steam theme
│   └── js/
│       ├── api.js      ← RAWG API calls + cache
│       ├── render.js   ← HTML rendering (all 3 views)
│       └── app.js      ← App logic & state
└── package.json
```
