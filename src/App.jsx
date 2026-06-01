import React, { useCallback, useEffect, useRef, useState } from "react";
import TitleBar from "./components/layout/TitleBar";
import TabBar from "./components/layout/TabBar";
import AddressBar from "./components/layout/AddressBar";
import BookmarksBar from "./components/layout/BookmarksBar";
import BrowserView from "./components/browser/BrowserView";
import SandboxPanel from "./components/devtools/panels/SandboxPanel";
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
  const [networkHistoryEntries, setNetworkHistoryEntries] = useState([]);
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
  const pendingApiRequestsByTabRef = useRef(new Map());

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

  const queuePendingApiRequest = useCallback((tabId, payload) => {
    if (tabId == null || !payload) return;

    const method = payload.method ? String(payload.method) : "";
    const url = payload.url ? String(payload.url) : "";
    if (!method || !url) return;

    const queue = pendingApiRequestsByTabRef.current.get(tabId) || [];
    queue.unshift({
      ...payload,
      method,
      url,
      capturedAt: payload.capturedAt || Date.now(),
    });

    pendingApiRequestsByTabRef.current.set(tabId, queue.slice(0, 25));
  }, []);

  const consumePendingApiRequest = useCallback((tabId, entry) => {
    const queue = pendingApiRequestsByTabRef.current.get(tabId) || [];
    if (queue.length === 0) return null;

    const method = entry?.method ? String(entry.method) : "";
    const url = entry?.url ? String(entry.url) : "";
    if (!method || !url) return null;

    const startedAt = Number.isFinite(entry?.startedAt)
      ? entry.startedAt
      : Date.now();

    const candidateIndex = queue.findIndex((item) => {
      if (item.method !== method || item.url !== url) return false;
      const capturedAt = Number.isFinite(item.capturedAt) ? item.capturedAt : 0;
      return Math.abs(capturedAt - startedAt) < 15000;
    });

    if (candidateIndex < 0) return null;

    const [match] = queue.splice(candidateIndex, 1);
    pendingApiRequestsByTabRef.current.set(tabId, queue);
    return match;
  }, []);

  const mergeApiRequestDetails = useCallback((tabId, payload) => {
    if (tabId == null || !payload) return;

    const method = payload.method ? String(payload.method) : "";
    const url = payload.url ? String(payload.url) : "";
    if (!method || !url) return;

    const headers =
      payload.headers && typeof payload.headers === "object"
        ? payload.headers
        : {};
    const responseHeaders =
      payload.responseHeaders && typeof payload.responseHeaders === "object"
        ? payload.responseHeaders
        : {};
    const contentType =
      typeof payload.contentType === "string"
        ? payload.contentType
        : headers["content-type"] || headers["Content-Type"] || "";

    const common = {
      method,
      url,
      headers,
      body: payload.body,
      responseBody: payload.responseBody,
      responseHeaders,
      contentType,
      status: payload.status ?? null,
      statusCode: payload.status ?? null,
      source: payload.source || "webview",
      resourceType: payload.source || "webview",
      requestId: payload.requestId ?? null,
      startedAt: payload.startedAt ?? null,
      endedAt: payload.endedAt ?? null,
      durationMs: payload.durationMs ?? null,
      receivedAt: payload.capturedAt || payload.endedAt || Date.now(),
    };

    setNetworkLogs((prev) => {
      const next = { ...prev };
      const list = next[tabId] ? [...next[tabId]] : [];
      if (list.length === 0) return prev;

      const targetIndex = list.findIndex((entry) => {
        const entryMethod = entry.method ? String(entry.method) : "";
        const entryUrl = entry.url ? String(entry.url) : "";
        if (entryMethod !== method || entryUrl !== url) return false;

        const entryTime = Number.isFinite(entry.startedAt)
          ? entry.startedAt
          : Number.isFinite(entry.endedAt)
            ? entry.endedAt
            : Number.isFinite(entry.receivedAt)
              ? entry.receivedAt
              : 0;
        const requestTime = common.receivedAt || Date.now();
        return Math.abs(entryTime - requestTime) < 15000;
      });

      if (targetIndex < 0) return prev;

      list[targetIndex] = {
        ...list[targetIndex],
        ...common,
      };

      next[tabId] = list;
      return next;
    });

    setLatestApiRequestByTab((prev) => ({
      ...prev,
      [tabId]: common,
    }));
  }, []);

  const persistNetworkRequest = useCallback((tabId, entry) => {
    if (tabId == null || !entry?.requestId) return;
    window.electronAPI?.persistNetworkRequest?.(tabId, entry);
  }, []);

  const loadNetworkHistory = useCallback(async () => {
    try {
      const result = await window.electronAPI?.getNetworkHistory?.(2000);
      if (!result?.ok) {
        setNetworkHistoryEntries([]);
        return;
      }
      setNetworkHistoryEntries(
        Array.isArray(result.entries) ? result.entries : [],
      );
    } catch (error) {
      console.error("Failed to load network history:", error);
      setNetworkHistoryEntries([]);
    }
  }, []);

  const sanitizeNetworkEntryForExport = useCallback((entry) => {
    if (!entry || typeof entry !== "object") return {};

    const safeValue = (value) => {
      if (value === undefined || value === null) return null;
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return value;
      }
      if (Array.isArray(value)) {
        return value.map((item) => safeValue(item));
      }
      if (typeof value === "object") {
        return Object.entries(value).reduce((acc, [key, nested]) => {
          acc[key] = safeValue(nested);
          return acc;
        }, {});
      }
      return String(value);
    };

    return Object.entries(entry).reduce((acc, [key, value]) => {
      acc[key] = safeValue(value);
      return acc;
    }, {});
  }, []);

  const handleExportNetwork = useCallback(async (format, entries) => {
    try {
      const requestIds = Array.isArray(entries)
        ? entries
            .map((entry) => entry?.requestId)
            .filter(
              (requestId) => requestId !== undefined && requestId !== null,
            )
            .map((requestId) => String(requestId))
        : [];

      console.log("handleExportNetwork: requesting export", {
        format,
        requestIdsCount: requestIds.length,
      });

      const result = await window.electronAPI?.exportNetworkLogs?.({
        format,
        requestIds,
      });

      if (result?.canceled) return result;
      if (!result?.ok) {
        throw new Error(result?.error || "Failed to export network logs.");
      }

      return result;
    } catch (error) {
      console.error("Network export failed:", error);
      window.alert?.(
        error?.message || String(error) || "Failed to export network logs.",
      );
      return { ok: false, error: error?.message || String(error) };
    }
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
    loadNetworkHistory();
  }, [loadNetworkHistory]);

  useEffect(() => {
    if (!window.electronAPI?.onNetworkEvent) return undefined;

    const unsubscribe = window.electronAPI.onNetworkEvent((entry) => {
      const tabId = webContentsToTab.current.get(entry.webContentsId);

      if (!tabId) return;

      const resourceType =
        typeof entry.resourceType === "string" ? entry.resourceType : "";

      const isApiRequest = resourceType === "xhr" || resourceType === "fetch";
      const pendingApiRequest = consumePendingApiRequest(tabId, entry);
      const mergedEntry = pendingApiRequest
        ? {
            ...entry,
            requestBody: pendingApiRequest.body,
            requestHeaders:
              pendingApiRequest.headers || entry.requestHeaders || {},
            responseHeaders:
              pendingApiRequest.responseHeaders || entry.responseHeaders || {},
            responseBody: pendingApiRequest.responseBody,
            contentType:
              pendingApiRequest.contentType || entry.contentType || "",
            statusCode:
              pendingApiRequest.status ?? entry.statusCode ?? entry.status,
            status:
              pendingApiRequest.status ?? entry.statusCode ?? entry.status,
            startedAt:
              entry.startedAt || pendingApiRequest.startedAt || Date.now(),
            endedAt: pendingApiRequest.endedAt || entry.endedAt || Date.now(),
            durationMs:
              pendingApiRequest.durationMs ?? entry.durationMs ?? entry.timeMs,
          }
        : entry;

      setNetworkLogs((prev) => {
        const next = { ...prev };

        const list = next[tabId] ? [...next[tabId]] : [];

        list.unshift(mergedEntry);

        next[tabId] = list.slice(0, 200);

        return next;
      });

      persistNetworkRequest(tabId, mergedEntry);

      setNetworkHistoryEntries((prev) => {
        const next = [
          mergedEntry,
          ...prev.filter((item) => item.requestId !== mergedEntry.requestId),
        ];
        return next.slice(0, 2000);
      });

      if (
        (pendingApiRequest || isApiRequest) &&
        mergedEntry.url &&
        mergedEntry.method
      ) {
        mergeApiRequestDetails(tabId, {
          ...mergedEntry,
          source: isApiRequest ? resourceType : mergedEntry.source,
        });
      }
    });

    return () => unsubscribe?.();
  }, [consumePendingApiRequest, mergeApiRequestDetails, persistNetworkRequest]);

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
        {activeTool === "sandbox" ? (
          <div className="sandbox-page">
            <SandboxPanel />
          </div>
        ) : (
          <>
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
                queuePendingApiRequest(tabId, payload);
                mergeApiRequestDetails(tabId, payload);
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
                onExportNetwork={handleExportNetwork}
                networkHistoryEntries={networkHistoryEntries}
                onRefreshNetworkHistory={loadNetworkHistory}
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
                  queuePendingApiRequest(activeTabId, payload);
                  mergeApiRequestDetails(activeTabId, payload);
                }}
                onBookmarkSelect={handleBookmarkSelect}
                currentTab={{
                  url: activeTab?.url || "",
                  title: activeTab?.title || "",
                }}
                onClose={() => setActiveTool(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
