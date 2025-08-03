// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimizeWindow: () => ipcRenderer.send('minimize'),
    maximizeRestoreWindow: () => ipcRenderer.send('maximize'),
    closeWindow: () => ipcRenderer.send('close'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

    // File dialogs
    openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),

    // Python script interaction
    organizeFiles: (sourceDir, destinationDir) => ipcRenderer.invoke('organize-files', sourceDir, destinationDir),
    deleteSourceFiles: (processedFilesInfo) => ipcRenderer.invoke('delete-source-files', processedFilesInfo),
    
    // Event listeners from main process
    onOrganizeStatus: (callback) => ipcRenderer.on('organize-status', (event, value) => callback(value)),
    onOrganizeProgress: (callback) => ipcRenderer.on('organize-progress', (event, value) => callback(value)),
    onOrganizeComplete: (callback) => ipcRenderer.on('organize-complete', (event, value) => callback(value)),
    onOrganizeError: (callback) => ipcRenderer.on('organize-error', (event, value) => callback(value)),

    onDeleteStatus: (callback) => ipcRenderer.on('delete-status', (event, value) => callback(value)),
    onDeleteProgress: (callback) => ipcRenderer.on('delete-progress', (event, value) => callback(value)),
    onDeleteComplete: (callback) => ipcRenderer.on('delete-complete', (event, value) => callback(value)),
    onDeleteError: (callback) => ipcRenderer.on('delete-error', (event, value) => callback(value)),
});