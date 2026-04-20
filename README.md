# Games Hoarder Viewer

A Steam-like Windows desktop app for browsing your repacked games library with full game info pulled from RAWG.

## Features

- Point it at any folder containing repacked games
- Manually confirm/edit game names before searching
- Auto-strips repacker tags (FitGirl, DODI, v1.2, etc.)
- 3 view modes: Grid, List, Sidebar
- Shows cover art, rating, Metacritic score, description, screenshots, developer, release year, genres
- Dark Steam-like UI

---

## Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- A free [RAWG API key](https://rawg.io/apidocs)

### 2. Install dependencies
```bash
npm install
```

### 3. Add your RAWG API key
Open `src/js/apikey.js` and replace `"YOUR_API_KEY"` with your actual key.

### 4. Run the app
```bash
npm start
```

### 5. Build for Windows (optional)
```bash
npm run build
```
Creates a `.exe` installer in the `dist/` folder.

---

## How It Works

1. Click **Open Folder** and select your repacked games directory
2. The app reads all subfolders and strips repacker tags from each name
3. A confirmation window shows — edit any names, skip any games
4. Click **Search All Games** — the app fetches data from RAWG one by one
5. Browse your library in Grid, List, or Sidebar view
6. Click any game to see the full detail modal

---

## Folder Name Cleaning Examples

| Folder Name | Detected As |
|---|---|
| `God.of.War-FitGirl` | `God of War` |
| `[DODI] Red Dead Redemption 2 v1.14` | `Red Dead Redemption 2` |
| `Cyberpunk_2077_CODEX` | `Cyberpunk 2077` |
| `Elden.Ring-EMPRESS` | `Elden Ring` |

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
│       ├── apikey.js   ← Your RAWG API key (edit this)
│       ├── api.js      ← RAWG API calls
│       ├── render.js   ← HTML rendering (all 3 views)
│       └── app.js      ← App logic & state
└── package.json
```
