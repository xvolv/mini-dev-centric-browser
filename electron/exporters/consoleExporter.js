const pad = (value) => String(value).padStart(2, "0");

const formatDateTime = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

const formatDateTimeForFilename = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;

const resolveTimestamp = (entry) => {
  if (typeof entry?.timestamp === "number" && Number.isFinite(entry.timestamp)) {
    return entry.timestamp;
  }
  if (typeof entry?.time === "string") {
    const parsed = Date.parse(entry.time);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
};

const normalizeText = (value) => String(value ?? "").replace(/\r\n/g, "\n").trimEnd();

const formatSource = (entry) => {
  const sourceId = String(entry?.sourceId || "").trim();
  const line = Number.isFinite(entry?.line) ? entry.line : "";
  if (!sourceId && line === "") return "";
  if (sourceId && line !== "") return `${sourceId}:${line}`;
  return sourceId || String(line);
};

const indentBlock = (text, indent = "  ") =>
  String(text || "")
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n");

const formatEntry = (entry) => {
  const date = new Date(resolveTimestamp(entry));
  const time = formatDateTime(date);
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  const type = String(entry?.type || "log").toUpperCase();
  const message = normalizeText(entry?.text || entry?.message || "");
  const source = formatSource(entry);
  const stack = normalizeText(entry?.stack || entry?.stackTrace || "");

  const lines = ["----------------------------------------", "", `[${type}]`, `Time: ${clock}`];
  lines.push(`Timestamp: ${time}`);
  if (source) lines.push(`Source: ${source}`);
  lines.push("Message:");
  lines.push(indentBlock(message || "(empty)", "  "));
  if (stack) {
    lines.push("", "Stack:");
    lines.push(indentBlock(stack, "  "));
  }
  return lines.join("\n");
};

function buildConsoleExportText(entries = []) {
  const now = new Date();
  const safeEntries = Array.isArray(entries) ? entries : [];
  const header = [
    "=== Mini Dev Browser Console Export ===",
    "",
    `Exported:`,
    formatDateTime(now),
    "",
  ];

  if (safeEntries.length === 0) {
    header.push("No console entries available.");
    return header.join("\n");
  }

  const body = safeEntries.map((entry) => formatEntry(entry));
  return [...header, ...body, ""].join("\n");
}

function buildDefaultConsoleExportFilename(date = new Date()) {
  return `console_logs_${formatDateTimeForFilename(date)}.txt`;
}

module.exports = {
  buildConsoleExportText,
  buildDefaultConsoleExportFilename,
};