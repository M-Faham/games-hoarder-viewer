const { contextBridge, ipcRenderer } = require('electron');

const invoke = channel => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('electronAPI', {
  // Folders & scanning
  pickDirectories: invoke('pick-directories'),
  readFolders: invoke('read-folders'),
  scanRoots: invoke('scan-roots'),

  // Library config
  getLibrary: invoke('get-library'),
  addRoots: invoke('add-roots'),
  renameRoot: invoke('rename-root'),
  removeRoot: invoke('remove-root'),
  saveGames: invoke('save-games'),
  setFolderFilter: invoke('set-folder-filter'),
  setHideUnavailable: invoke('set-hide-unavailable'),
  restoreGame: invoke('restore-game'),
  setGameSkipped: invoke('set-game-skipped'),
  setGameMatch: invoke('set-game-match'),
  setGamesStatus: invoke('set-games-status'),
  setViewSettings: invoke('set-view-settings'),
  setExportPaths: invoke('set-export-paths'),
  setIgnoreList: invoke('set-ignore-list'),

  // API key
  getApiKeyStatus: invoke('get-api-key-status'),
  getApiKeyForRequests: invoke('get-api-key-for-requests'),
  setApiKey: invoke('set-api-key'),
  markApiKeyInvalid: invoke('mark-api-key-invalid'),
  markApiKeyValid: invoke('mark-api-key-valid'),
  clearApiKey: invoke('clear-api-key'),

  // Sizes
  startSizeScan: invoke('start-size-scan'),
  getSizes: invoke('get-sizes'),
  getFreeSpace: invoke('get-free-space'),
  onSizeProgress: cb => ipcRenderer.on('size-progress', (event, data) => cb(data)),

  // Quick actions
  showInFolder: invoke('show-in-folder'),
  findInstallers: invoke('find-installers'),
  runInstaller: invoke('run-installer'),
  copyText: invoke('copy-text'),

  // Updates & export
  checkForUpdate: invoke('check-for-update'),
  setUpdateSettings: invoke('set-update-settings'),
  saveExport: invoke('save-export'),
  openPath: invoke('open-path'),

  // Misc
  getAppVersion: invoke('get-app-version'),
  openExternal: invoke('open-external')
});
