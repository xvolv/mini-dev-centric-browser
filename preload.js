const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

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
    onConsoleEvent: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on('console:event', listener);
        return () => ipcRenderer.removeListener('console:event', listener);
    },
    selectRepo: () => ipcRenderer.invoke('git:selectRepo'),
    gitStatus: (repoPath) => ipcRenderer.invoke('git:status', repoPath),
    gitBranches: (repoPath) => ipcRenderer.invoke('git:branches', repoPath),
    gitCommit: (repoPath, message) => ipcRenderer.invoke('git:commit', repoPath, message),
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
    githubDeviceCode: () => ipcRenderer.invoke('github:deviceCode'),
    githubPoll: (deviceCode) => ipcRenderer.invoke('github:poll', deviceCode),
    githubStatus: () => ipcRenderer.invoke('github:status'),
    githubLogout: () => ipcRenderer.invoke('github:logout'),
    githubListRepos: (page) => ipcRenderer.invoke('github:listRepos', page),
    githubChooseCloneDir: () => ipcRenderer.invoke('github:chooseCloneDir'),
    githubClone: (repoUrl, targetPath) => ipcRenderer.invoke('github:clone', repoUrl, targetPath),
    aiChat: (payload) => ipcRenderer.invoke('ai:chat', payload),
    aiGetSettings: () => ipcRenderer.invoke('ai:getSettings'),
    aiSetSettings: (settings) => ipcRenderer.invoke('ai:setSettings', settings),
    apiSend: (payload) => ipcRenderer.invoke('api:send', payload),
    exportConsoleLogs: (entries) => ipcRenderer.invoke('console:export', entries),
    webviewPreloadPath: path.join(__dirname, 'webview-preload.js'),
});

contextBridge.exposeInMainWorld('api', {
    addHistory: (url, title) => ipcRenderer.invoke('history:add', url, title),
    searchHistory: (query) => ipcRenderer.invoke('history:search', query),
    removeHistory: (id) => ipcRenderer.invoke('history:remove', id),
    addBookmark: (url, title) => ipcRenderer.invoke('bookmark:add', url, title),
    getBookmarks: () => ipcRenderer.invoke('bookmark:get'),
    removeBookmark: (id) => ipcRenderer.invoke('bookmark:remove', id),
});
