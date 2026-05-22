const { getDatabase } = require("./db");

function safeJson(value) {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function parseJson(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function addNetworkRequest(entry, sessionId) {
  const database = getDatabase();
  const normalizedSessionId = String(sessionId || "").trim();
  const normalizedRequestId = String(entry?.requestId ?? "").trim();

  if (!normalizedSessionId) {
    throw new Error("Session id is required.");
  }
  if (!normalizedRequestId) {
    throw new Error("Request id is required.");
  }

  const statement = database.prepare(`
    INSERT INTO network_requests (
      session_id,
      request_id,
      tab_id,
      web_contents_id,
      method,
      url,
      status,
      status_text,
      resource_type,
      content_type,
      from_cache,
      size,
      duration_ms,
      started_at,
      ended_at,
      request_headers,
      response_headers,
      request_body,
      response_body,
      failed,
      error,
      created_at
    ) VALUES (
      @sessionId,
      @requestId,
      @tabId,
      @webContentsId,
      @method,
      @url,
      @status,
      @statusText,
      @resourceType,
      @contentType,
      @fromCache,
      @size,
      @durationMs,
      @startedAt,
      @endedAt,
      @requestHeaders,
      @responseHeaders,
      @requestBody,
      @responseBody,
      @failed,
      @error,
      @createdAt
    )
    ON CONFLICT(session_id, request_id) DO UPDATE SET
      tab_id = excluded.tab_id,
      web_contents_id = excluded.web_contents_id,
      method = excluded.method,
      url = excluded.url,
      status = excluded.status,
      status_text = excluded.status_text,
      resource_type = excluded.resource_type,
      content_type = excluded.content_type,
      from_cache = excluded.from_cache,
      size = excluded.size,
      duration_ms = excluded.duration_ms,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      request_headers = excluded.request_headers,
      response_headers = excluded.response_headers,
      request_body = excluded.request_body,
      response_body = excluded.response_body,
      failed = excluded.failed,
      error = excluded.error,
      created_at = excluded.created_at;
  `);

  statement.run({
    sessionId: normalizedSessionId,
    requestId: normalizedRequestId,
    tabId: Number.isFinite(entry?.tabId) ? entry.tabId : null,
    webContentsId: Number.isFinite(entry?.webContentsId)
      ? entry.webContentsId
      : null,
    method: String(entry?.method || ""),
    url: String(entry?.url || ""),
    status: Number.isFinite(entry?.statusCode ?? entry?.status)
      ? entry.statusCode ?? entry.status
      : null,
    statusText: String(entry?.statusText || ""),
    resourceType: String(entry?.resourceType || ""),
    contentType: String(entry?.contentType || ""),
    fromCache: entry?.fromCache ? 1 : 0,
    size: Number.isFinite(entry?.size) ? entry.size : 0,
    durationMs: Number.isFinite(entry?.durationMs)
      ? entry.durationMs
      : Number.isFinite(entry?.timeMs)
        ? entry.timeMs
        : null,
    startedAt: Number.isFinite(entry?.startedAt) ? entry.startedAt : null,
    endedAt: Number.isFinite(entry?.endedAt) ? entry.endedAt : null,
    requestHeaders: safeJson(entry?.requestHeaders) || "{}",
    responseHeaders: safeJson(entry?.responseHeaders) || "{}",
    requestBody: safeJson(entry?.requestBody ?? entry?.body),
    responseBody: safeJson(entry?.responseBody),
    failed: entry?.failed ? 1 : 0,
    error: entry?.error ? String(entry.error) : null,
    createdAt: Number.isFinite(entry?.endedAt)
      ? entry.endedAt
      : Number.isFinite(entry?.startedAt)
        ? entry.startedAt
        : Date.now(),
  });
}

function getNetworkRequests({ sessionId = null, limit = 500 } = {}) {
  const database = getDatabase();
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 2000)) : 500;
  const hasSession = typeof sessionId === "string" && sessionId.trim();

  const statement = database.prepare(`
    SELECT
      id,
      session_id,
      request_id,
      tab_id,
      web_contents_id,
      method,
      url,
      status,
      status_text,
      resource_type,
      content_type,
      from_cache,
      size,
      duration_ms,
      started_at,
      ended_at,
      request_headers,
      response_headers,
      request_body,
      response_body,
      failed,
      error,
      created_at
    FROM network_requests
    ${hasSession ? "WHERE session_id = @sessionId" : ""}
    ORDER BY created_at DESC, id DESC
    LIMIT @limit;
  `);

  return statement.all({
    sessionId: hasSession ? sessionId.trim() : null,
    limit: safeLimit,
  }).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    requestId: row.request_id,
    tabId: row.tab_id,
    webContentsId: row.web_contents_id,
    method: row.method,
    url: row.url,
    status: row.status,
    statusText: row.status_text,
    resourceType: row.resource_type,
    contentType: row.content_type,
    fromCache: Boolean(row.from_cache),
    size: row.size,
    durationMs: row.duration_ms,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    requestHeaders: parseJson(row.request_headers) || {},
    responseHeaders: parseJson(row.response_headers) || {},
    requestBody: parseJson(row.request_body),
    responseBody: parseJson(row.response_body),
    failed: Boolean(row.failed),
    error: row.error,
    createdAt: row.created_at,
  }));
}

module.exports = {
  addNetworkRequest,
  getNetworkRequests,
};