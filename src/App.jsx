import React, { useCallback, useEffect, useRef, useState } from "react";
import TitleBar from "./components/layout/TitleBar";
import TabBar from "./components/layout/TabBar";
import AddressBar from "./components/layout/AddressBar";
import BookmarksBar from "./components/layout/BookmarksBar";
import BrowserView from "./components/browser/BrowserView";
import DevToolsPanel from "./components/devtools/DevToolsPanel";

let nextTabId = 2;

export default function App() {
  const [tabs, setTabs] = useState([
    { id: 1, title: "New Tab", url: "", favicon: "" },
  ]);

  const [activeTabId, setActiveTabId] = useState(1);
  const [activeTool, setActiveTool] = useState(null);

  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const [networkLogs, setNetworkLogs] = useState({});
  const [latestApiRequestByTab, setLatestApiRequestByTab] = useState({});
  const [consoleLogs, setConsoleLogs] = useState({});
  const [bookmarks, setBookmarks] = useState([]);

  const [deviceSim, setDeviceSim] = useState({
    enabled: false,
    deviceName: "iPhone 12",
    width: 390,
    height: 844,
    orientation: "portrait",
    multiPane: false,
  });

  const [tabHtml, setTabHtml] = useState({});
  const [aiDraft, setAiDraft] = useState({ id: 0, text: "" });

  const webviewRefs = useRef({});
  const tabToWebContents = useRef(new Map());
  const webContentsToTab = useRef(new Map());
  const recentConsoleKeysRef = useRef(new Map());

  const requestAddressBarFocus = useRef(() => {});

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const pushConsoleLog = useCallback((tabId, entry) => {
    if (tabId == null || !entry) return;

    const key = [
      tabId,
      entry.level,
      entry.message,
      entry.line,
      entry.sourceId,
    ].join("|");
    const now = Date.now();
    const previous = recentConsoleKeysRef.current.get(key) || 0;
    if (now - previous < 1000) return;
    recentConsoleKeysRef.current.set(key, now);

    const levelMap = {
      0: "log",
      1: "warn",
      2: "error",
      3: "info",
    };

    const type = levelMap[entry.level] || "log";

    const time = new Date(entry.timestamp || now).toLocaleTimeString("en-US", {
      hour12: false,
    });

    setConsoleLogs((prev) => {
      const next = { ...prev };
      const list = next[tabId] ? [...next[tabId]] : [];

      list.unshift({
        type,
        text: String(entry.message || ""),
        time,
        timestamp: entry.timestamp || now,
        sourceId: entry.sourceId,
        line: entry.line,
        stack: entry.stack || "",
      });

      next[tabId] = list.slice(0, 200);
      return next;
    });
  }, []);

  const getActiveWebview = useCallback(
    () => webviewRefs.current[activeTabId],
    [activeTabId],
  );

  // FIXED MISSING FUNCTION
  const registerAddressBarFocus = useCallback((focusFn) => {
    requestAddressBarFocus.current = focusFn;
  }, []);

  const handleNavigate = (url) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              url,
              favicon: "",
              title:
                url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] ||
                "New Tab",
            }
          : t,
      ),
    );
  };

  const handleFaviconUpdate = useCallback((tabId, favicon) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? {
              ...t,
              favicon: typeof favicon === "string" ? favicon : "",
            }
          : t,
      ),
    );
  }, []);

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

    setAiDraft({
      id: Date.now(),
      text,
    });

    setActiveTool("ai");
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onConsoleEvent?.((entry) => {
      const tabId = webContentsToTab.current.get(entry.webContentsId);
      if (tabId == null) return;
      pushConsoleLog(tabId, entry);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [pushConsoleLog]);

  const handleNewTab = () => {
    const id = nextTabId++;

    setTabs((prev) => [
      ...prev,
      {
        id,
        title: "New Tab",
        url: "",
        favicon: "",
      },
    ]);

    setActiveTabId(id);

    setTimeout(() => {
      requestAddressBarFocus.current?.();
    }, 50);
  };

  const handleCloseTab = (id) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);

      if (next.length === 0) {
        const newId = nextTabId++;

        setActiveTabId(newId);

        return [
          {
            id: newId,
            title: "New Tab",
            url: "",
            favicon: "",
          },
        ];
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
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (activeTool === "device") {
      setDeviceSim((prev) => ({
        ...prev,
        enabled: true,
        multiPane: true,
      }));
    } else {
      setDeviceSim((prev) => ({
        ...prev,
        enabled: false,
        multiPane: false,
      }));
    }
  }, [activeTool]);

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

  const handleBookmarkSelect = (url) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === activeTabId ? { ...tab, url } : tab)),
    );

    setActiveTool(null);
  };

  const refreshBookmarks = useCallback(async () => {
    try {
      const bookmarkData = await window.api?.getBookmarks?.();
      setBookmarks(Array.isArray(bookmarkData) ? bookmarkData : []);
    } catch (error) {
      console.error("Failed to load bookmarks:", error);
      setBookmarks([]);
    }
  }, []);

  const handleBookmarkSaved = useCallback(
    (bookmark) => {
      if (bookmark?.url) {
        setBookmarks((prev) => {
          const next = prev.filter((entry) => entry.url !== bookmark.url);
          return [
            {
              id: bookmark.id || `local-${Date.now()}`,
              url: bookmark.url,
              title: bookmark.title || bookmark.url,
              created_at: bookmark.created_at || Date.now(),
            },
            ...next,
          ];
        });
      }
      refreshBookmarks();
    },
    [refreshBookmarks],
  );

  const handleBookmarkRemoved = useCallback(
    async (bookmark) => {
      if (!bookmark?.id) return;

      try {
        await window.api?.removeBookmark?.(bookmark.id);
        setBookmarks((prev) =>
          prev.filter((entry) => entry.id !== bookmark.id),
        );
        refreshBookmarks();
      } catch (error) {
        console.error("Failed to remove bookmark:", error);
      }
    },
    [refreshBookmarks],
  );

  useEffect(() => {
    refreshBookmarks();
  }, [refreshBookmarks]);

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
        title={activeTab?.title || ""}
        favicon={activeTab?.favicon || ""}
        onNavigate={handleNavigate}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={() => {
          const webview = getActiveWebview();

          if (webview?.canGoBack()) {
            webview.goBack();
          }
        }}
        onForward={() => {
          const webview = getActiveWebview();

          if (webview?.canGoForward()) {
            webview.goForward();
          }
        }}
        onReload={() => {
          const webview = getActiveWebview();

          if (!webview) return;

          webview.reload();
        }}
        activeTool={activeTool}
        onToolChange={(id) => {
          setActiveTool((prev) => (prev === id ? null : id));
        }}
        onRegisterFocus={registerAddressBarFocus}
        onBookmarkSaved={handleBookmarkSaved}
      />

      {!activeTab?.url && (
        <BookmarksBar
          bookmarks={bookmarks}
          onSelectBookmark={({ url }) => {
            if (!url) return;
            handleNavigate(url);
          }}
          onRemoveBookmark={handleBookmarkRemoved}
        />
      )}

      <div className="main-content">
        <BrowserView
          tabs={tabs}
          activeTabId={activeTabId}
          onTitleUpdate={handleTitleUpdate}
          onUrlUpdate={handleUrlUpdate}
          onFaviconUpdate={handleFaviconUpdate}
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
              [tabId]: {
                html: trimmed,
                updatedAt: Date.now(),
              },
            }));
          }}
          onConsoleMessage={(tabId, entry) => {
            if (shouldIgnoreConsoleMessage(entry.message)) return;
            pushConsoleLog(tabId, {
              ...entry,
              timestamp: entry.timestamp || Date.now(),
            });
          }}
          onWebviewReady={(tabId, webContentsId, webview) => {
            webviewRefs.current[tabId] = webview;

            tabToWebContents.current.set(tabId, webContentsId);

            webContentsToTab.current.set(webContentsId, tabId);

            window.electronAPI?.attachNetwork?.(webContentsId);
          }}
        />

        {activeTool && activeTool !== "device" && (
          <DevToolsPanel
            activeTool={activeTool}
            onToolChange={setActiveTool}
            consoleEntries={consoleLogs[activeTabId] || []}
            onClearConsole={() => {
              setConsoleLogs((prev) => ({
                ...prev,
                [activeTabId]: [],
              }));
            }}
            networkEntries={networkLogs[activeTabId] || []}
            onClearNetwork={() => {
              setNetworkLogs((prev) => ({
                ...prev,
                [activeTabId]: [],
              }));
            }}
            deviceSim={deviceSim}
            onDeviceSimChange={setDeviceSim}
            activeTabTitle={activeTab?.title || ""}
            activeTabHtml={tabHtml[activeTabId]?.html || ""}
            activeTabHtmlUpdatedAt={tabHtml[activeTabId]?.updatedAt || null}
            aiDraft={aiDraft}
            latestApiRequest={latestApiRequestByTab[activeTabId] || null}
            activeTabId={activeTabId}
            activeTabUrl={activeTab?.url || ""}
            onDevToolsWebviewReady={(webContentsId, webview) => {
              webviewRefs.current[activeTabId] = webview;

              tabToWebContents.current.set(activeTabId, webContentsId);

              webContentsToTab.current.set(webContentsId, activeTabId);

              window.electronAPI?.attachNetwork?.(webContentsId);
            }}
            onDevToolsConsoleMessage={(entry) => {
              pushConsoleLog(activeTabId, {
                ...entry,
                timestamp: entry.timestamp || Date.now(),
              });
            }}
            onDevToolsApiRequest={(payload) => {
              const method = payload?.method ? String(payload.method) : "";

              const url = payload?.url ? String(payload.url) : "";

              if (!method || !url) return;

              setLatestApiRequestByTab((prev) => ({
                ...prev,
                [activeTabId]: {
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
            onBookmarkSelect={handleBookmarkSelect}
            currentTab={{
              url: activeTab?.url || "",
              title: activeTab?.title || "",
            }}
            onClose={() => setActiveTool(null)}
          />
        )}
      </div>
    </div>
  );
}
