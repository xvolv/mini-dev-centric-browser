const { getDatabase } = require("./db");

function normalizeQuery(query) {
  const value = String(query || "").trim();
  return value.length > 0 ? value : "";
}

function addHistory(url, title = "") {
  const database = getDatabase();
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) {
    throw new Error("URL is required.");
  }

  const normalizedTitle = String(title || "").trim();
  const now = Date.now();
  const statement = database.prepare(`
    INSERT INTO browsing_history (url, title, visit_count, last_visited)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(url) DO UPDATE SET
      title = CASE
        WHEN excluded.title IS NOT NULL AND excluded.title <> ''
        THEN excluded.title
        ELSE browsing_history.title
      END,
      visit_count = browsing_history.visit_count + 1,
      last_visited = excluded.last_visited;
  `);
  statement.run(normalizedUrl, normalizedTitle, now);
}

function getHistory(query) {
  const database = getDatabase();
  const value = normalizeQuery(query);
  const like = `%${value}%`;
  const statement = database.prepare(`
    SELECT id, url, title, visit_count, last_visited
    FROM browsing_history
    WHERE url LIKE ? OR title LIKE ?
    ORDER BY visit_count DESC, last_visited DESC
    LIMIT 10;
  `);
  return statement.all(like, like);
}

function removeHistory(id) {
  const database = getDatabase();
  const statement = database.prepare(
    `DELETE FROM browsing_history WHERE id = ?;`,
  );
  statement.run(id);
}

// Bookmark functions
function addBookmark(url, title = "") {
  const database = getDatabase();
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) {
    throw new Error("URL is required.");
  }

  const normalizedTitle = String(title || "").trim();
  const now = Date.now();
  const statement = database.prepare(`
    INSERT INTO bookmarks (url, title, created_at)
    VALUES (?, ?, ?)
    ON CONFLICT(url) DO UPDATE SET
      title = excluded.title,
      created_at = excluded.created_at;
  `);
  statement.run(normalizedUrl, normalizedTitle, now);
}

function getBookmarks() {
  const database = getDatabase();
  const statement = database.prepare(`
    SELECT id, url, title, created_at
    FROM bookmarks
    ORDER BY created_at DESC;
  `);
  return statement.all();
}

function removeBookmark(id) {
  const database = getDatabase();
  const statement = database.prepare(
    `DELETE FROM bookmarks WHERE id = ?;`,
  );
  statement.run(id);
}

module.exports = {
  addHistory,
  getHistory,
  removeHistory,
  addBookmark,
  getBookmarks,
  removeBookmark,
};