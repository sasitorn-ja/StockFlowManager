import { cookies } from "next/headers";
import { ensureColumn, ensureIndex, sql } from "@/lib/db";
import { AppSession, readSessionCookie, SESSION_COOKIE } from "./session";

export type UserRole = "employee" | "manager" | "admin";

let schemaSetup: Promise<void> | null = null;

export async function ensureSsoUsersSchema() {
  if (schemaSetup) return schemaSetup;
  schemaSetup = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(255) PRIMARY KEY,
        is_admin BOOLEAN DEFAULT 0,
        role VARCHAR(50) DEFAULT 'employee',
        created_at BIGINT,
        sso_subject VARCHAR(255) NULL,
        email VARCHAR(320) NULL,
        display_name VARCHAR(255) NULL,
        sso_user_id VARCHAR(255) NULL,
        department VARCHAR(255) NULL,
        division VARCHAR(255) NULL,
        last_login_at BIGINT NULL
      )
    `;
    await ensureColumn("users", "sso_subject", "VARCHAR(255) NULL");
    await ensureColumn("users", "email", "VARCHAR(320) NULL");
    await ensureColumn("users", "display_name", "VARCHAR(255) NULL");
    await ensureColumn("users", "sso_user_id", "VARCHAR(255) NULL");
    await ensureColumn("users", "department", "VARCHAR(255) NULL");
    await ensureColumn("users", "division", "VARCHAR(255) NULL");
    await ensureColumn("users", "last_login_at", "BIGINT NULL");
    await ensureIndex(
      "users",
      "users_sso_subject_idx",
      "CREATE UNIQUE INDEX users_sso_subject_idx ON users (sso_subject)"
    );
  })().catch((error) => {
    schemaSetup = null;
    throw error;
  });
  return schemaSetup;
}

export async function syncSsoUser(session: AppSession): Promise<UserRole> {
  await ensureSsoUsersSchema();
  const username = `sso:${session.sub}`;
  const now = Date.now();

  // The first real SSO account becomes the bootstrap admin. Further users default
  // to employee and can be promoted from the Admin Rights page.
  const rows = await sql.begin(async (tx) => {
    const lockRows = await tx`SELECT GET_LOCK('stock_flow_sso_bootstrap', 10) AS lock_status`;
    if (Number(lockRows[0]?.lock_status || 0) !== 1) {
      throw new Error("Unable to acquire SSO bootstrap lock");
    }
    try {
      const bootstrapRows = await tx`
        SELECT COUNT(*) AS count
        FROM users
        WHERE sso_subject IS NOT NULL
      `;
      const isBootstrapAdmin = Number(bootstrapRows[0]?.count || 0) === 0;

      await tx`
        INSERT INTO users (
          username, sso_subject, email, display_name, sso_user_id, department,
          division, is_admin, role, created_at, last_login_at
        )
        VALUES (
          ${username}, ${session.sub}, ${session.email ?? null}, ${session.name},
          ${session.userId ?? null}, ${session.department ?? null}, ${session.division ?? null},
          ${isBootstrapAdmin},
          ${isBootstrapAdmin ? "admin" : "employee"},
          ${now}, ${now}
        )
        ON DUPLICATE KEY UPDATE
          email = VALUES(email),
          display_name = VALUES(display_name),
          sso_user_id = VALUES(sso_user_id),
          department = VALUES(department),
          division = VALUES(division),
          last_login_at = VALUES(last_login_at)
      `;
      return tx`SELECT role FROM users WHERE username = ${username} LIMIT 1`;
    } finally {
      await tx`SELECT RELEASE_LOCK('stock_flow_sso_bootstrap') AS lock_status`;
    }
  });
  const role = rows[0]?.role;
  return role === "admin" || role === "manager" ? role : "employee";
}

export async function getCurrentUser() {
  const session = readSessionCookie((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  // Normal requests only read the role. User provisioning belongs to the SSO
  // callback, avoiding schema checks and writes on every API request.
  let rows;
  try {
    rows = await sql`SELECT role FROM users WHERE sso_subject = ${session.sub} LIMIT 1`;
  } catch (error: any) {
    // Supports the first request during a rolling deployment before migration.
    if (error?.code !== "ER_BAD_FIELD_ERROR" && error?.code !== "ER_NO_SUCH_TABLE") throw error;
    const role = await syncSsoUser(session);
    return { ...session, role };
  }
  if (!rows[0]) {
    const role = await syncSsoUser(session);
    return { ...session, role };
  }
  const value = rows[0].role;
  const role: UserRole = value === "admin" || value === "manager" ? value : "employee";
  return { ...session, role };
}
