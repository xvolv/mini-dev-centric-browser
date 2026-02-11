import React, { useCallback, useEffect, useRef, useState } from "react";
import TitleBar from "./components/layout/TitleBar";
import TabBar from "./components/layout/TabBar";
import AddressBar from "./components/layout/AddressBar";
import BrowserView from "./components/browser/BrowserView";
import DevToolsPanel from "./components/devtools/DevToolsPanel";

let nextTabId = 2;

export default function App() {
  const [tabs, setTabs] = useState([{ id: 1, title: "New Tab", url: "" }]);
  const [activeTabId, setActiveTabId] = useState(1);
  const [devToolsOpen, setDevToolsOpen] = useState(true);
  const [activeTool, setActiveTool] = useState("console");
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [networkLogs, setNetworkLogs] = useState({});
  const [latestApiRequestByTab, setLatestApiRequestByTab] = useState({});
  const [consoleLogs, setConsoleLogs] = useState({});
  const [deviceSim, setDeviceSim] = useState({
    enabled: false,
    deviceName: "iPhone 12",
    width: 390,
    height: 844,
    orientation: "portrait",
  });
  const [tabHtml, setTabHtml] = useState({});
  const [aiDraft, setAiDraft] = useState({ id: 0, text: "" });
  const webviewRefs = useRef({});
  const tabToWebContents = useRef(new Map());
  const webContentsToTab = useRef(new Map());

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const getActiveWebview = useCallback(
    () => webviewRefs.current[activeTabId],
    [activeTabId],
  );

  const handleNavigate = (url) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              url,
              title:
                url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] ||
                "New Tab",
            }
          : t,
      ),
    );
  };

  const handleTitleUpdate = useCallback(
    (title) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId ? { ...t, title: title || t.title } : t,
        ),
      );
    },
    [activeTabId],
  );

  const handleUrlUpdate = useCallback(
    (url) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, url } : t)),
      );
    },
    [activeTabId],
  );

  const handleNavStateChange = useCallback(
    ({ canGoBack: back, canGoForward: forward }) => {
      setCanGoBack(back);
      setCanGoForward(forward);
    },
    [],
  );

  const handleSelectionAction = useCallback((selection) => {
    const text =
      typeof selection?.text === "string" ? selection.text.trim() : "";
    if (!text) return;
    setAiDraft({ id: Date.now(), text });
    setActiveTool("ai");
    setDevToolsOpen(true);
  }, []);

  const handleNewTab = () => {
    const id = nextTabId++;
    setTabs((prev) => [...prev, { id, title: "New Tab", url: "" }]);
    setActiveTabId(id);
  };

  const handleCloseTab = (id) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        const newId = nextTabId++;
        setActiveTabId(newId);
        return [{ id: newId, title: "New Tab", url: "" }];
      }
      if (activeTabId === id) {
        setActiveTabId(next[next.length - 1].id);
      }
      return next;
    });
    setNetworkLogs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setConsoleLogs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setLatestApiRequestByTab((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTabHtml((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    const webContentsId = tabToWebContents.current.get(id);
    if (webContentsId) {
      tabToWebContents.current.delete(id);
      webContentsToTab.current.delete(webContentsId);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === "t") {
        e.preventDefault();
        handleNewTab();
      }
      if (e.key === "F12") {
        e.preventDefault();
        setDevToolsOpen((p) => !p);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onNetworkEvent) return undefined;
    const unsubscribe = window.electronAPI.onNetworkEvent((entry) => {
      const tabId = webContentsToTab.current.get(entry.webContentsId);
      if (!tabId) return;
      const resourceType =
        typeof entry.resourceType === "string" ? entry.resourceType : "";
      const isApiRequest = resourceType === "xhr" || resourceType === "fetch";
      setNetworkLogs((prev) => {
        const next = { ...prev };
        const list = next[tabId] ? [...next[tabId]] : [];
        list.unshift(entry);
        next[tabId] = list.slice(0, 200);
        return next;
      });
      if (isApiRequest && entry.url && entry.method) {
        setLatestApiRequestByTab((prev) => ({
          ...prev,
          [tabId]: {
            method: entry.method,
            url: entry.url,
            status: entry.status,
            resourceType,
            receivedAt: Date.now(),
          },
        }));
      }
    });
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    const webview = getActiveWebview();
    if (!webview) return;
    try {
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    } catch {
      setCanGoBack(false);
      setCanGoForward(false);
    }
  }, [activeTabId, getActiveWebview]);

  return (
    <div className="app">
      <TitleBar />
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
      />
      <AddressBar
        url={activeTab?.url || ""}
        onNavigate={handleNavigate}
        isLoading={isLoading}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={() => {
          const webview = getActiveWebview();
          if (webview?.canGoBack()) webview.goBack();
        }}
        onForward={() => {
          const webview = getActiveWebview();
          if (webview?.canGoForward()) webview.goForward();
        }}
        onReload={() => {
          const webview = getActiveWebview();
          if (!webview) return;
          if (isLoading && webview.isLoading()) {
            webview.stop();
          } else {
            webview.reload();
          }
        }}
        devToolsOpen={devToolsOpen}
        onToggleDevTools={() => setDevToolsOpen((p) => !p)}
      />
      <div className="main-content">
        <BrowserView
          tabs={tabs}
          activeTabId={activeTabId}
          isLoading={isLoading}
          onLoadingChange={setIsLoading}
          onTitleUpdate={handleTitleUpdate}
          onUrlUpdate={handleUrlUpdate}
          onNavStateChange={handleNavStateChange}
          deviceSim={deviceSim}
          onSelectionAction={handleSelectionAction}
          onApiRequest={(tabId, payload) => {
            const method = payload?.method ? String(payload.method) : "";
            const url = payload?.url ? String(payload.url) : "";
            if (!method || !url) return;
            setLatestApiRequestByTab((prev) => ({
              ...prev,
              [tabId]: {
                method,
                url,
                headers: payload?.headers || {},
                body: payload?.body,
                source: payload?.source || "webview",
                resourceType: payload?.source || "webview",
                status: null,
                receivedAt: payload?.capturedAt || Date.now(),
              },
            }));
          }}
          onPageContent={(tabId, html) => {
            const limit = 100 * 1024;
            const trimmed =
              typeof html === "string" ? html.slice(0, limit) : "";
            setTabHtml((prev) => ({
              ...prev,
              [tabId]: { html: trimmed, updatedAt: Date.now() },
            }));
          }}
          onConsoleMessage={(tabId, entry) => {
            const levelMap = {
              0: "log",
              1: "warn",
              2: "error",
              3: "info",
            };
            const type = levelMap[entry.level] || "log";
            const time = new Date().toLocaleTimeString("en-US", {
              hour12: false,
            });
            setConsoleLogs((prev) => {
              const next = { ...prev };
              const list = next[tabId] ? [...next[tabId]] : [];
              list.unshift({
                type,
                text: entry.message,
                time,
                sourceId: entry.sourceId,
                line: entry.line,
              });
              next[tabId] = list.slice(0, 200);
              return next;
            });
          }}
          onWebviewReady={(tabId, webContentsId, webview) => {
            webviewRefs.current[tabId] = webview;
            tabToWebContents.current.set(tabId, webContentsId);
            webContentsToTab.current.set(webContentsId, tabId);
            window.electronAPI?.attachNetwork?.(webContentsId);
          }}
        />
        {devToolsOpen && (
          <DevToolsPanel
            activeTool={activeTool}
            onToolChange={setActiveTool}
            consoleEntries={consoleLogs[activeTabId] || []}
            onClearConsole={() => {
              setConsoleLogs((prev) => ({ ...prev, [activeTabId]: [] }));
            }}
            networkEntries={networkLogs[activeTabId] || []}
            onClearNetwork={() => {
              setNetworkLogs((prev) => ({ ...prev, [activeTabId]: [] }));
            }}
            deviceSim={deviceSim}
            onDeviceSimChange={setDeviceSim}
            activeTabTitle={activeTab?.title || ""}
            activeTabHtml={tabHtml[activeTabId]?.html || ""}
            activeTabHtmlUpdatedAt={tabHtml[activeTabId]?.updatedAt || null}
            aiDraft={aiDraft}
            latestApiRequest={latestApiRequestByTab[activeTabId] || null}
          />
        )}
      </div>
    </div>
  );
}
