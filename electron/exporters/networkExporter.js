const pad = (value) => String(value).padStart(2, "0");

const formatDateTime = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

const normalizeText = (value) =>
  String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trimEnd();

const indentBlock = (text, indent = "  ") =>
  String(text || "")
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n");

const stringifyValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const formatHeaders = (headers) => {
  if (!headers || typeof headers !== "object") return "(none)";

  const entries = Object.entries(headers);
  if (entries.length === 0) return "(none)";

  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}: ${stringifyValue(value)}`)
    .join("\n");
};

const formatEntry = (entry, index) => {
  const requestId = entry?.requestId ?? index + 1;
  const time = formatDateTime(new Date(entry?.endedAt || entry?.startedAt || Date.now()));
  const duration = Number.isFinite(entry?.durationMs)
    ? `${Math.round(entry.durationMs)} ms`
    : Number.isFinite(entry?.timeMs)
      ? `${Math.round(entry.timeMs)} ms`
      : "-";
  const status = entry?.statusCode ?? entry?.status ?? entry?.error ?? "-";
  const lines = [
    "----------------------------------------",
    `Request #${requestId}`,
    `Time: ${time}`,
    `Method: ${String(entry?.method || "-")}`,
    `URL: ${String(entry?.url || "-")}`,
    `Status: ${String(status)}`,
    `Resource Type: ${String(entry?.resourceType || "-")}`,
    `Duration: ${duration}`,
    `Size: ${Number.isFinite(entry?.size) ? `${entry.size} B` : "-"}`,
    `Cache: ${entry?.fromCache ? "Yes" : "No"}`,
    "",
    "Request Headers:",
    indentBlock(formatHeaders(entry?.requestHeaders)),
    "",
    "Response Headers:",
    indentBlock(formatHeaders(entry?.responseHeaders)),
    "",
    "Request Body:",
    indentBlock(normalizeText(stringifyValue(entry?.requestBody ?? entry?.body) || "(none)")),
    "",
    "Response Body:",
    indentBlock(normalizeText(stringifyValue(entry?.responseBody) || "(none)")),
    "",
  ];

  if (entry?.error) {
    lines.push("Error:", indentBlock(String(entry.error)), "");
  }

  return lines.join("\n");
};

function buildNetworkExportText(entries = []) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const now = new Date();
  const header = [
    "=== Mini Dev Browser Network Export ===",
    "",
    `Exported: ${formatDateTime(now)}`,
    `Request count: ${safeEntries.length}`,
    "",
  ];

  if (safeEntries.length === 0) {
    header.push("No network entries available.");
    return header.join("\n");
  }

  const body = safeEntries.map((entry, index) => formatEntry(entry, index));
  return [...header, ...body, ""].join("\n");
}

module.exports = {
  buildNetworkExportText,
};