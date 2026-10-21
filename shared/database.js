
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");

const DB_PATH = process.env.DB_PATH ||
  path.join(__dirname, "../data/uptimeops.db");

fs.mkdirSync(path.dirname(DB_PATH), {
  recursive: true
});

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA busy_timeout = 5000;");

db.exec(`
  CREATE TABLE IF NOT EXISTS checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    status TEXT NOT NULL,
    http_status INTEGER,
    response_time INTEGER,
    checked_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_checks_url_time
  ON checks (url, checked_at DESC);
`);

const insertCheck = db.prepare(`
  INSERT INTO checks (
    url, status, http_status,
    response_time, checked_at
  )
  VALUES (?, ?, ?, ?, ?)
`);

function saveCheck(result) {
  insertCheck.run(
    result.url,
    result.status,
    result.httpStatus,
    result.responseTime,
    result.checkedAt
  );
}

function getLatestChecks() {
  return db.prepare(`
    SELECT url, status,
           http_status AS httpStatus,
           response_time AS responseTime,
           checked_at AS checkedAt
    FROM checks
    WHERE id IN (
      SELECT MAX(id)
      FROM checks
      GROUP BY url
    )
    ORDER BY url
  `).all();
}

function getHistory(url, limit = 100) {
  return db.prepare(`
    SELECT url, status,
           http_status AS httpStatus,
           response_time AS responseTime,
           checked_at AS checkedAt
    FROM checks
    WHERE url = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(url, limit);
}

module.exports = {
  saveCheck,
  getLatestChecks,
  getHistory
};
