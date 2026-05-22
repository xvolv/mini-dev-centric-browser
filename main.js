if (process.env.NODE_ENV !== "production") {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
}

const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  dialog,
  shell,
  webContents,
} = require("electron");
const fs = require("fs");
const path = require("path");
const simpleGit = require("simple-git");
require("dotenv").config();
const { initDatabase, closeDatabase } = require("./electron/database/db");
const {
  addHistory,
  getHistory,
  removeHistory,
  addBookmark,
  getBookmarks,
  removeBookmark,
} = require("./electron/database/history");
const {
  buildConsoleExportText,
  buildDefaultConsoleExportFilename,
} = require("./electron/exporters/consoleExporter");

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception in main process:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection in main process:", reason);
});

process.on("exit", (code) => {
  console.log("Main process exiting with code:", code);
});

const isDev = !app.isPackaged;

let mainWindow;
const trackedWebContents = new Set();
const consoleTrackedWebContents = new Set();
const historyTrackedWebContents = new Set();
const requestStartTimes = new Map();
let webRequestAttached = false;
let githubToken = null;

function persistBrowsingHistory(webContentsId) {
  const contents = webContents.fromId(webContentsId);
  if (!contents) return;

  const url = String(contents.getURL?.() || "").trim();
  if (!url || url === "about:blank") return;

  const title = String(contents.getTitle?.() || "").trim();
  try {
    addHistory(url, title);
  } catch (error) {
    console.error("Failed to persist browsing history:", error);
  }
}

function attachHistoryTracking(webContentsId) {
  if (typeof webContentsId !== "number") return;
  if (historyTrackedWebContents.has(webContentsId)) return;

  const contents = webContents.fromId(webContentsId);
  if (!contents) return;

  historyTrackedWebContents.add(webContentsId);

  const handleFinishLoad = () => persistBrowsingHistory(webContentsId);
  const handleNavigateInPage = () => persistBrowsingHistory(webContentsId);

  contents.on("did-finish-load", handleFinishLoad);
  contents.on("did-navigate-in-page", handleNavigateInPage);

  contents.once("destroyed", () => {
    historyTrackedWebContents.delete(webContentsId);
  });
}

function attachConsoleTracking(webContentsId) {
  if (typeof webContentsId !== "number") return;
  if (consoleTrackedWebContents.has(webContentsId)) return;

  const contents = webContents.fromId(webContentsId);
  if (!contents) return;

  consoleTrackedWebContents.add(webContentsId);

  const handleConsoleMessage = (_event, level, message, line, sourceId) => {
    mainWindow?.webContents.send("console:event", {
      webContentsId,
      level,
      message: String(message || ""),
      line: Number.isFinite(line) ? line : 0,
      sourceId: String(sourceId || ""),
      timestamp: Date.now(),
    });
  };

  contents.on("console-message", handleConsoleMessage);

  contents.once("destroyed", () => {
    consoleTrackedWebContents.delete(webContentsId);
    try {
      contents.removeListener("console-message", handleConsoleMessage);
    } catch {
      // ignore
    }
  });
}

const resolveAppIcon = () => {
  if (app.isPackaged) {
    const packagedIcon = path.join(process.resourcesPath, "favicon.ico");
    if (fs.existsSync(packagedIcon)) return packagedIcon;
  }
  const devPng = path.join(
    __dirname,
    "src",
    "public",
    "mini-dec-centric-logo.png",
  );
  if (fs.existsSync(devPng)) return devPng;
  const devIco = path.join(__dirname, "src", "favicon_io", "favicon.ico");
  if (fs.existsSync(devIco)) return devIco;
  return undefined;
};
const APP_CONFIG_FILE = () => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app-config.json");
  }
  return path.join(__dirname, "app-config.json");
};
const readAppConfig = () => {
  try {
    const raw = fs.readFileSync(APP_CONFIG_FILE(), "utf-8");
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
};
const AI_SETTINGS_FILE = () =>
  path.join(app.getPath("userData"), "ai_settings.json");

function readAiSettings() {
  try {
    const raw = fs.readFileSync(AI_SETTINGS_FILE(), "utf-8");
    const data = JSON.parse(raw);
    return {
      enabled: data?.enabled !== false,
      model: data?.model || "llama-3.1-8b-instant",
      apiKey: data?.apiKey || "",
      includeActiveTabTitle: data?.includeActiveTabTitle !== false,
      includeActiveTabContent: data?.includeActiveTabContent !== false,
    };
  } catch {
    return {
      enabled: true,
      model: "llama-3.1-8b-instant",
      apiKey: "",
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

const GITHUB_AUTH_FILE = () =>
  path.join(app.getPath("userData"), "github_auth.json");

function readGithubToken() {
  try {
    const raw = fs.readFileSync(GITHUB_AUTH_FILE(), "utf-8");
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
  if (!token) throw new Error("GitHub token is missing.");
  const res = await fetch(`https://api.github.com${endpoint}`, {
    method: "GET",
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "mini-dev-centric-browser",
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
  if (!repoPath || typeof repoPath !== "string") {
    throw new Error("Repository path is required.");
  }
  if (!fs.existsSync(repoPath)) {
    throw new Error("Repository path does not exist.");
  }
  const git = simpleGit({ baseDir: repoPath, binary: "git" });
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new Error("Selected folder is not a Git repository.");
  }
  return git;
}

// Global safeguard: ignore benign aborted navigations from any webContents
app.on("web-contents-created", (_event, contents) => {
  try {
    contents.on(
      "did-fail-load",
      (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
        try {
          if (!isMainFrame) return;
          // Ignore aborted navigations (ERR_ABORTED / -3)
          if (errorCode === -3) return;
          // For other errors, log at warn level but don't throw
          console.warn("webContents did-fail-load", {
            errorCode,
            validatedURL,
          });
        } catch (err) {
          // swallow any unexpected errors in handler
        }
      },
    );
  } catch (err) {
    // ignore failures when attaching listener
  }
});

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

    mainWindow?.webContents.send("network:event", {
      type: "completed",
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

    mainWindow?.webContents.send("network:event", {
      type: "error",
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
  console.log("Creating main window...");
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: "#0d1117",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true,
    },
    icon: resolveAppIcon(),
  });

  mainWindow.on("closed", () => {
    console.log("Main window closed");
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error("Main window did-fail-load:", {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame,
      });
    },
  );

  mainWindow.webContents.on("did-start-loading", () => {
    console.log("Main window did-start-loading");
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Main window did-finish-load", mainWindow.webContents.getURL());
  });

  mainWindow.webContents.on("did-navigate", (_event, url) => {
    console.log("Main window did-navigate", url);
  });

  mainWindow.webContents.on("did-navigate-in-page", (_event, url) => {
    console.log("Main window did-navigate-in-page", url);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("Main window render-process-gone:", details);
  });

  mainWindow.webContents.on("unresponsive", () => {
    console.error("Main window webContents unresponsive");
  });

  mainWindow.webContents.on("crashed", (_event, killed) => {
    console.error("Main window webContents crashed:", { killed });
  });

  mainWindow.webContents.on("destroyed", () => {
    console.error("Main window webContents destroyed");
  });

  mainWindow.on("unresponsive", () => {
    console.error("Main window became unresponsive");
  });

  const csp =
    "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss: http: https:;";
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isRenderer =
      details.resourceType === "mainFrame" &&
      (details.url.startsWith("http://localhost:5173") ||
        details.url.startsWith("file://"));
    if (!isRenderer)
      return callback({ responseHeaders: details.responseHeaders });
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173").catch((error) => {
      console.error("Failed to load dev URL:", error);
    });
  } else {
    mainWindow
      .loadFile(path.join(__dirname, "dist", "index.html"))
      .catch((error) => {
        console.error("Failed to load production file:", error);
      });
  }

  // Window control IPC handlers
  ipcMain.on("window:minimize", () => mainWindow.minimize());
  ipcMain.on("window:maximize", () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on("window:close", () => mainWindow.close());
  ipcMain.handle("window:isMaximized", () => mainWindow.isMaximized());

  ipcMain.on("network:attach", (_event, webContentsId) => {
    if (typeof webContentsId !== "number") return;
    trackedWebContents.add(webContentsId);
    ensureWebRequestHandlers();
    attachHistoryTracking(webContentsId);
    attachConsoleTracking(webContentsId);
  });

  ipcMain.handle("history:add", async (_event, url, title) => {
    try {
      addHistory(url, title);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle("history:search", async (_event, query) => {
    try {
      return getHistory(query);
    } catch (error) {
      console.error("Failed to search browsing history:", error);
      return [];
    }
  });

  ipcMain.handle("history:remove", async (_event, id) => {
    try {
      removeHistory(id);
      return { ok: true };
    } catch (error) {
      console.error("Failed to remove history entry:", error);
      return { ok: false, error: error?.message || String(error) };
    }
  });

  // Bookmark IPC handlers
  ipcMain.handle("bookmark:add", async (_event, url, title) => {
    try {
      addBookmark(url, title);
      return { ok: true };
    } catch (error) {
      console.error("Failed to add bookmark:", error);
      return { ok: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle("bookmark:get", async (_event) => {
    try {
      return getBookmarks();
    } catch (error) {
      console.error("Failed to get bookmarks:", error);
      return [];
    }
  });

  ipcMain.handle("bookmark:remove", async (_event, id) => {
    try {
      removeBookmark(id);
      return { ok: true };
    } catch (error) {
      console.error("Failed to remove bookmark:", error);
      return { ok: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle("api:send", async (_event, payload) => {
    try {
      const url = payload?.url ? String(payload.url) : "";
      const method = payload?.method ? String(payload.method) : "GET";
      if (!url) throw new Error("Request URL is required.");

      const headers =
        payload?.headers && typeof payload.headers === "object"
          ? payload.headers
          : {};
      const body = payload?.body;
      const options = { method, headers: { ...headers } };
      if (
        body !== undefined &&
        body !== null &&
        !["GET", "HEAD"].includes(method.toUpperCase())
      ) {
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

  ipcMain.handle("console:export", async (_event, entries) => {
    try {
      console.log("console:export requested", {
        count: Array.isArray(entries) ? entries.length : 0,
      });
      const windowRef =
        mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
      const dialogOptions = {
        title: "Export Console Logs",
        defaultPath: buildDefaultConsoleExportFilename(new Date()),
        filters: [{ name: "Text Files", extensions: ["txt"] }],
      };
      const result = windowRef
        ? await dialog.showSaveDialog(windowRef, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);

      if (result.canceled || !result.filePath) {
        return { ok: false, canceled: true };
      }

      const text = buildConsoleExportText(entries);
      fs.writeFileSync(result.filePath, text, "utf-8");
      console.log("console:export success", { filePath: result.filePath });
      return { ok: true, filePath: result.filePath };
    } catch (error) {
      console.error("Failed to export console logs:", error);
      return { ok: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle("shell:openExternal", async (_event, url) => {
    if (!url || typeof url !== "string")
      return { ok: false, error: "Invalid URL." };
    await shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle("github:deviceCode", async () => {
    const clientId =
      process.env.GITHUB_CLIENT_ID || readAppConfig().githubClientId;
    if (!clientId) {
      return { ok: false, error: "GITHUB_CLIENT_ID is not configured." };
    }
    const body = new URLSearchParams({
      client_id: clientId,
      scope: "repo read:user",
    });
    const res = await fetch("https://github.com/login/device/code", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "mini-dev-centric-browser",
      },
      body,
    });
    const json = await res.json();
    if (json.error) {
      return { ok: false, error: json.error_description || json.error };
    }
    return { ok: true, ...json };
  });

  ipcMain.handle("github:poll", async (_event, deviceCode) => {
    const clientId =
      process.env.GITHUB_CLIENT_ID || readAppConfig().githubClientId;
    if (!clientId) {
      return { ok: false, error: "GITHUB_CLIENT_ID is not configured." };
    }
    const body = new URLSearchParams({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "mini-dev-centric-browser",
      },
      body,
    });
    const json = await res.json();
    if (json.error) {
      return {
        ok: false,
        error: json.error,
        error_description: json.error_description,
      };
    }
    if (json.access_token) {
      githubToken = json.access_token;
      writeGithubToken(json.access_token);
      return { ok: true, access_token: json.access_token, scope: json.scope };
    }
    return { ok: false, error: "unknown_error" };
  });

  ipcMain.handle("github:status", async () => {
    try {
      const token = githubToken || readGithubToken();
      if (!token) return { ok: true, authenticated: false };
      githubToken = token;
      const user = await githubRequest("/user");
      return { ok: true, authenticated: true, user };
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle("github:logout", async () => {
    githubToken = null;
    clearGithubToken();
    return { ok: true };
  });

  ipcMain.handle("github:listRepos", async (_event, page = 1) => {
    try {
      const data = await githubRequest(
        `/user/repos?per_page=50&page=${page}&sort=updated`,
      );
      return { ok: true, repos: data };
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle("github:chooseCloneDir", async () => {
    if (!mainWindow) return { ok: false, error: "No window available." };
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }
    return { ok: true, path: result.filePaths[0] };
  });

  ipcMain.handle("github:clone", async (_event, repoUrl, targetPath) => {
    try {
      if (!repoUrl || !targetPath)
        throw new Error("Repository URL and target path are required.");
      const git = simpleGit();
      await git.clone(repoUrl, targetPath);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle("ai:getSettings", async () => {
    return { ok: true, settings: readAiSettings() };
  });

  ipcMain.handle("ai:setSettings", async (_event, settings) => {
    const saved = writeAiSettings(settings || {});
    return { ok: true, settings: saved };
  });

  ipcMain.handle("ai:chat", async (_event, payload) => {
    try {
      const { apiKey, model, messages } = payload || {};
      if (!apiKey) throw new Error("Missing Groq API key.");
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error("No messages provided.");
      }
      const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: model || "llama-3.1-8b-instant",
            messages,
            temperature: 0.2,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        const message = json?.error?.message || `Groq error (${res.status}).`;
        return { ok: false, error: message };
      }
      const content = json?.choices?.[0]?.message?.content || "";
      return { ok: true, content };
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle("git:selectRepo", async () => {
    if (!mainWindow) return { ok: false, error: "No window available." };
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }
    return { ok: true, repoPath: result.filePaths[0] };
  });

  ipcMain.handle("git:status", async (_event, repoPath) => {
    try {
      const git = await getRepoGit(repoPath);
      const status = await git.status();
      return { ok: true, status };
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle("git:branches", async (_event, repoPath) => {
    try {
      const git = await getRepoGit(repoPath);
      const branches = await git.branch();
      return { ok: true, branches };
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle("git:commit", async (_event, repoPath, message) => {
    if (!message || !message.trim()) {
      return { ok: false, error: "Commit message is required." };
    }
    try {
      const git = await getRepoGit(repoPath);
      await git.add(".");
      const result = await git.commit(message.trim());
      return { ok: true, result };
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  });

  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("window:maximized-change", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("window:maximized-change", false);
  });
}

app.whenReady().then(async () => {
  try {
    console.log("Electron app ready; initializing database...");
    await initDatabase();
    console.log("Database initialized; creating window...");
    createWindow();
  } catch (error) {
    console.error("Failed to initialize SQLite database:", error);
    app.quit();
  }
});

app.on("child-process-gone", (_event, details) => {
  console.error("Electron child process gone:", details);
});

app.on("window-all-closed", () => {
  closeDatabase();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  closeDatabase();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
