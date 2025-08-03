// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimizeWindow: () => ipcRenderer.send('minimize'),
    maximizeWindow: () => ipcRenderer.send('maximize'),
    closeWindow: () => ipcRenderer.send('close'),

    // Python interaction
    openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
    organizeFiles: (source, destination) => ipcRenderer.invoke('organize-files', source, destination),
    deleteSourceFiles: (processedFilesInfo) => ipcRenderer.invoke('delete-source-files', processedFilesInfo),
    
    // Update checker
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    
    // Listeners for progress and status
    onOrganizeStatus: (callback) => ipcRenderer.on('organize-status', (event, value) => callback(value)),
    onOrganizeProgress: (callback) => ipcRenderer.on('organize-progress', (event, value) => callback(value)),
    onOrganizeComplete: (callback) => ipcRenderer.on('organize-complete', (event, value) => callback(value)),
    onOrganizeError: (callback) => ipcRenderer.on('organize-error', (event, value) => callback(value)),

    onDeleteStatus: (callback) => ipcRenderer.on('delete_status', (event, value) => callback(value)),
    onDeleteProgress: (callback) => ipcRenderer.on('delete_progress', (event, value) => callback(value)),
    onDeleteComplete: (callback) => ipcRenderer.on('delete_complete', (event, value) => callback(value)),
    onDeleteError: (callback) => ipcRenderer.on('delete-error', (event, value) => callback(value))
});