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
