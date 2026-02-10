const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximizedChange: (callback) => {
        ipcRenderer.on('window:maximized-change', (_event, isMaximized) => callback(isMaximized));
    },
    attachNetwork: (webContentsId) => ipcRenderer.send('network:attach', webContentsId),
    onNetworkEvent: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on('network:event', listener);
        return () => ipcRenderer.removeListener('network:event', listener);
    },
});
