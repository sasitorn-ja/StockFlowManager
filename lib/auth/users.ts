import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { AppSession, readSessionCookie, SESSION_COOKIE } from "./session";

export type UserRole = "employee" | "manager" | "admin";

export async function ensureSsoUsersSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS stock_flow_admin_users (
      username VARCHAR(255) PRIMARY KEY,
      is_admin BOOLEAN DEFAULT FALSE,
      role VARCHAR(50) DEFAULT 'employee',
      created_at BIGINT
    )
  `;
  await sql`ALTER TABLE stock_flow_admin_users ADD COLUMN IF NOT EXISTS sso_subject VARCHAR(255)`;
  await sql`ALTER TABLE stock_flow_admin_users ADD COLUMN IF NOT EXISTS email VARCHAR(320)`;
  await sql`ALTER TABLE stock_flow_admin_users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)`;
  await sql`ALTER TABLE stock_flow_admin_users ADD COLUMN IF NOT EXISTS sso_user_id VARCHAR(255)`;
  await sql`ALTER TABLE stock_flow_admin_users ADD COLUMN IF NOT EXISTS department VARCHAR(255)`;
  await sql`ALTER TABLE stock_flow_admin_users ADD COLUMN IF NOT EXISTS division VARCHAR(255)`;
  await sql`ALTER TABLE stock_flow_admin_users ADD COLUMN IF NOT EXISTS last_login_at BIGINT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS stock_flow_admin_users_sso_subject_idx ON stock_flow_admin_users (sso_subject) WHERE sso_subject IS NOT NULL`;
}

export async function syncSsoUser(session: AppSession): Promise<UserRole> {
  await ensureSsoUsersSchema();
  const username = `sso:${session.sub}`;
  const now = Date.now();

  // The first real SSO account becomes the bootstrap admin. Further users default
  // to employee and can be promoted from the Admin Rights page.
  const rows = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(732941)`;
    return tx`
      INSERT INTO stock_flow_admin_users (
        username, sso_subject, email, display_name, sso_user_id, department,
        division, is_admin, role, created_at, last_login_at
      )
      VALUES (
        ${username}, ${session.sub}, ${session.email ?? null}, ${session.name},
        ${session.userId ?? null}, ${session.department ?? null}, ${session.division ?? null},
        NOT EXISTS (SELECT 1 FROM stock_flow_admin_users WHERE sso_subject IS NOT NULL),
        CASE WHEN NOT EXISTS (SELECT 1 FROM stock_flow_admin_users WHERE sso_subject IS NOT NULL)
          THEN 'admin' ELSE 'employee' END,
        ${now}, ${now}
      )
      ON CONFLICT (username) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        sso_user_id = EXCLUDED.sso_user_id,
        department = EXCLUDED.department,
        division = EXCLUDED.division,
        last_login_at = EXCLUDED.last_login_at
      RETURNING role
    `;
  });
  const role = rows[0]?.role;
  return role === "admin" || role === "manager" ? role : "employee";
}

export async function getCurrentUser() {
  const session = readSessionCookie((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const role = await syncSsoUser(session);
  return { ...session, role };
}
