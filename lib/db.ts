import mysql, { PoolConnection, type QueryResult } from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL ?? "";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

const pool = mysql.createPool({
  uri: databaseUrl,
  connectionLimit: 5,
  charset: "utf8mb4",
  decimalNumbers: true,
  namedPlaceholders: false,
});

type SqlTag = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<any[]>;
  begin<T>(callback: (tx: SqlTag) => Promise<T>): Promise<T>;
};

function formatQuery(strings: TemplateStringsArray, values: unknown[]) {
  const text = strings
    .reduce((query, part, index) => {
      return query + part + (index < values.length ? "?" : "");
    }, "")
    .replace(/"([A-Za-z_][A-Za-z0-9_]*)"/g, "`$1`");

  return { text, values };
}

function getDatabaseName() {
  try {
    const url = new URL(databaseUrl);
    return decodeURIComponent(url.pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
}

function quoteIdentifier(identifier: string) {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

let databaseSetup: Promise<void> | null = null;

async function ensureDatabaseExists() {
  if (databaseSetup) return databaseSetup;

  databaseSetup = (async () => {
    const databaseName = getDatabaseName();
    if (!databaseName) return;

    const url = new URL(databaseUrl);
    const connection = await mysql.createConnection({
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      charset: "utf8mb4",
    });

    try {
      await connection.query(
        `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(databaseName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
    } finally {
      await connection.end();
    }
  })().catch((error) => {
    databaseSetup = null;
    throw error;
  });

  return databaseSetup;
}

function createSqlTag(connection?: PoolConnection): SqlTag {
  const query = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    if (!connection) {
      await ensureDatabaseExists();
    }
    const { text, values: params } = formatQuery(strings, values);
    const executor = connection ?? pool;
    const [rows] = await executor.query<QueryResult>(text, params);
    return Array.isArray(rows) ? rows : [];
  }) as SqlTag;

  query.begin = async <T>(callback: (tx: SqlTag) => Promise<T>) => {
    await ensureDatabaseExists();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await callback(createSqlTag(conn));
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  };

  return query;
}

export const sql = createSqlTag();

export async function ensureColumn(tableName: string, columnName: string, definition: string) {
  const rows = await sql`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = ${tableName}
      AND column_name = ${columnName}
    LIMIT 1
  `;

  if (rows.length === 0) {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
  }
}

export async function ensureIndex(
  tableName: string,
  indexName: string,
  createIndexSql: string
) {
  const rows = await sql`
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = ${tableName}
      AND index_name = ${indexName}
    LIMIT 1
  `;

  if (rows.length === 0) {
    await pool.query(createIndexSql);
  }
}
