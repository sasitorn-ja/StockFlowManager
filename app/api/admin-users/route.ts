import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type UserRole = "employee" | "manager" | "admin";

const FIXED_USERS: Array<{ username: string; role: UserRole }> = [
  { username: "สมหญิง", role: "employee" },
  { username: "สมชาย", role: "employee" },
  { username: "ผู้จัดการ", role: "manager" },
  { username: "แอดมิน", role: "admin" },
];

async function ensureAdminUsersTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS stock_flow_admin_users (
      username VARCHAR(255) PRIMARY KEY,
      is_admin BOOLEAN DEFAULT TRUE,
      role VARCHAR(50) DEFAULT 'admin',
      created_at BIGINT
    );
  `;

  await sql`ALTER TABLE stock_flow_admin_users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'admin';`;
  await sql`
    UPDATE stock_flow_admin_users
    SET role = CASE WHEN is_admin THEN 'admin' ELSE 'employee' END
    WHERE role IS NULL OR role = '';
  `;

  for (const user of FIXED_USERS) {
    await sql`
      INSERT INTO stock_flow_admin_users (username, is_admin, role, created_at)
      VALUES (${user.username}, ${user.role === "admin"}, ${user.role}, ${Date.now()})
      ON CONFLICT (username) DO NOTHING;
    `;
  }
}

export async function GET() {
  try {
    await ensureAdminUsersTable();

    // 1. Query admin list from database
    const dbAdmins = (await sql`
      SELECT username, is_admin, role, created_at FROM stock_flow_admin_users;
    `) as { username: string; is_admin: boolean; role?: string; created_at: string | number }[];

    const userMap = new Map<
      string,
      { username: string; isAdmin: boolean; role: UserRole; createdAt: number }
    >();

    for (const user of FIXED_USERS) {
      userMap.set(user.username, {
        username: user.username,
        isAdmin: user.role === "admin",
        role: user.role,
        createdAt: 0,
      });
    }

    // Overwrite with DB admin values
    for (const adm of dbAdmins) {
      const name = adm.username.trim();
      if (!FIXED_USERS.some((user) => user.username === name)) {
        continue;
      }

      const role = adm.role === "admin" || adm.role === "manager" ? adm.role : "employee";
      if (name) {
        userMap.set(name, {
          username: name,
          isAdmin: role === "admin",
          role,
          createdAt: Number(adm.created_at || Date.now()),
        });
      }
    }

    const list = Array.from(userMap.values()).sort((a, b) =>
      a.username.localeCompare(b.username, "th")
    );

    return NextResponse.json(list);
  } catch (error: any) {
    console.error("GET admin-users error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureAdminUsersTable();

    const { username, isAdmin, role } = await request.json();
    const name = username?.trim();
    const nextRole: UserRole =
      role === "admin" || role === "manager" || role === "employee"
        ? role
        : Boolean(isAdmin)
          ? "admin"
          : "employee";

    if (!name) {
      return NextResponse.json({ error: "ต้องระบุชื่อพนักงาน" }, { status: 400 });
    }

    if (!FIXED_USERS.some((user) => user.username === name)) {
      return NextResponse.json(
        { error: "จัดการสิทธิ์ได้เฉพาะ สมหญิง, สมชาย, ผู้จัดการ และ แอดมิน เท่านั้น" },
        { status: 400 }
      );
    }

    if (nextRole === "employee" && name === "แอดมิน") {
      return NextResponse.json({ error: "ไม่สามารถลดสิทธิ์ของแอดมินหลักได้" }, { status: 400 });
    }

    const elevatedUsers = (await sql`
      SELECT username FROM stock_flow_admin_users
      WHERE role IN ('admin', 'manager') AND username <> ${name};
    `) as { username: string }[];

    if ((nextRole === "admin" || nextRole === "manager") && elevatedUsers.length >= 2) {
      return NextResponse.json(
        { error: "กำหนดสิทธิ์ผู้จัดการหรือแอดมินได้สูงสุด 2 คนเท่านั้น" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();

    await sql`
      INSERT INTO stock_flow_admin_users (username, is_admin, role, created_at)
      VALUES (${name}, ${nextRole === "admin"}, ${nextRole}, ${timestamp})
      ON CONFLICT (username)
      DO UPDATE SET is_admin = ${nextRole === "admin"}, role = ${nextRole};
    `;

    return NextResponse.json({ success: true, username: name, isAdmin: nextRole === "admin", role: nextRole });
  } catch (error: any) {
    console.error("POST admin-users error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
