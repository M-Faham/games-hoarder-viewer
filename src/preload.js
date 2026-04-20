const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  pickDirectory: () => ipcRenderer.invoke('pick-directory'),
  readFolders: (dirPath) => ipcRenderer.invoke('read-folders', dirPath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
