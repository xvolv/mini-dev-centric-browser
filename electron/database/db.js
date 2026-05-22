const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { app } = require("electron");

let database = null;
let initPromise = null;

function getDatabasePath() {
  return path.join(app.getPath("userData"), "browser_data.db");
}

function getDatabase() {
  if (!database) {
    throw new Error(
      "Database has not been initialized. Call initDatabase() first.",
    );
  }
  return database;
}

async function initDatabase() {
  if (database) {
    return database;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    await app.whenReady();

    if (database) {
      return database;
    }

    const databasePath = getDatabasePath();
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });

    const nextDatabase = new Database(databasePath);
    nextDatabase.pragma("journal_mode = WAL");
    nextDatabase.pragma("foreign_keys = ON");
     nextDatabase.exec(`
       CREATE TABLE IF NOT EXISTS browsing_history (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         url TEXT UNIQUE,
         title TEXT,
         visit_count INTEGER DEFAULT 1,
         last_visited INTEGER
       );
       CREATE TABLE IF NOT EXISTS bookmarks (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         url TEXT UNIQUE,
         title TEXT,
         created_at INTEGER
       );
       CREATE TABLE IF NOT EXISTS network_requests (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         session_id TEXT NOT NULL,
         request_id TEXT NOT NULL,
         tab_id INTEGER,
         web_contents_id INTEGER,
         method TEXT,
         url TEXT,
         status INTEGER,
         status_text TEXT,
         resource_type TEXT,
         content_type TEXT,
         from_cache INTEGER DEFAULT 0,
         size INTEGER DEFAULT 0,
         duration_ms INTEGER,
         started_at INTEGER,
         ended_at INTEGER,
         request_headers TEXT,
         response_headers TEXT,
         request_body TEXT,
         response_body TEXT,
         failed INTEGER DEFAULT 0,
         error TEXT,
         created_at INTEGER,
         UNIQUE(session_id, request_id)
       );
     `);

    database = nextDatabase;
    return nextDatabase;
  })().finally(() => {
    initPromise = null;
  });

  return initPromise;
}

function closeDatabase() {
  if (!database) return;
  database.close();
  database = null;
}

module.exports = {
  getDatabasePath,
  getDatabase,
  initDatabase,
  closeDatabase,
};
