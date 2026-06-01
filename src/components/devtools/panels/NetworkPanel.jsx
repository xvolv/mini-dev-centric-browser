import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "mini-dev-centric.network-filters.v1";

const METHOD_OPTIONS = ["all", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const STATUS_OPTIONS = ["all", "success", "redirect", "client-error", "server-error", "error"];
const RESOURCE_OPTIONS = ["all", "xhr", "fetch", "document", "script", "stylesheet", "image", "font", "other"];

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(ms) {
  if (!ms && ms !== 0) return "-";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "-";
  }
}

function normalizeValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

function headersToEntries(headers) {
  if (!headers || typeof headers !== "object") return [];

  return Object.entries(headers)
    .map(([key, value]) => [key, normalizeValue(value)])
    .sort(([a], [b]) => a.localeCompare(b));
}

function getRequestKey(request) {
  if (!request) return "";
  if (request.requestId !== undefined && request.requestId !== null) {
    return String(request.requestId);
  }
  return `${request.method || ""}|${request.url || ""}|${request.startedAt || request.timeMs || ""}`;
}

function getStatusBucket(request) {
  const status = request?.statusCode ?? request?.status;
  if (request?.failed || request?.type === "error") return "error";
  if (typeof status !== "number") return "error";
  if (status >= 200 && status < 300) return "success";
  if (status >= 300 && status < 400) return "redirect";
  if (status >= 400 && status < 500) return "client-error";
  if (status >= 500) return "server-error";
  return "error";
}

function getRequestBody(request) {
  if (!request) return "";
  return normalizeValue(request.requestBody ?? request.body ?? "");
}

function getResponseBody(request) {
  if (!request) return "";
  return normalizeValue(request.responseBody ?? "");
}

function readStoredPresets() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredPresets(presets) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // ignore storage errors
  }
}

function serializeFilters(filters) {
  return JSON.stringify(filters);
}

export default function NetworkPanel({
  entries = [],
  onClear,
  onExport,
  primaryActionLabel = "Clear",
  primaryActionTitle = "Clear requests",
  primaryActionIcon = "🗑",
  autoPopulateEnabled = true,
  onSendToApiTester,
}) {
  const [filterText, setFilterText] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [selectedRequestKey, setSelectedRequestKey] = useState("");
  const [savedPresets, setSavedPresets] = useState([]);
  const [presetName, setPresetName] = useState("");
  const [activePresetId, setActivePresetId] = useState("");

  useEffect(() => {
    setSavedPresets(readStoredPresets());
  }, []);

  useEffect(() => {
    saveStoredPresets(savedPresets);
  }, [savedPresets]);

  const getMethodClass = (method) =>
    `network__method network__method--${String(method || "").toLowerCase()}`;

  const getStatusClass = (status) => {
    if (status >= 200 && status < 300) return "network__status--2xx";
    if (status >= 300 && status < 400) return "network__status--3xx";
    if (status >= 400 && status < 500) return "network__status--4xx";
    if (status >= 500) return "network__status--5xx";
    return "network__status--error";
  };

  const filtered = useMemo(() => {
    const query = filterText.trim().toLowerCase();

    return entries.filter((request) => {
      const requestUrl = String(request.url || "");
      const method = String(request.method || "").toUpperCase();
      const resourceType = String(request.resourceType || "").toLowerCase();
      const contentType = String(
        request.contentType ||
          request.responseHeaders?.["content-type"] ||
          request.responseHeaders?.["Content-Type"] ||
          "",
      ).toLowerCase();
      const statusBucket = getStatusBucket(request);

      if (query) {
        const haystack = [
          requestUrl,
          method,
          contentType,
          String(request.statusCode ?? request.status ?? ""),
          String(request.error ?? ""),
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) return false;
      }

      if (methodFilter !== "all" && method !== methodFilter) return false;
      if (statusFilter !== "all" && statusBucket !== statusFilter) return false;

      if (resourceFilter !== "all") {
        if (resourceFilter === "other") {
          if (["xhr", "fetch", "document", "script", "stylesheet", "image", "font"].includes(resourceType)) {
            return false;
          }
        } else if (resourceType !== resourceFilter) {
          return false;
        }
      }

      return true;
    });
  }, [entries, filterText, methodFilter, statusFilter, resourceFilter]);

  useEffect(() => {
    if (!filtered.length) {
      if (selectedRequestKey) setSelectedRequestKey("");
      return;
    }

    const selectionStillVisible = filtered.some(
      (request, index) => getRequestKey(request, index) === selectedRequestKey,
    );

    if (!selectionStillVisible) {
      setSelectedRequestKey(getRequestKey(filtered[0], 0));
    }
  }, [filtered, selectedRequestKey]);

  const selectedRequest = useMemo(() => {
    const visibleMatch = filtered.find(
      (request, index) => getRequestKey(request, index) === selectedRequestKey,
    );
    if (visibleMatch) return visibleMatch;
    return entries.find((request) => getRequestKey(request) === selectedRequestKey) || null;
  }, [entries, filtered, selectedRequestKey]);

  const applyPreset = (preset) => {
    if (!preset?.filters) return;
    setFilterText(preset.filters.filterText || "");
    setMethodFilter(preset.filters.methodFilter || "all");
    setStatusFilter(preset.filters.statusFilter || "all");
    setResourceFilter(preset.filters.resourceFilter || "all");
    setActivePresetId(preset.id || "");
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;

    const preset = {
      id: `${Date.now()}`,
      name,
      filters: {
        filterText,
        methodFilter,
        statusFilter,
        resourceFilter,
      },
    };

    setSavedPresets((prev) => [preset, ...prev].slice(0, 10));
    setPresetName("");
    setActivePresetId(preset.id);
  };

  const handleDeletePreset = (presetId) => {
    setSavedPresets((prev) => prev.filter((preset) => preset.id !== presetId));
    if (activePresetId === presetId) {
      setActivePresetId("");
    }
  };

  const handleExport = async (format) => {
    if (typeof onExport !== "function") return;
    await onExport(format, filtered);
  };

  const handleSendToApiTester = (request, event) => {
    event.stopPropagation();
    if (!autoPopulateEnabled || typeof onSendToApiTester !== "function") return;
    onSendToApiTester(request);
  };

  const detailStatus = selectedRequest?.statusCode ?? selectedRequest?.status;
  const requestHeaders = headersToEntries(selectedRequest?.requestHeaders);
  const responseHeaders = headersToEntries(selectedRequest?.responseHeaders);
  const requestBody = getRequestBody(selectedRequest);
  const responseBody = getResponseBody(selectedRequest);
  const contentType =
    selectedRequest?.contentType ||
    normalizeValue(selectedRequest?.responseHeaders?.["content-type"] || selectedRequest?.responseHeaders?.["Content-Type"] || "");

  return (
    <div className="tool-panel network-inspector">
      <div className="network__toolbar network__toolbar--stacked">
        <div className="network__toolbar-row">
          <input
            className="network__filter-input network__filter-input--wide"
            type="text"
            placeholder="Filter by URL, method, status, or content type..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <button className="btn-icon" title={primaryActionTitle} onClick={() => {
            setSelectedRequestKey("");
            onClear?.();
          }}>
            {primaryActionIcon}
          </button>
        </div>

        <div className="network__toolbar-row network__toolbar-row--wrap">
          <label className="network__filter-group">
            <span>Method</span>
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
              {METHOD_OPTIONS.map((option) => (
                <option key={option} value={option}>{option.toUpperCase()}</option>
              ))}
            </select>
          </label>
          <label className="network__filter-group">
            <span>Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>{option.replace(/-/g, " ")}</option>
              ))}
            </select>
          </label>
          <label className="network__filter-group">
            <span>Type</span>
            <select value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)}>
              {RESOURCE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option.toUpperCase()}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="network__preset-bar">
          <input
            className="network__preset-input"
            type="text"
            placeholder="Save preset as..."
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
          <button className="btn" type="button" onClick={handleSavePreset} disabled={!presetName.trim()}>
            Save
          </button>
          <select
            className="network__preset-select"
            value={activePresetId}
            onChange={(e) => {
              const preset = savedPresets.find((item) => item.id === e.target.value);
              if (preset) applyPreset(preset);
            }}
          >
            <option value="">Load saved preset...</option>
            {savedPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </select>
          {activePresetId ? (
            <button
              className="btn"
              type="button"
              onClick={() => handleDeletePreset(activePresetId)}
              title="Delete active preset"
            >
              Delete
            </button>
          ) : null}
          <button className="btn" type="button" onClick={() => handleExport("txt")} disabled={filtered.length === 0}>
            Export TXT
          </button>
          <button className="btn" type="button" onClick={() => handleExport("json")} disabled={filtered.length === 0}>
            Export JSON
          </button>
        </div>
      </div>

      <div className="network__shell">
        <div className="network__table-panel">
          <div className="network__table">
            <div className="network__row network__row-header">
              <span>Method</span>
              <span>URL</span>
              <span>Status</span>
              <span>Size</span>
              <span>Time</span>
              <span>Action</span>
            </div>
            {filtered.map((req, i) => {
              const rowKey = getRequestKey(req, i);
              const status = req.statusCode ?? req.status;
              return (
                <div
                  key={rowKey || `${req.method}-${req.url}-${i}`}
                  className={`network__row ${selectedRequestKey === rowKey ? "network__row--active" : ""}`}
                  onClick={() => setSelectedRequestKey(rowKey)}
                >
                  <span className={getMethodClass(req.method)}>{req.method}</span>
                  <span className="network__url" title={req.url}>{req.url}</span>
                  <span className={getStatusClass(status)} title={req.error || ""}>
                    {status ?? req.error ?? "-"}
                  </span>
                  <span>{formatSize(req.size)}</span>
                  <span>{formatTime(req.durationMs ?? req.timeMs)}</span>
                  <button
                    type="button"
                    className="network__send-api-btn"
                    onClick={(event) => handleSendToApiTester(req, event)}
                    disabled={!autoPopulateEnabled}
                    title={
                      autoPopulateEnabled
                        ? "Send this request to API Tester"
                        : "Enable auto-populate in Settings to use this action"
                    }
                  >
                    Send to API Tester
                  </button>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="tool-panel__empty" style={{ padding: "40px 24px" }}>
                <div className="tool-panel__empty-title">No requests match the current filters</div>
                <div className="tool-panel__empty-desc">
                  Browse to a page or loosen the filters to inspect network activity.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="network__detail-panel">
          {selectedRequest ? (
            <>
              <div className="network__detail-header">
                <div>
                  <div className="network__detail-eyebrow">Request Details</div>
                  <div className="network__detail-url" title={selectedRequest.url}>{selectedRequest.url}</div>
                  <div className="network__detail-meta">
                    <span>{selectedRequest.method}</span>
                    <span>{detailStatus ?? "-"}</span>
                    <span>{selectedRequest.resourceType || "unknown"}</span>
                  </div>
                </div>
              </div>

              <div className="network__detail-grid">
                <div className="network__metric">
                  <span>Duration</span>
                  <strong>{formatTime(selectedRequest.durationMs ?? selectedRequest.timeMs)}</strong>
                </div>
                <div className="network__metric">
                  <span>Size</span>
                  <strong>{formatSize(selectedRequest.size)}</strong>
                </div>
                <div className="network__metric">
                  <span>Started</span>
                  <strong>{formatDateTime(selectedRequest.startedAt)}</strong>
                </div>
                <div className="network__metric">
                  <span>Ended</span>
                  <strong>{formatDateTime(selectedRequest.endedAt)}</strong>
                </div>
              </div>

              <div className="network__detail-section">
                <div className="network__detail-title">Request Headers</div>
                <div className="network__kv-list">
                  {requestHeaders.length > 0 ? (
                    requestHeaders.map(([key, value]) => (
                      <div className="network__kv-row" key={key}>
                        <span>{key}</span>
                        <strong>{value || "-"}</strong>
                      </div>
                    ))
                  ) : (
                    <div className="network__detail-empty">No request headers captured.</div>
                  )}
                </div>
              </div>

              <div className="network__detail-section">
                <div className="network__detail-title">Response Headers</div>
                <div className="network__kv-list">
                  {responseHeaders.length > 0 ? (
                    responseHeaders.map(([key, value]) => (
                      <div className="network__kv-row" key={key}>
                        <span>{key}</span>
                        <strong>{value || "-"}</strong>
                      </div>
                    ))
                  ) : (
                    <div className="network__detail-empty">No response headers captured.</div>
                  )}
                </div>
              </div>

              <div className="network__detail-section">
                <div className="network__detail-title">Request Body</div>
                <pre className="network__codeblock">{requestBody || "No request body captured."}</pre>
              </div>

              <div className="network__detail-section">
                <div className="network__detail-title">Response Body</div>
                <pre className="network__codeblock">{responseBody || "No response body captured."}</pre>
              </div>

              <div className="network__detail-section">
                <div className="network__detail-title">Metadata</div>
                <div className="network__kv-list">
                  <div className="network__kv-row">
                    <span>Content Type</span>
                    <strong>{contentType || "-"}</strong>
                  </div>
                  <div className="network__kv-row">
                    <span>Cache</span>
                    <strong>{selectedRequest.fromCache ? "Yes" : "No"}</strong>
                  </div>
                  <div className="network__kv-row">
                    <span>Request ID</span>
                    <strong>{selectedRequest.requestId ?? "-"}</strong>
                  </div>
                  <div className="network__kv-row">
                    <span>Error</span>
                    <strong>{selectedRequest.error || "-"}</strong>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="tool-panel__empty network__detail-empty-state">
              <div className="tool-panel__empty-title">Select a request</div>
              <div className="tool-panel__empty-desc">
                Click any row to inspect headers, payloads, timing, and status details.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}