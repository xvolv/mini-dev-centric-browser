const { app, BrowserWindow, ipcMain, session, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
require('dotenv').config();

const isDev = !app.isPackaged;

let mainWindow;
const trackedWebContents = new Set();
const requestStartTimes = new Map();
let webRequestAttached = false;
let githubToken = null;
const AI_SETTINGS_FILE = () => path.join(app.getPath('userData'), 'ai_settings.json');

function readAiSettings() {
    try {
        const raw = fs.readFileSync(AI_SETTINGS_FILE(), 'utf-8');
        const data = JSON.parse(raw);
        return {
            enabled: data?.enabled !== false,
            model: data?.model || 'llama-3.1-8b-instant',
            apiKey: data?.apiKey || '',
            includeActiveTabTitle: data?.includeActiveTabTitle !== false,
            includeActiveTabContent: data?.includeActiveTabContent !== false,
        };
    } catch {
        return {
            enabled: true,
            model: 'llama-3.1-8b-instant',
            apiKey: '',
            includeActiveTabTitle: true,
            includeActiveTabContent: true,
        };
    }
}

function writeAiSettings(next) {
    const current = readAiSettings();
    const payload = { ...current, ...next, savedAt: new Date().toISOString() };
    fs.writeFileSync(AI_SETTINGS_FILE(), JSON.stringify(payload, null, 2));
    return payload;
}

const GITHUB_AUTH_FILE = () => path.join(app.getPath('userData'), 'github_auth.json');

function readGithubToken() {
    try {
        const raw = fs.readFileSync(GITHUB_AUTH_FILE(), 'utf-8');
        const data = JSON.parse(raw);
        return data?.token || null;
    } catch {
        return null;
    }
}

function writeGithubToken(token) {
    if (!token) return;
    const payload = { token, savedAt: new Date().toISOString() };
    fs.writeFileSync(GITHUB_AUTH_FILE(), JSON.stringify(payload, null, 2));
}

function clearGithubToken() {
    try {
        fs.unlinkSync(GITHUB_AUTH_FILE());
    } catch {
        // ignore
    }
}

async function githubRequest(endpoint, options = {}) {
    const token = githubToken || readGithubToken();
    if (!token) throw new Error('GitHub token is missing.');
    const res = await fetch(`https://api.github.com${endpoint}`, {
        method: 'GET',
        ...options,
        headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'mini-dev-centric-browser',
            Authorization: `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `GitHub API error (${res.status}).`);
    }
    return res.json();
}

async function getRepoGit(repoPath) {
    if (!repoPath || typeof repoPath !== 'string') {
        throw new Error('Repository path is required.');
    }
    if (!fs.existsSync(repoPath)) {
        throw new Error('Repository path does not exist.');
    }
    const git = simpleGit({ baseDir: repoPath, binary: 'git' });
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
        throw new Error('Selected folder is not a Git repository.');
    }
    return git;
}

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

    const csp = "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss: http: https:;";
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const isRenderer = details.resourceType === 'mainFrame' && (
            details.url.startsWith('http://localhost:5173') ||
            details.url.startsWith('file://')
        );
        if (!isRenderer) return callback({ responseHeaders: details.responseHeaders });
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [csp],
            },
        });
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

    ipcMain.handle('api:send', async (_event, payload) => {
        try {
            const url = payload?.url ? String(payload.url) : '';
            const method = payload?.method ? String(payload.method) : 'GET';
            if (!url) throw new Error('Request URL is required.');

            const headers = payload?.headers && typeof payload.headers === 'object' ? payload.headers : {};
            const body = payload?.body;
            const options = { method, headers: { ...headers } };
            if (body !== undefined && body !== null && !['GET', 'HEAD'].includes(method.toUpperCase())) {
                options.body = body;
            }

            const startedAt = Date.now();
            const res = await session.defaultSession.fetch(url, options);
            const text = await res.text();
            const elapsedMs = Math.max(0, Date.now() - startedAt);
            return {
                ok: res.ok,
                status: res.status,
                statusText: res.statusText,
                timeMs: elapsedMs,
                size: text.length,
                headers: Array.from(res.headers.entries()),
                body: text,
            };
        } catch (error) {
            return { ok: false, error: error?.message || String(error) };
        }
    });

    ipcMain.handle('shell:openExternal', async (_event, url) => {
        if (!url || typeof url !== 'string') return { ok: false, error: 'Invalid URL.' };
        await shell.openExternal(url);
        return { ok: true };
    });

    ipcMain.handle('github:deviceCode', async () => {
        const clientId = process.env.GITHUB_CLIENT_ID;
        if (!clientId) {
            return { ok: false, error: 'GITHUB_CLIENT_ID is not configured.' };
        }
        const body = new URLSearchParams({
            client_id: clientId,
            scope: 'repo read:user',
        });
        const res = await fetch('https://github.com/login/device/code', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'mini-dev-centric-browser',
            },
            body,
        });
        const json = await res.json();
        if (json.error) {
            return { ok: false, error: json.error_description || json.error };
        }
        return { ok: true, ...json };
    });

    ipcMain.handle('github:poll', async (_event, deviceCode) => {
        const clientId = process.env.GITHUB_CLIENT_ID;
        if (!clientId) {
            return { ok: false, error: 'GITHUB_CLIENT_ID is not configured.' };
        }
        const body = new URLSearchParams({
            client_id: clientId,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        });
        const res = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'mini-dev-centric-browser',
            },
            body,
        });
        const json = await res.json();
        if (json.error) {
            return { ok: false, error: json.error, error_description: json.error_description };
        }
        if (json.access_token) {
            githubToken = json.access_token;
            writeGithubToken(json.access_token);
            return { ok: true, access_token: json.access_token, scope: json.scope };
        }
        return { ok: false, error: 'unknown_error' };
    });

    ipcMain.handle('github:status', async () => {
        try {
            const token = githubToken || readGithubToken();
            if (!token) return { ok: true, authenticated: false };
            githubToken = token;
            const user = await githubRequest('/user');
            return { ok: true, authenticated: true, user };
        } catch (error) {
            return { ok: false, error: error?.message || String(error) };
        }
    });

    ipcMain.handle('github:logout', async () => {
        githubToken = null;
        clearGithubToken();
        return { ok: true };
    });

    ipcMain.handle('github:listRepos', async (_event, page = 1) => {
        try {
            const data = await githubRequest(`/user/repos?per_page=50&page=${page}&sort=updated`);
            return { ok: true, repos: data };
        } catch (error) {
            return { ok: false, error: error?.message || String(error) };
        }
    });

    ipcMain.handle('github:chooseCloneDir', async () => {
        if (!mainWindow) return { ok: false, error: 'No window available.' };
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory', 'createDirectory'],
        });
        if (result.canceled || result.filePaths.length === 0) {
            return { ok: false, canceled: true };
        }
        return { ok: true, path: result.filePaths[0] };
    });

    ipcMain.handle('github:clone', async (_event, repoUrl, targetPath) => {
        try {
            if (!repoUrl || !targetPath) throw new Error('Repository URL and target path are required.');
            const git = simpleGit();
            await git.clone(repoUrl, targetPath);
            return { ok: true };
        } catch (error) {
            return { ok: false, error: error?.message || String(error) };
        }
    });

    ipcMain.handle('ai:getSettings', async () => {
        return { ok: true, settings: readAiSettings() };
    });

    ipcMain.handle('ai:setSettings', async (_event, settings) => {
        const saved = writeAiSettings(settings || {});
        return { ok: true, settings: saved };
    });

    ipcMain.handle('ai:chat', async (_event, payload) => {
        try {
            const { apiKey, model, messages } = payload || {};
            if (!apiKey) throw new Error('Missing Groq API key.');
            if (!Array.isArray(messages) || messages.length === 0) {
                throw new Error('No messages provided.');
            }
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model || 'llama-3.1-8b-instant',
                    messages,
                    temperature: 0.2,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                const message = json?.error?.message || `Groq error (${res.status}).`;
                return { ok: false, error: message };
            }
            const content = json?.choices?.[0]?.message?.content || '';
            return { ok: true, content };
        } catch (error) {
            return { ok: false, error: error?.message || String(error) };
        }
    });

    ipcMain.handle('git:selectRepo', async () => {
        if (!mainWindow) return { ok: false, error: 'No window available.' };
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
        });
        if (result.canceled || result.filePaths.length === 0) {
            return { ok: false, canceled: true };
        }
        return { ok: true, repoPath: result.filePaths[0] };
    });

    ipcMain.handle('git:status', async (_event, repoPath) => {
        try {
            const git = await getRepoGit(repoPath);
            const status = await git.status();
            return { ok: true, status };
        } catch (error) {
            return { ok: false, error: error?.message || String(error) };
        }
    });

    ipcMain.handle('git:branches', async (_event, repoPath) => {
        try {
            const git = await getRepoGit(repoPath);
            const branches = await git.branch();
            return { ok: true, branches };
        } catch (error) {
            return { ok: false, error: error?.message || String(error) };
        }
    });

    ipcMain.handle('git:commit', async (_event, repoPath, message) => {
        if (!message || !message.trim()) {
            return { ok: false, error: 'Commit message is required.' };
        }
        try {
            const git = await getRepoGit(repoPath);
            await git.add('.');
            const result = await git.commit(message.trim());
            return { ok: true, result };
        } catch (error) {
            return { ok: false, error: error?.message || String(error) };
        }
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
