import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema.js";

const STORAGE_KEY = "wordle-ro-stats-sqlite-v1";

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Unified SQLite handle: Tauri plugin when available, else sql.js + localStorage.
 */
export async function openStatsDatabase() {
  if (isTauri()) {
    try {
      return await openTauriDatabase();
    } catch (err) {
      console.warn("Tauri SQL unavailable, falling back to sql.js", err);
    }
  }
  return openSqlJsDatabase();
}

async function openTauriDatabase() {
  const Database = (await import("@tauri-apps/plugin-sql")).default;
  const db = await Database.load("sqlite:wordle_stats.db");

  // Recreate schema when version changes (no porting).
  let rows = [];
  try {
    rows = await db.select("SELECT value FROM meta WHERE key = $1", [
      "schema_version",
    ]);
  } catch {
    rows = [];
  }

  const version = rows?.[0]?.value;
  if (version !== String(SCHEMA_VERSION)) {
    await db.execute("DROP TABLE IF EXISTS valid_guesses");
    await db.execute("DROP TABLE IF EXISTS abandons");
    await db.execute("DROP TABLE IF EXISTS invalid_attempts");
    await db.execute("DROP TABLE IF EXISTS finished_games");
    await db.execute("DROP TABLE IF EXISTS meta");
    for (const stmt of SCHEMA_SQL.split(";")
      .map((s) => s.trim())
      .filter(Boolean)) {
      await db.execute(stmt);
    }
    await db.execute(
      "INSERT OR REPLACE INTO meta (key, value) VALUES ($1, $2)",
      ["schema_version", String(SCHEMA_VERSION)]
    );
  }

  return {
    kind: "tauri",
    async execute(sql, params = []) {
      return db.execute(toTauriSql(sql), params);
    },
    async select(sql, params = []) {
      return db.select(toTauriSql(sql), params);
    },
    async persist() {},
  };
}

/** Convert `?` placeholders to `$1`, `$2`, … for sqlx. */
function toTauriSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function openSqlJsDatabase() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  let db;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    db = saved
      ? new SQL.Database(base64ToBytes(saved))
      : new SQL.Database();
  } catch {
    db = new SQL.Database();
  }

  let version = null;
  try {
    const versionRow = db.exec(
      "SELECT value FROM meta WHERE key = 'schema_version'"
    );
    version = versionRow?.[0]?.values?.[0]?.[0];
  } catch {
    version = null;
  }
  if (version !== String(SCHEMA_VERSION)) {
    db.run("DROP TABLE IF EXISTS valid_guesses");
    db.run("DROP TABLE IF EXISTS abandons");
    db.run("DROP TABLE IF EXISTS invalid_attempts");
    db.run("DROP TABLE IF EXISTS finished_games");
    db.run("DROP TABLE IF EXISTS meta");
    db.exec(SCHEMA_SQL);
    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", [
      "schema_version",
      String(SCHEMA_VERSION),
    ]);
    persistSqlJs(db);
  }

  return {
    kind: "sqljs",
    async execute(sql, params = []) {
      db.run(sql, params);
      persistSqlJs(db);
      return { rowsAffected: db.getRowsModified() };
    },
    async select(sql, params = []) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    },
    async persist() {
      persistSqlJs(db);
    },
  };
}

function persistSqlJs(db) {
  try {
    localStorage.setItem(STORAGE_KEY, bytesToBase64(db.export()));
  } catch (err) {
    console.warn("Failed to persist stats DB", err);
  }
}
