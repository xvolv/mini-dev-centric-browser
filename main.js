const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

let mainWindow;
const trackedWebContents = new Set();
const requestStartTimes = new Map();
let webRequestAttached = false;

function ensureWebRequestHandlers() {
    if (webRequestAttached) return;
    webRequestAttached = true;

    const webRequest = session.defaultSession.webRequest;

    webRequest.onBeforeRequest((details, callback) => {
        requestStartTimes.set(details.id, Date.now());
        callback({});
    });

    webRequest.onCompleted((details) => {
        if (!trackedWebContents.has(details.webContentsId)) return;
        const start = requestStartTimes.get(details.id);
        requestStartTimes.delete(details.id);
        const durationMs = start ? Math.max(0, Date.now() - start) : null;

        mainWindow?.webContents.send('network:event', {
            type: 'completed',
            webContentsId: details.webContentsId,
            method: details.method,
            url: details.url,
            status: details.statusCode,
            fromCache: details.fromCache,
            resourceType: details.resourceType,
            size: details.encodedDataLength,
            timeMs: durationMs,
        });
    });

    webRequest.onErrorOccurred((details) => {
        if (!trackedWebContents.has(details.webContentsId)) return;
        const start = requestStartTimes.get(details.id);
        requestStartTimes.delete(details.id);
        const durationMs = start ? Math.max(0, Date.now() - start) : null;

        mainWindow?.webContents.send('network:event', {
            type: 'error',
            webContentsId: details.webContentsId,
            method: details.method,
            url: details.url,
            status: details.error,
            fromCache: details.fromCache,
            resourceType: details.resourceType,
            size: 0,
            timeMs: durationMs,
        });
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        frame: false,
        backgroundColor: '#0d1117',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webviewTag: true,
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }

    // Window control IPC handlers
    ipcMain.on('window:minimize', () => mainWindow.minimize());
    ipcMain.on('window:maximize', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });
    ipcMain.on('window:close', () => mainWindow.close());
    ipcMain.handle('window:isMaximized', () => mainWindow.isMaximized());

    ipcMain.on('network:attach', (_event, webContentsId) => {
        if (typeof webContentsId !== 'number') return;
        trackedWebContents.add(webContentsId);
        ensureWebRequestHandlers();
    });

    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window:maximized-change', true);
    });
    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('window:maximized-change', false);
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
