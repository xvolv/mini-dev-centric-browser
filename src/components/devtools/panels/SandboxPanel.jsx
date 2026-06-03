import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

loader.config({ monaco });

const STORAGE_KEY = "mini-dev-centric.sandbox.v1";
const DEFAULT_HTML = `<div class="card">
  <h2>Hello World</h2>
  <p>Edit me!</p>
  <button id="btn">Click</button>
</div>`;
const DEFAULT_CSS = `.card {
  padding: 20px;
  border-radius: 8px;
  background: #1e293b;
  color: #e2e8f0;
  font-family: sans-serif;
  text-align: center;
}

h2 {
  color: #60a5fa;
}

button {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 12px;
}`;
const DEFAULT_JS = `document.getElementById('btn')?.addEventListener('click', () => {
  console.log('Button clicked from the sandbox');
});`;

const TAB_OPTIONS = ["html", "css", "js", "console"];
const DOWNLOAD_CLASS = "sandbox__download-link";
const GIT_STORAGE_KEY = "devcentric.repoPath";

function mapGitStatus(file) {
  const status = file.working_dir || file.index || "";
  if (status === "?" || status === "U") return "untracked";
  if (status === "A") return "added";
  if (status === "D") return "deleted";
  if (status === "R") return "renamed";
  return "modified";
}

function formatGitFile(file) {
  return {
    name: file.path,
    status: mapGitStatus(file),
  };
}

const MONACO_OPTIONS = {
  automaticLayout: true,
  fontSize: 14,
  fontLigatures: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  wordWrap: "on",
  tabSize: 2,
  renderLineHighlight: "all",
  renderWhitespace: "selection",
};

function buildFolderTree(entries) {
  const root = { path: "", name: "", type: "folder", children: [] };

  entries.forEach((entry) => {
    const segments = String(entry.path || "")
      .split("/")
      .filter(Boolean);
    if (segments.length === 0) return;
    let current = root;

    segments.forEach((segment, index) => {
      const isFile = index === segments.length - 1;
      const nextPath = current.path
        ? `${current.path}/${segment}`
        : segment;

      if (isFile) {
        current.children.push({
          path: nextPath,
          name: segment,
          type: "file",
          entry,
        });
        return;
      }

      let folder = current.children.find(
        (child) => child.type === "folder" && child.name === segment,
      );
      if (!folder) {
        folder = { path: nextPath, name: segment, type: "folder", children: [] };
        current.children.push(folder);
      }
      current = folder;
    });
  });

  const sortNodes = (nodes) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
      if (node.type === "folder" && node.children) {
        sortNodes(node.children);
      }
    });
  };

  sortNodes(root.children);
  return root.children;
}

function getFileIcon(ext) {
  if (ext === "html" || ext === "htm") return "H";
  if (ext === "css") return "C";
  if (ext === "js" || ext === "mjs") return "JS";
  return "F";
}

function getEditorLanguage(tab) {
  const ext = String(tab).split('.').pop()?.toLowerCase();
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "css") return "css";
  if (ext === "js" || ext === "mjs") return "javascript";
  if (ext === "json") return "json";
  if (ext === "md") return "markdown";
  return "plaintext";
}

/* ── VS Code–style SVG Icons ── */
const ChevronIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.7 13.7L5 13l4.6-5L5 3l.7-.7L10.8 8z" /></svg>
);
const FolderIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M14.5 3H7.7L6.7 2H1.5l-.5.5v11l.5.5h13l.5-.5V3.5l-.5-.5zM14 13H2V4h4.3l1 1H14v8z" /></svg>
);
const FolderOpenIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 14h11l.5-.5V13h.5l.5-.5v-2.2l-1 3.2H1.6L.5 10.5V3h5.2l1 1h5.8v2h1V3.5l-.5-.5H7.7l-1-1H1.5l-.5.5v11l.5.5z" /></svg>
);
const FileIcon = ({ color }) => (
  <svg viewBox="0 0 16 16" fill={color || "currentColor"}><path d="M13.7 4.3l-3-3-.4-.3H3.5l-.5.5v13l.5.5h9l.5-.5V4.7l-.3-.4zM13 5H10V2l3 3zM4 14V2h5v3.5l.5.5H12v8H4z" /></svg>
);
const GitBranchIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M14 4a2 2 0 10-2.47 1.94A2.5 2.5 0 019 8.5H7a3.96 3.96 0 00-2 .54V5.94a2 2 0 10-1 0v4.12a2 2 0 101 0A2.5 2.5 0 017.5 7.5H9a3.5 3.5 0 003.47-3.06A2 2 0 0014 4zM5 4a1 1 0 11-2 0 1 1 0 012 0zm0 8a1 1 0 11-2 0 1 1 0 012 0zm8-8a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M14.4 3.3L5.7 12 1.6 7.9l.7-.7 3.4 3.4 8-8 .7.7z" /></svg>
);
const ArrowUpIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 9.9L8 5.4l4.5 4.5-.7.7L8 6.8 4.2 10.6z" /></svg>
);
const RefreshIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M13.5 2v4H10l1.3-1.3A4.98 4.98 0 003 8a5 5 0 005 5 5 5 0 004.9-4h1A6 6 0 018 14 6 6 0 012 8a6 6 0 019.8-4.6L13.5 2z" /></svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z" /></svg>
);
const CloseIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 7.3L11.1 4.2l.7.7L8.7 8l3.1 3.1-.7.7L8 8.7 4.9 11.8l-.7-.7L7.3 8 4.2 4.9l.7-.7L8 7.3z" /></svg>
);
const SaveIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M13.4 1.6l1 1 .1.4V14l-.5.5H2l-.5-.5V2L2 1.5h10.4l1 .1zM3 14h10V3.2l-.8-.7H11v4H4V2.5H3V14zm5-9h2V2H8v3z" /></svg>
);
const SignInIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M11 1h-1v1h1v12h-1v1h1.5l.5-.5V1.5l-.5-.5H11zm-3.15 7l-3.56 3.56.71.71 4.5-4.5-4.5-4.5-.71.71L8.38 7H1v1h6.85z" /></svg>
);
const SignOutIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M11.15 8l-3.56 3.56.71.71 4.5-4.5-4.5-4.5-.71.71L11.38 7H2v1h9.15zM13 1h1.5l.5.5v13l-.5.5H13v-1h1V2h-1V1z" /></svg>
);
const LinkIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.4 3.6l1.1-1.1a3 3 0 014.2 0l.5.5a3 3 0 010 4.2l-2 2a3 3 0 01-4.2 0l-.4-.4.7-.7.4.4a2 2 0 002.8 0l2-2a2 2 0 000-2.8l-.5-.5a2 2 0 00-2.8 0L5.1 4.3l-.7-.7zm7.2 8.8l-1.1 1.1a3 3 0 01-4.2 0l-.5-.5a3 3 0 010-4.2l2-2a3 3 0 014.2 0l.4.4-.7.7-.4-.4a2 2 0 00-2.8 0l-2 2a2 2 0 000 2.8l.5.5a2 2 0 002.8 0l1.1-1.1.7.7z" /></svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M15.25 14.19l-4.06-4.06a5.5 5.5 0 10-1.06 1.06l4.06 4.06 1.06-1.06zM2 6.5a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0z" /></svg>
);
const SettingsGearIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.3.7L2 7.4v1.2l2.4.5.3.7-1.3 2 .8.9 2-1.3.7.3.5 2.4h1.2l.5-2.4.7-.3 2 1.3.9-.8-1.3-2 .3-.7 2.4-.5V7.4l-2.4-.5-.3-.7 1.3-2-.8-.9-2 1.3-.7-.3zM9.4 8a1.4 1.4 0 11-2.8 0 1.4 1.4 0 012.8 0z" /></svg>
);
const ExplorerIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 0h-9L7 1.5V6H2.5L1 7.5v15.07L2.5 24h12.07L16 22.57V18h4.7l1.3-1.43V4.5L17.5 0zm0 2.12l2.38 2.38H17.5V2.12zm-3 20.38h-12v-15H7v9.07L8.5 18h6v4.5zm6-6h-12v-15H16V6h4.5v10.5z" /></svg>
);
const TerminalIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 3h12v10H2V3zm1 1v8h10V4H3zm4.2 3.5l-2-2 .7-.7 1.6 1.6-1.6 1.6-.7-.7 2-1.8zM7 9h3v1H7V9z"/></svg>
);
const ClearAllIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M2.5 4h11v1h-11zM3 6h10v8H3zM4 7v6h8V7H4z"/></svg>
);
const PlayIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 2v12l10-6z"/></svg>
);

function getFileIconSvg(tab) {
  const ext = String(tab).split('.').pop()?.toLowerCase();
  if (ext === "html" || ext === "htm") return <FileIcon color="#e44d26" />;
  if (ext === "css") return <FileIcon color="#42a5f5" />;
  if (ext === "js" || ext === "mjs") return <FileIcon color="#f7df1e" />;
  if (ext === "json") return <FileIcon color="#a8b234" />;
  return <FileIcon color="#8b949e" />;
}

function readStoredSandbox() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function persistSandboxState(state) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore persistence failures.
  }
}

function formatTimestamp(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

function buildPreviewDocument(htmlContent, cssContent, jsContent) {
  const userHtml = String(htmlContent || "");
  const userCss = String(cssContent || "");
  const userJs = String(jsContent || "");

  // Escape closing script tags in user JS so they don't break the wrapping <script>
  const safeJs = userJs.replace(/<\/script/gi, "<\\/script");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss: http: https:">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root { color-scheme: dark; }
    html, body {
      margin: 0;
      min-height: 100%;
      background: #0d1117;
      color: #e6edf3;
      font-family: Segoe UI, -apple-system, BlinkMacSystemFont, sans-serif;
    }
    body {
      padding: 16px;
      box-sizing: border-box;
    }
    #sandbox-root {
      min-height: calc(100vh - 32px);
    }
    .sandbox-error {
      padding: 12px 14px;
      border: 1px solid rgba(248, 81, 73, 0.35);
      border-radius: 8px;
      background: rgba(248, 81, 73, 0.08);
      color: #ffb4ae;
      white-space: pre-wrap;
      font-family: Consolas, Monaco, monospace;
      font-size: 12px;
      line-height: 1.5;
    }
    .sandbox-error__title {
      font-weight: 700;
      margin-bottom: 6px;
      color: #f85149;
    }
    .sandbox-log-flash {
      position: fixed;
      right: 12px;
      bottom: 12px;
      z-index: 9999;
      max-width: 320px;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(22, 27, 34, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #e6edf3;
      font-size: 12px;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
    }
  </style>
  <style id="sandbox-user-css">${userCss}</style>
</head>
<body>
  <div id="sandbox-root">${userHtml}</div>
  <script>
    (function () {
      var parentBridge = window.parent;

      var serializeError = function(error) {
        if (!error) return 'Unknown error';
        if (typeof error === 'string') return error;
        var message = error.message || String(error);
        var stack = error.stack ? '\n' + error.stack : '';
        return message + stack;
      };

      var emit = function(type, message) {
        parentBridge.postMessage({
          source: 'sandbox-console',
          type: type,
          message: typeof message === 'string' ? message : String(message != null ? message : ''),
          timestamp: Date.now(),
        }, '*');
      };

      ['log', 'warn', 'error'].forEach(function(method) {
        var original = console[method].bind(console);
        console[method] = function() {
          var args = Array.prototype.slice.call(arguments);
          try {
            var text = args.map(function(item) {
              if (typeof item === 'string') return item;
              try { return JSON.stringify(item, null, 2); } catch(e) { return String(item); }
            }).join(' ');
            emit(method, text);
          } catch(e) {}
          return original.apply(console, args);
        };
      });

      window.addEventListener('error', function(event) {
        var message = event && event.error ? serializeError(event.error) : String((event && event.message) || 'Uncaught error');
        parentBridge.postMessage({ source: 'sandbox-console', type: 'error', message: message, timestamp: Date.now() }, '*');
        parentBridge.postMessage({ source: 'sandbox-status', status: 'error', error: message, timestamp: Date.now() }, '*');
      });

      window.addEventListener('unhandledrejection', function(event) {
        var reason = event && event.reason;
        var message = typeof reason === 'string' ? reason : serializeError(reason);
        parentBridge.postMessage({ source: 'sandbox-console', type: 'error', message: message, timestamp: Date.now() }, '*');
        parentBridge.postMessage({ source: 'sandbox-status', status: 'error', error: message, timestamp: Date.now() }, '*');
      });

      parentBridge.postMessage({ source: 'sandbox-status', status: 'rendered', timestamp: Date.now() }, '*');
    })();
  </script>
  <script>${safeJs}</script>
</body>
</html>`;
}

function downloadText(filename, text, mimeType = "text/plain") {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.className = DOWNLOAD_CLASS;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadCombinedHtml(state) {
  const html = buildPreviewDocument(state.html, state.css, state.js);
  downloadText("sandbox.html", html, "text/html");
}

function downloadSourceFile(filename, content, mimeType) {
  downloadText(filename, content, mimeType);
}

export default function SandboxPanel() {
  const stored = readStoredSandbox();
  const [html, setHtml] = useState(stored?.html || DEFAULT_HTML);
  const [css, setCss] = useState(stored?.css || DEFAULT_CSS);
  const [js, setJs] = useState(stored?.js || DEFAULT_JS);
  const [activeTab, setActiveTab] = useState(stored?.activeTab || "html");
  const [openTabs, setOpenTabs] = useState(stored?.openTabs || ["html", "css", "js"]);
  const [splitRatio, setSplitRatio] = useState(stored?.splitRatio ?? 52);
  const [showConsoleTimestamps, setShowConsoleTimestamps] = useState(
    stored?.showConsoleTimestamps ?? true,
  );
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("rendering");
  const [statusMessage, setStatusMessage] = useState("Rendering preview...");
  const [renderedHtml, setRenderedHtml] = useState(
    stored?.html || DEFAULT_HTML,
  );
  const [renderedCss, setRenderedCss] = useState(stored?.css || DEFAULT_CSS);
  const [renderedJs, setRenderedJs] = useState(stored?.js || DEFAULT_JS);
  const [previewTitle, setPreviewTitle] = useState("Sandbox Preview");
  const [previewUrl, setPreviewUrl] = useState("sandbox:///index.html");
  const [renderTrigger, setRenderTrigger] = useState(0);
  const iframeRef = useRef(null);
  const workspaceRef = useRef(null);
  const renderTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const dragStateRef = useRef(null);
  const [folderFiles, setFolderFiles] = useState([]);
  const [activeFolderFile, setActiveFolderFile] = useState("");
  const [isFolderDragActive, setIsFolderDragActive] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(() => new Set());
  const [newFileName, setNewFileName] = useState("");
  const [newFileType, setNewFileType] = useState("html");
  const [repoPath, setRepoPath] = useState("");
  const [branch, setBranch] = useState("");
  const [ahead, setAhead] = useState(0);
  const [behind, setBehind] = useState(0);
  const [files, setFiles] = useState([]);
  const [commitMsg, setCommitMsg] = useState("");
  const [gitLoading, setGitLoading] = useState(false);
  const [gitError, setGitError] = useState("");
  const [auth, setAuth] = useState({ authenticated: false, user: null });
  const [sidebarView, setSidebarView] = useState("scm");
  const [deviceFlow, setDeviceFlow] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [consoleInput, setConsoleInput] = useState("");
  const [consoleHistory, setConsoleHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const changedCount = files.length;

  const folderRootLabel = useMemo(() => {
    if (folderFiles.length === 0) return "Folder";
    const firstPath = String(folderFiles[0].path || "");
    const root = firstPath.split("/").filter(Boolean)[0];
    return root || "Folder";
  }, [folderFiles]);

  const folderTree = useMemo(
    () => buildFolderTree(folderFiles),
    [folderFiles],
  );

  const activeFolderEntry = useMemo(
    () => folderFiles.find((entry) => entry.path === activeTab) || null,
    [activeTab, folderFiles],
  );

  const statusBadge = useMemo(() => {
    if (!repoPath) return "No repo";
    if (ahead || behind) return `Ahead ${ahead} / Behind ${behind}`;
    return "Up to date";
  }, [repoPath, ahead, behind]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const results = [];
    const query = searchQuery.toLowerCase();
    
    const searchInText = (name, text, isFolderFile, fileOrTab) => {
      if (!text) return;
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(query)) {
          results.push({
            name,
            line: index + 1,
            snippet: line.trim(),
            isFolderFile,
            fileOrTab
          });
        }
      });
    };

    if (folderFiles.length > 0) {
      folderFiles.forEach(file => {
        searchInText(file.path, file.text, true, file);
      });
    } else {
      searchInText('index.html', html, false, 'html');
      searchInText('styles.css', css, false, 'css');
      searchInText('script.js', js, false, 'js');
    }
    
    return results;
  }, [searchQuery, folderFiles, html, css, js]);

  const updateFolderEntryText = useCallback((path, nextText) => {
    if (!path) return;
    setFolderFiles((prev) =>
      prev.map((entry) =>
        entry.path === path ? { ...entry, text: String(nextText || "") } : entry,
      ),
    );
  }, []);

  const persistState = useCallback(() => {
    persistSandboxState({
      html,
      css,
      js,
      activeTab,
      openTabs,
      splitRatio,
      showConsoleTimestamps,
    });
  }, [activeTab, openTabs, css, html, js, showConsoleTimestamps, splitRatio]);

  useEffect(() => {
    persistState();
  }, [persistState]);

  useEffect(() => {
    const input = folderInputRef.current;
    if (!input) return;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
    input.setAttribute("multiple", "");
  }, []);

  useEffect(() => {
    const loadAuth = async () => {
      const res = await window.electronAPI?.githubStatus?.();
      if (res?.ok && res.authenticated) {
        setAuth({ authenticated: true, user: res.user });
      }
    };
    loadAuth();
  }, []);

  useEffect(() => {
    if (!deviceFlow) return undefined;
    let stopped = false;

    const poll = async () => {
      if (stopped) return;

      const res = await window.electronAPI?.githubPoll?.(deviceFlow.device_code);
      if (!res) return;

      if (res.ok && res.access_token) {
        setDeviceStatus("Authenticated");
        const status = await window.electronAPI?.githubStatus?.();
        if (status?.ok && status.authenticated) {
          setAuth({ authenticated: true, user: status.user });
        }
        setDeviceFlow(null);
        return;
      }

      if (res.error === "authorization_pending") {
        setDeviceStatus("Waiting for approval...");
      } else if (res.error === "slow_down") {
        setDeviceStatus("Slow down requested by GitHub...");
      } else if (res.error) {
        setDeviceStatus(res.error_description || res.error);
      }

      setTimeout(poll, (deviceFlow.interval || 5) * 1000);
    };

    poll();
    return () => {
      stopped = true;
    };
  }, [deviceFlow]);

  const addLog = useCallback((entry) => {
    setLogs((prev) => [entry, ...prev].slice(0, 200));
  }, []);

  const clearConsole = useCallback(() => {
    setLogs([]);
  }, []);

  const executeConsoleInput = useCallback((code) => {
    if (!code.trim()) return;
    addLog({
      type: 'input',
      message: `> ${code}`,
      timestamp: Date.now(),
    });
    setConsoleHistory((prev) => [code, ...prev].slice(0, 50));
    setHistoryIndex(-1);
    try {
      const iframe = iframeRef.current;
      const iframeWindow = iframe?.contentWindow;
      if (iframeWindow) {
        // Temporarily intercept console methods to capture output directly
        const origLog = iframeWindow.console.log;
        const origWarn = iframeWindow.console.warn;
        const origError = iframeWindow.console.error;
        const captured = [];

        const serialize = (...args) => args.map((item) => {
          if (typeof item === 'string') return item;
          try { return JSON.stringify(item, null, 2); } catch { return String(item); }
        }).join(' ');

        iframeWindow.console.log = (...args) => {
          captured.push({ type: 'log', message: serialize(...args) });
          origLog.apply(iframeWindow.console, args);
        };
        iframeWindow.console.warn = (...args) => {
          captured.push({ type: 'warn', message: serialize(...args) });
          origWarn.apply(iframeWindow.console, args);
        };
        iframeWindow.console.error = (...args) => {
          captured.push({ type: 'error', message: serialize(...args) });
          origError.apply(iframeWindow.console, args);
        };

        const result = iframeWindow.eval(code);

        // Restore original methods
        iframeWindow.console.log = origLog;
        iframeWindow.console.warn = origWarn;
        iframeWindow.console.error = origError;

        // Show captured console output
        captured.forEach((entry) => {
          addLog({ ...entry, timestamp: Date.now() });
        });

        // Only show return value if it's not undefined (matches Chrome DevTools)
        if (result !== undefined) {
          let text;
          if (result === null) text = 'null';
          else if (typeof result === 'string') text = `'${result}'`;
          else if (typeof result === 'object') {
            try { text = JSON.stringify(result, null, 2); }
            catch { text = String(result); }
          } else {
            text = String(result);
          }
          addLog({
            type: 'log',
            message: `← ${text}`,
            timestamp: Date.now(),
          });
        }
      }
    } catch (err) {
      addLog({
        type: 'error',
        message: err?.message || String(err),
        timestamp: Date.now(),
      });
    }
  }, [addLog]);

  const loadRepoData = useCallback(async (path) => {
    if (!path) return;
    setGitLoading(true);
    setGitError("");

    try {
      const statusRes = await window.electronAPI?.gitStatus?.(path);
      if (!statusRes?.ok) {
        throw new Error(statusRes?.error || "Unable to read repository status.");
      }

      const status = statusRes.status;
      setFiles((status.files || []).map(formatGitFile));
      setAhead(status.ahead || 0);
      setBehind(status.behind || 0);

      const branchRes = await window.electronAPI?.gitBranches?.(path);
      if (!branchRes?.ok) {
        throw new Error(branchRes?.error || "Unable to read branches.");
      }
      setBranch(branchRes.branches.current || "");
    } catch (err) {
      setGitError(err?.message || String(err));
    } finally {
      setGitLoading(false);
    }
  }, []);

  const initRepoFromFolder = useCallback(async (folderPath) => {
    if (!folderPath) return;
    setRepoPath(folderPath);
    localStorage.setItem(GIT_STORAGE_KEY, folderPath);
    loadRepoData(folderPath);
  }, [loadRepoData]);

  const handleCommit = useCallback(async () => {
    if (!repoPath || !commitMsg.trim()) return;
    setGitLoading(true);
    setGitError("");

    try {
      const res = await window.electronAPI?.gitCommit?.(repoPath, commitMsg);
      if (!res?.ok) throw new Error(res?.error || "Commit failed.");
      setCommitMsg("");
      await loadRepoData(repoPath);
    } catch (err) {
      setGitError(err?.message || String(err));
    } finally {
      setGitLoading(false);
    }
  }, [commitMsg, loadRepoData, repoPath]);

  const handlePush = useCallback(async () => {
    if (!repoPath) return;
    setGitLoading(true);
    setGitError("");

    try {
      const res = await window.electronAPI?.gitPush?.(repoPath);
      if (!res?.ok) throw new Error(res?.error || "Push failed.");
      await loadRepoData(repoPath);
    } catch (err) {
      setGitError(err?.message || String(err));
    } finally {
      setGitLoading(false);
    }
  }, [loadRepoData, repoPath]);

  const handleLogout = useCallback(async () => {
    await window.electronAPI?.githubLogout?.();
    setAuth({ authenticated: false, user: null });
    setDeviceFlow(null);
    setDeviceStatus("");
  }, []);

  const startDeviceFlow = useCallback(async () => {
    setGitError("");
    setDeviceStatus("");
    const res = await window.electronAPI?.githubDeviceCode?.();
    if (!res?.ok) {
      setGitError(res?.error || "Unable to start GitHub login.");
      return;
    }
    setDeviceFlow(res);
    setDeviceStatus("Follow the steps to authorize this app.");
  }, []);

  const openVerification = useCallback(async () => {
    if (!deviceFlow?.verification_uri) return;
    await window.electronAPI?.openExternal?.(deviceFlow.verification_uri);
  }, [deviceFlow]);

  useEffect(() => {
    const saved = localStorage.getItem(GIT_STORAGE_KEY) || "";
    if (saved) {
      setRepoPath(saved);
      loadRepoData(saved);
    }
  }, [loadRepoData]);

  const handleMessage = useCallback(
    (event) => {
      const payload = event?.data;
      if (!payload || typeof payload !== "object") return;
      if (payload.source === "sandbox-console") {
        addLog({
          type: payload.type || "log",
          message: String(payload.message || ""),
          timestamp: payload.timestamp || Date.now(),
        });
        setStatus("rendered");
        setStatusMessage("Rendered successfully");
        return;
      }
      if (payload.source === "sandbox-status") {
        if (payload.status === "error") {
          setStatus("error");
          setStatusMessage(String(payload.error || "Sandbox error"));
        } else if (payload.status === "rendered") {
          setStatus("rendered");
          setStatusMessage("Rendered successfully");
        }
      }
    },
    [addLog],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Render preview by setting srcdoc on the iframe so the browser parses and
  // executes all inline <script> tags reliably (doc.write does NOT execute
  // scripts in Electron's sandboxed iframes).
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Compute preview URL / title
    const activeName = activeFolderFile?.split("/").pop();
    const fileName = activeName && (activeName.endsWith(".html") || activeName.endsWith(".htm"))
      ? activeName
      : "index.html";
    setPreviewUrl(`sandbox:///${fileName}`);
    setPreviewTitle(fileName);

    try {
      const fullDoc = buildPreviewDocument(renderedHtml, renderedCss, renderedJs);
      iframe.srcdoc = fullDoc;

      setStatus("rendered");
      setStatusMessage("Rendered successfully");
    } catch (error) {
      setStatus("error");
      setStatusMessage(error?.message || String(error));
    }
  }, [renderedHtml, renderedCss, renderedJs, activeFolderFile, renderTrigger]);

  const renderPreview = useCallback(() => {
    // Sync active tab to html/css/js state on manual run
    let currentHtml = html;
    let currentCss = css;
    let currentJs = js;

    const file = folderFiles.find(f => f.path === activeTab);
    if (file) {
      const ext = file.ext;
      if (ext === "html" || ext === "htm") { setHtml(file.text); currentHtml = file.text; }
      else if (ext === "css") { setCss(file.text); currentCss = file.text; }
      else if (ext === "js" || ext === "mjs") { setJs(file.text); currentJs = file.text; }
    }

    setStatus("rendering");
    setStatusMessage("Rendering preview...");
    setRenderedHtml(currentHtml);
    setRenderedCss(currentCss);
    setRenderedJs(currentJs);
    setRenderTrigger((prev) => prev + 1);
  }, [css, html, js, activeTab, folderFiles]);

  useEffect(() => {
    if (renderTimerRef.current) {
      clearTimeout(renderTimerRef.current);
    }

    renderTimerRef.current = setTimeout(() => {
      // Hot-reload only the currently synced states without changing context
      setStatus("rendering");
      setStatusMessage("Rendering preview...");
      setRenderedHtml(html);
      setRenderedCss(css);
      setRenderedJs(js);
      setRenderTrigger((prev) => prev + 1);
    }, 500);

    return () => {
      if (renderTimerRef.current) {
        clearTimeout(renderTimerRef.current);
      }
    };
  }, [html, css, js]);

  const exportState = useMemo(() => ({ html, css, js }), [css, html, js]);

  const handleExportHtml = () => {
    downloadSourceFile("sandbox.html", exportState.html, "text/html");
  };

  const handleExportCss = () => {
    downloadSourceFile("sandbox.css", exportState.css, "text/css");
  };

  const handleExportJs = () => {
    downloadSourceFile("sandbox.js", exportState.js, "text/javascript");
  };

  const handleExportAll = () => {
    downloadCombinedHtml(exportState);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const applyFolderEntries = (entries) => {
    const normalized = Array.isArray(entries) ? entries : [];
    const supported = normalized.filter((entry) =>
      ["html", "htm", "css", "js", "mjs"].includes(entry.ext),
    );

    setFolderFiles(supported);
    setActiveFolderFile("");

    if (supported.length > 0) {
      const root = String(supported[0].path || "")
        .split("/")
        .filter(Boolean)[0];
      setExpandedFolders(root ? new Set([root]) : new Set());
    } else {
      setExpandedFolders(new Set());
    }

    const pickFile = (exts, preferredNames) => {
      const byExt = supported.filter((entry) => exts.includes(entry.ext));
      if (byExt.length === 0) return null;
      const preferred = byExt.find((entry) =>
        preferredNames.some((name) =>
          entry.name.toLowerCase() === name ||
          entry.path.toLowerCase().endsWith(`/${name}`),
        ),
      );
      return preferred || byExt[0];
    };

    const htmlFile = pickFile(["html", "htm"], [
      "index.html",
      "main.html",
      "app.html",
    ]);
    const cssFile = pickFile(["css"], [
      "styles.css",
      "style.css",
      "main.css",
      "app.css",
      "index.css",
    ]);
    const jsFile = pickFile(["js", "mjs"], [
      "main.js",
      "app.js",
      "index.js",
      "script.js",
    ]);

    if (htmlFile?.text) setHtml(htmlFile.text);
    if (cssFile?.text) setCss(cssFile.text);
    if (jsFile?.text) setJs(jsFile.text);

    if (htmlFile?.text || cssFile?.text || jsFile?.text) {
      setActiveTab(htmlFile?.text ? "html" : cssFile?.text ? "css" : "js");
      setStatus("rendering");
      setStatusMessage("Imported folder, rendering preview...");
    } else if (supported.length > 0) {
      setStatus("rendering");
      setStatusMessage("Folder loaded. Select a file to preview.");
    } else {
      setStatus("error");
      setStatusMessage("Folder imported but no supported files found.");
    }
  };

  const handleImportFolderClick = async () => {
    if (window.electronAPI?.openSandboxFolder) {
      const result = await window.electronAPI.openSandboxFolder();
      if (result?.canceled) return;
      if (!result?.ok) {
        setStatus("error");
        setStatusMessage(result?.error || "Failed to open folder.");
        return;
      }
      applyFolderEntries(result?.entries || []);
      // Auto-detect git repo from opened folder path
      if (result?.folderPath) {
        initRepoFromFolder(result.folderPath);
      } else if (result?.entries?.length > 0) {
        // Try to derive folder path from entries
        const firstPath = String(result.entries[0].path || "");
        const root = firstPath.split("/").filter(Boolean)[0];
        if (root) {
          initRepoFromFolder(root);
        }
      }
      return;
    }
    folderInputRef.current?.click();
  };

  const readFolderFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (files.length === 0) return;

    const entries = await Promise.all(
      files.map(async (file) => {
        const path = file.webkitRelativePath || file.name || "";
        const name = file.name || path.split("/").pop() || "";
        const ext = name.includes(".")
          ? name.split(".").pop()?.toLowerCase()
          : "";
        let text = "";
        try {
          text = await file.text();
        } catch {
          text = "";
        }
        return { path, name, ext, text };
      }),
    );

    applyFolderEntries(entries);
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");
      const bodyHtml = doc.body?.innerHTML || "";
      const styleText = Array.from(doc.querySelectorAll("style"))
        .map((style) => style.textContent || "")
        .join("\n\n");
      const scriptText = Array.from(doc.querySelectorAll("script"))
        .filter(
          (script) =>
            !script.type ||
            script.type === "text/javascript" ||
            script.type === "module",
        )
        .map((script) => script.textContent || "")
        .join("\n\n");

      setHtml(bodyHtml || DEFAULT_HTML);
      if (styleText.trim()) setCss(styleText);
      if (scriptText.trim()) setJs(scriptText);
      setActiveTab("html");
      setStatus("rendering");
      setStatusMessage("Imported file, rendering preview...");
    } catch (error) {
      setStatus("error");
      setStatusMessage(
        error?.message || String(error) || "Failed to import file",
      );
    }
  };

  const handleImportFolder = async (event) => {
    const files = event.target.files;
    event.target.value = "";
    await readFolderFiles(files);
  };

  const handleFolderDrop = async (event) => {
    event.preventDefault();
    setIsFolderDragActive(false);
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    await readFolderFiles(files);
  };

  const handleFolderDragOver = (event) => {
    event.preventDefault();
    setIsFolderDragActive(true);
  };

  const handleFolderDragLeave = () => {
    setIsFolderDragActive(false);
  };

  const handleOpenFolderFile = (entry) => {
    if (!entry) return;
    
    setOpenTabs((prev) => {
      if (!prev.includes(entry.path)) {
        return [...prev, entry.path];
      }
      return prev;
    });
    
    setActiveFolderFile(entry.path);
    setActiveTab(entry.path);

    setStatus("idle");
    setStatusMessage(`Loaded ${entry.name}. Click Run to preview.`);
  };

  const handleCloseTab = (e, tabToClose) => {
    e.stopPropagation();
    setOpenTabs((prev) => {
      const newTabs = prev.filter((t) => t !== tabToClose);
      if (activeTab === tabToClose) {
        const currentIndex = prev.indexOf(tabToClose);
        const nextTab = newTabs[currentIndex] || newTabs[currentIndex - 1] || newTabs[0] || "";
        setActiveTab(nextTab);
      }
      return newTabs;
    });
  };

  const clearFolderFiles = () => {
    setFolderFiles([]);
    setActiveFolderFile("");
    setExpandedFolders(new Set());
  };

  const normalizeFileName = (value, ext) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const sanitized = raw.replace(/[\\:*?"<>|]/g, "-");
    const hasExt = sanitized.includes(".");
    if (hasExt) return sanitized;
    return `${sanitized}.${ext}`;
  };

  const handleCreateFile = () => {
    const ext = newFileType || "html";
    const filename = normalizeFileName(newFileName, ext);
    if (!filename) return;

    const rootName = folderFiles.length > 0 ? folderRootLabel : "sandbox";
    const path = `${rootName}/${filename}`;
    const exists = folderFiles.some(
      (entry) => entry.path.toLowerCase() === path.toLowerCase(),
    );
    if (exists) {
      setStatus("error");
      setStatusMessage("File already exists in this folder.");
      return;
    }

    const entry = {
      path,
      name: filename.split("/").pop() || filename,
      ext,
      text: "",
    };

    setFolderFiles((prev) => [...prev, entry]);
    setActiveFolderFile(path);
    setNewFileName("");
    handleOpenFolderFile(entry);
  };

  const toggleFolderExpanded = (path) => {
    if (!path) return;
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleDeleteFile = (filePath) => {
    if (!filePath) return;
    setFolderFiles((prev) => prev.filter((entry) => entry.path !== filePath));
    if (activeFolderFile === filePath) {
      setActiveFolderFile("");
    }
  };

  const renderTreeNodes = (nodes, depth = 0) =>
    nodes.map((node) => {
      if (node.type === "folder") {
        const isExpanded = expandedFolders.has(node.path);
        return (
          <div key={node.path} className="sandbox__tree-group">
            <button
              type="button"
              className="sandbox__tree-item sandbox__tree-folder"
              onClick={() => toggleFolderExpanded(node.path)}
              style={{ paddingLeft: `${8 + depth * 14}px` }}
            >
              <span className={`sandbox__tree-chevron${isExpanded ? " sandbox__tree-chevron--expanded" : ""}`}>
                <ChevronIcon />
              </span>
              <span className="sandbox__tree-icon sandbox__tree-icon--folder">
                {isExpanded ? <FolderOpenIcon /> : <FolderIcon />}
              </span>
              <span className="sandbox__tree-name">{node.name}</span>
            </button>
            {isExpanded ? (
              <div className="sandbox__tree-children">
                {renderTreeNodes(node.children || [], depth + 1)}
              </div>
            ) : null}
          </div>
        );
      }

      const isActive = activeFolderFile === node.path;
      const fileClass = node.entry?.ext
        ? `sandbox__tree-file--${node.entry.ext}`
        : "";
      return (
        <div
          key={node.path}
          className={`sandbox__tree-item sandbox__tree-file ${fileClass} ${isActive ? "sandbox__tree-file--active" : ""}`}
          style={{ paddingLeft: `${24 + depth * 14}px`, display: 'flex', alignItems: 'center' }}
          title={node.path}
        >
          <button
            type="button"
            onClick={() => handleOpenFolderFile(node.entry)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, font: 'inherit' }}
          >
            <span className="sandbox__tree-icon">
              {getFileIconSvg(node.entry?.ext)}
            </span>
            <span className="sandbox__tree-name">{node.name}</span>
          </button>
          <button
            type="button"
            className="sandbox__tree-delete-btn"
            onClick={(e) => { e.stopPropagation(); handleDeleteFile(node.path); }}
            title={`Delete ${node.name}`}
          >
            <CloseIcon />
          </button>
        </div>
      );
    });

  const updateSplitRatio = useCallback((clientX) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    const bounds = workspace.getBoundingClientRect();
    if (!bounds.width) return;

    const nextRatio = ((clientX - bounds.left) / bounds.width) * 100;
    setSplitRatio(Math.min(75, Math.max(25, nextRatio)));
  }, []);

  const handleDividerPointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const handlePointerMove = (moveEvent) => {
      updateSplitRatio(moveEvent.clientX);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      dragStateRef.current = null;
      document.body.classList.remove("sandbox--resizing");
    };

    dragStateRef.current = true;
    document.body.classList.add("sandbox--resizing");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  const statusClass =
    status === "rendered"
      ? "sandbox__status-dot sandbox__status-dot--rendered"
      : status === "error"
        ? "sandbox__status-dot sandbox__status-dot--error"
        : "sandbox__status-dot sandbox__status-dot--rendering";

  const activeLabel =
    activeTab === "html"
      ? "HTML"
      : activeTab === "css"
        ? "CSS"
        : activeTab === "js"
          ? "JavaScript"
          : activeTab === "console"
            ? "Console"
            : "Settings";

  return (
    <div className="tool-panel sandbox">

      <div className="sandbox__workspace" ref={workspaceRef}>
        <section
          className="sandbox__left-panel"
          style={{ flexBasis: `${splitRatio}%` }}
        >
          <div className="sandbox__activity-bar">
            <button
              type="button"
              className={`sandbox__activity-btn ${sidebarView === "explorer" ? "sandbox__activity-btn--active" : ""}`}
              onClick={() => setSidebarView("explorer")}
              title="Explorer"
            >
              <ExplorerIcon />
            </button>
            <button
              type="button"
              className={`sandbox__activity-btn ${sidebarView === "search" ? "sandbox__activity-btn--active" : ""}`}
              onClick={() => setSidebarView("search")}
              title="Search"
            >
              <SearchIcon />
            </button>
            <button
              type="button"
              className={`sandbox__activity-btn ${sidebarView === "scm" ? "sandbox__activity-btn--active" : ""}`}
              onClick={() => setSidebarView("scm")}
              title="Source Control"
            >
              <GitBranchIcon />
            </button>
            <div className="sandbox__activity-bottom">
              <button
                type="button"
                className={`sandbox__activity-btn ${isConsoleOpen ? "sandbox__activity-btn--active" : ""}`}
                onClick={() => setIsConsoleOpen(!isConsoleOpen)}
                title="Terminal / Console"
              >
                <TerminalIcon />
              </button>
            </div>
          </div>

          <div className="sandbox__sidebar-views">
            {/* SOURCE CONTROL VIEW */}
            <div className={`sandbox__sidebar-view ${sidebarView === "scm" ? "sandbox__sidebar-view--active" : ""}`}>
              <div className="sandbox__git-card" style={{ width: '100%', maxWidth: 'none', borderRight: 'none', flex: 1 }}>
                {/* Header */}
                <div className="sandbox__git-card-header" style={{ borderBottom: '1px solid var(--border-muted)', paddingBottom: '10px' }}>
                  <div className="sandbox__git-card-title">Source Control</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className="btn sandbox__explorer-btn sandbox__icon-btn"
                      onClick={() => repoPath && loadRepoData(repoPath)}
                      disabled={!repoPath || gitLoading}
                      title="Refresh"
                      style={{ padding: '4px' }}
                    >
                      <span className="sandbox__btn-icon"><RefreshIcon /></span>
                    </button>
                  </div>
                </div>

                {!repoPath ? (
                  /* No repo state — prompt to open folder */
                  <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, margin: '0 auto 12px', opacity: 0.4, color: 'var(--text-muted)' }}>
                      <GitBranchIcon />
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
                      Open a folder in the Explorer to initialize source control.
                    </div>
                    <button
                      type="button"
                      className="btn sandbox__explorer-btn sandbox__icon-btn"
                      onClick={() => { handleImportFolderClick(); setSidebarView('explorer'); }}
                      style={{ width: '100%', justifyContent: 'center', padding: '7px 12px', borderRadius: '4px', background: 'var(--accent-blue)', color: '#fff', border: 'none' }}
                    >
                      <span className="sandbox__btn-icon"><FolderOpenIcon /></span>
                      <span className="sandbox__btn-text">Open Folder</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Commit input */}
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-muted)' }}>
                      <textarea
                        className="sandbox__git-input"
                        placeholder="Message (Ctrl+Enter to commit)"
                        value={commitMsg}
                        onChange={(event) => setCommitMsg(event.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleCommit();
                          }
                        }}
                        style={{ margin: 0, width: '100%', minHeight: '40px' }}
                      />
                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                        <button
                          type="button"
                          className="btn sandbox__explorer-btn sandbox__icon-btn"
                          onClick={handleCommit}
                          disabled={!commitMsg.trim() || gitLoading}
                          style={{ flex: 1, justifyContent: 'center', padding: '5px 10px', borderRadius: '4px', background: 'var(--accent-green)', color: '#fff', border: 'none', opacity: !commitMsg.trim() || gitLoading ? 0.5 : 1, fontSize: '12px' }}
                        >
                          <span className="sandbox__btn-icon"><CheckIcon /></span>
                          <span className="sandbox__btn-text">Commit</span>
                        </button>
                        <button
                          type="button"
                          className="btn sandbox__explorer-btn sandbox__icon-btn"
                          onClick={handlePush}
                          disabled={gitLoading || !auth.authenticated}
                          title={!auth.authenticated ? 'Sign in to GitHub first' : 'Push to remote'}
                          style={{ padding: '5px 8px', borderRadius: '4px', border: '1px solid var(--border-muted)', opacity: gitLoading || !auth.authenticated ? 0.4 : 1 }}
                        >
                          <span className="sandbox__btn-icon"><ArrowUpIcon /></span>
                        </button>
                      </div>
                    </div>

                    {/* Branch & repo info bar */}
                    <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-muted)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ width: 12, height: 12, display: 'inline-flex' }}><GitBranchIcon /></span>
                        {branch || '—'}
                      </span>
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                        {ahead > 0 && <span>↑{ahead}</span>}
                        {behind > 0 && <span>↓{behind}</span>}
                      </span>
                    </div>

                    {/* Changed files list */}
                    <div style={{ flex: 1, overflow: 'auto' }}>
                      <div style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Changes</span>
                        <span style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: 700 }}>{changedCount}</span>
                      </div>
                      {files.length === 0 ? (
                        <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', opacity: 0.7 }}>
                          No pending changes
                        </div>
                      ) : (
                        files.map((file, i) => {
                          const statusColor = file.status === 'added' || file.status === 'untracked'
                            ? 'var(--accent-green)'
                            : file.status === 'deleted'
                              ? 'var(--accent-red)'
                              : file.status === 'renamed'
                                ? 'var(--accent-purple, #a371f7)'
                                : 'var(--accent-yellow)';
                          const statusLetter = file.status === 'added' ? 'A'
                            : file.status === 'untracked' ? 'U'
                            : file.status === 'deleted' ? 'D'
                            : file.status === 'renamed' ? 'R'
                            : 'M';
                          const fileName = String(file.name || '').split('/').pop();
                          const filePath = String(file.name || '');
                          return (
                            <div
                              key={i}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '3px 12px',
                                fontSize: '12px',
                                cursor: 'default',
                                transition: 'background 0.1s',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            >
                              <span style={{ width: 14, height: 14, display: 'inline-flex', flexShrink: 0, color: 'var(--text-muted)' }}>
                                <FileIcon color={statusColor} />
                              </span>
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={filePath}>
                                {fileName}
                              </span>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60px' }} title={filePath}>
                                {filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : ''}
                              </span>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: statusColor,
                                width: '14px',
                                textAlign: 'center',
                                flexShrink: 0,
                              }}>
                                {statusLetter}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* GitHub auth section (collapsed) */}
                    <div style={{ borderTop: '1px solid var(--border-muted)', padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: auth.authenticated ? 0 : '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>GitHub</span>
                        <span style={{ fontSize: '10px', color: auth.authenticated ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                          {auth.authenticated ? `● ${auth.user?.login || 'Connected'}` : '○ Not connected'}
                        </span>
                      </div>
                      {!auth.authenticated && (
                        <button
                          type="button"
                          className="btn sandbox__explorer-btn sandbox__icon-btn"
                          onClick={startDeviceFlow}
                          style={{ width: '100%', justifyContent: 'center', padding: '5px 10px', borderRadius: '4px', background: 'var(--accent-blue)', color: '#fff', border: 'none', fontSize: '12px' }}
                        >
                          <span className="sandbox__btn-icon"><SignInIcon /></span>
                          <span className="sandbox__btn-text">Sign in with GitHub</span>
                        </button>
                      )}
                      {auth.authenticated && (
                        <button
                          type="button"
                          className="btn sandbox__explorer-btn sandbox__icon-btn"
                          onClick={handleLogout}
                          style={{ width: '100%', justifyContent: 'center', padding: '4px 10px', borderRadius: '4px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px', opacity: 0.7 }}
                        >
                          <span className="sandbox__btn-text">Sign out</span>
                        </button>
                      )}
                      {deviceFlow?.verification_uri && (
                        <div className="sandbox__git-note" style={{ marginTop: '6px', marginLeft: 0, marginRight: 0 }}>
                          1) Open <a href="#" onClick={(e) => { e.preventDefault(); openVerification(); }} style={{ color: 'var(--accent-blue)', textDecoration: 'underline', cursor: 'pointer' }}>{deviceFlow.verification_uri}</a>
                          <br />
                          2) Enter code <strong>{deviceFlow.user_code}</strong>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Status messages */}
                {gitLoading && <div className="sandbox__git-caption" style={{ textAlign: 'center' }}>Working...</div>}
                {gitError && <div className="sandbox__git-error">{gitError}</div>}
                {deviceStatus && !auth.authenticated && (
                  <div className="sandbox__git-caption" style={{ textAlign: 'center' }}>{deviceStatus}</div>
                )}
              </div>
            </div>

            {/* EXPLORER VIEW */}
            <div className={`sandbox__sidebar-view ${sidebarView === "explorer" ? "sandbox__sidebar-view--active" : ""}`}>
              <aside
                className="sandbox__explorer"
                onDrop={handleFolderDrop}
                onDragOver={handleFolderDragOver}
                onDragLeave={handleFolderDragLeave}
                style={{ borderTop: 'none' }}
              >
                <div className="sandbox__explorer-header">
                  <span className="sandbox__explorer-title">Explorer</span>
                  <div className="sandbox__explorer-actions">
                    <button
                      type="button"
                      className="btn sandbox__explorer-btn sandbox__icon-btn"
                      onClick={handleImportFolderClick}
                      title="Open Folder"
                      aria-label="Open Folder"
                    >
                      <span className="sandbox__btn-icon"><FolderOpenIcon /></span>
                      <span className="sandbox__btn-text">Open</span>
                    </button>
                    <button
                      type="button"
                      className="btn sandbox__explorer-btn sandbox__icon-btn"
                      onClick={handleExportAll}
                      title="Save All"
                      aria-label="Save All"
                    >
                      <span className="sandbox__btn-icon"><SaveIcon /></span>
                      <span className="sandbox__btn-text">Save</span>
                    </button>
                    {folderFiles.length > 0 ? (
                      <button
                        type="button"
                        className="btn sandbox__explorer-btn sandbox__icon-btn"
                        onClick={clearFolderFiles}
                        title="Clear Folder"
                        aria-label="Clear Folder"
                      >
                        <span className="sandbox__btn-icon"><CloseIcon /></span>
                        <span className="sandbox__btn-text">Clear</span>
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="sandbox__explorer-body">
                  <div className="sandbox__explorer-create">
                    <input
                      className="sandbox__explorer-input"
                      type="text"
                      value={newFileName}
                      onChange={(event) => setNewFileName(event.target.value)}
                      placeholder="New file name"
                    />
                    <select
                      className="sandbox__explorer-select"
                      value={newFileType}
                      onChange={(event) => setNewFileType(event.target.value)}
                    >
                      <option value="html">HTML</option>
                      <option value="css">CSS</option>
                      <option value="js">JS</option>
                    </select>
                    <button
                      type="button"
                      className="btn sandbox__explorer-btn sandbox__icon-btn"
                      onClick={handleCreateFile}
                      disabled={!newFileName.trim()}
                    >
                      <span className="sandbox__btn-icon"><PlusIcon /></span>
                      <span className="sandbox__btn-text">Create</span>
                    </button>
                  </div>
                  {folderFiles.length === 0 ? (
                    <div
                      className={`sandbox__explorer-empty ${isFolderDragActive ? "sandbox__explorer-empty--active" : ""}`}
                    >
                      Drop a folder here to load HTML, CSS, and JS files.
                    </div>
                  ) : (
                    <div className="sandbox__tree">
                      <div className="sandbox__tree-root">{folderRootLabel}</div>
                      {renderTreeNodes(folderTree)}
                    </div>
                  )}
                </div>
              </aside>
            </div>

            {/* SEARCH VIEW */}
            <div className={`sandbox__sidebar-view ${sidebarView === "search" ? "sandbox__sidebar-view--active" : ""}`}>
              <div className="sandbox__git-card-header" style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <div className="sandbox__git-card-title">Search</div>
              </div>
              <div style={{ padding: '10px', borderBottom: '1px solid var(--border-muted)' }}>
                <input
                  type="text"
                  className="sandbox__explorer-input"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', marginBottom: 0 }}
                />
              </div>
              <div className="sandbox__search-results" style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
                {!searchQuery.trim() ? (
                  <div className="sandbox__empty-state" style={{ padding: '0 20px' }}>
                    Type to search files.
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="sandbox__empty-state" style={{ padding: '0 20px' }}>
                    No results found.
                  </div>
                ) : (
                  searchResults.map((res, i) => (
                    <div 
                      key={i} 
                      className="sandbox__tree-item"
                      onClick={() => {
                        if (res.isFolderFile) {
                          handleOpenFolderFile(res.fileOrTab);
                        } else {
                          setActiveTab(res.fileOrTab);
                        }
                      }}
                      style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '4px 20px', height: 'auto', cursor: 'pointer' }}
                    >
                      <div style={{ color: 'var(--text-primary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {res.name} <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>:{res.line}</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                        {res.snippet}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            </div>

          <div className="sandbox__left-content">
            {openTabs.length > 0 ? (
              <div className="sandbox__editor-shell">
                <div className="sandbox__editor-tabs" style={{ display: 'flex', background: 'var(--bg-tertiary)', overflowX: 'auto' }}>
                  {openTabs.map((tab) => (
                    <div 
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab);
                        const file = folderFiles.find(f => f.path === tab);
                        if (file) {
                          setStatus("idle");
                          setStatusMessage(`Loaded ${file.name}. Click Run to preview.`);
                        }
                      }}
                      style={{
                        padding: '8px 16px',
                        fontSize: '12px',
                        color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                        background: activeTab === tab ? 'var(--bg-primary)' : 'transparent',
                        borderRight: '1px solid var(--border-muted)',
                        cursor: 'pointer',
                        borderTop: activeTab === tab ? '1px solid var(--accent-blue)' : '1px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        minWidth: 'fit-content'
                      }}
                    >
                      <span className="sandbox__tree-icon" style={{ width: 14, height: 14 }}>
                        {getFileIconSvg(tab)}
                      </span>
                      {tab === 'js' ? 'script.js' : tab === 'css' ? 'styles.css' : tab === 'html' ? 'index.html' : String(tab).split('/').pop()}
                      <span
                        className="sandbox__tab-close"
                        onClick={(e) => handleCloseTab(e, tab)}
                        style={{
                          marginLeft: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '16px',
                          height: '16px',
                          borderRadius: '4px',
                          opacity: 0.6,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.6; e.currentTarget.style.background = 'transparent'; }}
                      >
                        ×
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: '8px' }}>
                  <button
                    type="button"
                    onClick={renderPreview}
                    title="Run (Re-render preview)"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 12px',
                      background: 'var(--accent-green)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                  >
                    <span style={{ width: 12, height: 12, display: 'inline-flex' }}><PlayIcon /></span>
                    Run
                  </button>
                </div>
                <div className="sandbox__monaco-shell">
                  <Editor
                    className="sandbox__monaco"
                    theme="vs-dark"
                    language={getEditorLanguage(activeTab)}
                    path={activeTab}
                    value={
                      activeFolderEntry
                        ? activeFolderEntry.text || ""
                        : activeTab === "html"
                          ? html
                          : activeTab === "css"
                            ? css
                            : js
                    }
                    onChange={(nextValue) => {
                      const nextText = nextValue ?? "";
                      if (activeFolderEntry) {
                        updateFolderEntryText(activeFolderEntry.path, nextText);
                        // Sync to global state so preview updates
                        const ext = activeFolderEntry.ext;
                        if (ext === "html" || ext === "htm") setHtml(nextText);
                        else if (ext === "css") setCss(nextText);
                        else if (ext === "js" || ext === "mjs") setJs(nextText);
                      } else {
                        if (activeTab === "html") setHtml(nextText);
                        else if (activeTab === "css") setCss(nextText);
                        else if (activeTab === "js") setJs(nextText);
                      }
                      setStatus("idle");
                      setStatusMessage("Editing...");
                    }}
                    options={MONACO_OPTIONS}
                    loading={
                      <div style={{ padding: "1rem", color: "#8b949e" }}>
                        Loading Editor...
                      </div>
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="sandbox__empty-state" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ opacity: 0.5, marginBottom: '16px' }}>
                  <svg viewBox="0 0 16 16" fill="currentColor" width="64" height="64">
                    <path d="M14.5 3H7.7L6.7 2H1.5l-.5.5v11l.5.5h13l.5-.5V3.5l-.5-.5zM14 13H2V4h4.3l1 1H14v8z" />
                  </svg>
                </div>
                <div style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-muted)' }}>No active files</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', opacity: 0.8 }}>Select a file from the explorer to open it.</div>
              </div>
            )}

            {isConsoleOpen && (
              <div className="sandbox__bottom-panel">
                <div className="sandbox__bottom-panel-header">
                  <div className="sandbox__bottom-panel-tabs">
                    <span className="sandbox__bottom-panel-tab sandbox__bottom-panel-tab--active">CONSOLE</span>
                  </div>
                  <div className="sandbox__bottom-panel-actions">
                    <button type="button" onClick={clearConsole} title="Clear Console">
                      <ClearAllIcon />
                    </button>
                    <button type="button" onClick={() => setIsConsoleOpen(false)} title="Close Panel">
                      <CloseIcon />
                    </button>
                  </div>
                </div>
                <div className="sandbox__console-list">
                  {logs.length === 0 ? (
                    <div className="sandbox__empty-state">
                      Console output will appear here when the sandbox runs.
                    </div>
                  ) : (
                    logs.map((entry, index) => (
                      <div
                        key={`${entry.timestamp}-${index}`}
                        className={`sandbox__console-item sandbox__console-item--${entry.type}`}
                      >
                        <div className="sandbox__console-meta">
                          <span className="sandbox__console-type">
                            {entry.type}
                          </span>
                          {showConsoleTimestamps ? (
                            <span className="sandbox__console-time">
                              {formatTimestamp(entry.timestamp)}
                            </span>
                          ) : null}
                        </div>
                        <pre className="sandbox__console-message">
                          {entry.message}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
                <div className="sandbox__console-input-row">
                  <span className="sandbox__console-prompt">&gt;</span>
                  <input
                    className="sandbox__console-input"
                    type="text"
                    value={consoleInput}
                    onChange={(e) => setConsoleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && consoleInput.trim()) {
                        executeConsoleInput(consoleInput);
                        setConsoleInput('');
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHistoryIndex((prev) => {
                          const next = Math.min(prev + 1, consoleHistory.length - 1);
                          if (consoleHistory[next]) setConsoleInput(consoleHistory[next]);
                          return next;
                        });
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setHistoryIndex((prev) => {
                          const next = prev - 1;
                          if (next < 0) {
                            setConsoleInput('');
                            return -1;
                          }
                          setConsoleInput(consoleHistory[next] || '');
                          return next;
                        });
                      }
                    }}
                    placeholder="Type JavaScript and press Enter…"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        <div
          className="sandbox__splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor and preview panes"
          tabIndex={0}
          onPointerDown={handleDividerPointerDown}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setSplitRatio((current) => Math.max(25, current - 5));
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              setSplitRatio((current) => Math.min(75, current + 5));
            }
          }}
        />

        <section className="sandbox__preview-panel">
          <div className="sandbox__preview-heading">
            <span>Preview</span>
            <span className="sandbox__preview-caption">Live iframe render</span>
          </div>
          <div className="sandbox__preview-bar">
            <div className="sandbox__preview-meta">
              <span className="sandbox__preview-title">{previewTitle}</span>
              <span className="sandbox__preview-url">{previewUrl}</span>
            </div>
          </div>
          <iframe
            ref={iframeRef}
            className="sandbox__preview-iframe"
            title="Sandbox Preview"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        </section>
      </div>

      <div className="sandbox__footnote">
        Active tab: {activeLabel}. Preview updates automatically after a short
        debounce.
      </div>
    </div>
  );
}
