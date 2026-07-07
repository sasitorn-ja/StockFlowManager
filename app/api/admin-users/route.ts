import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureSsoUsersSchema, getCurrentUser, UserRole } from "@/lib/auth/users";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

export async function GET() {
  try {
    const actor = await requireAdmin();
    if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await ensureSsoUsersSchema();
    const users = await sql`
      SELECT username, sso_subject, email, display_name, sso_user_id, department,
             division, role, created_at, last_login_at
      FROM stock_flow_admin_users
      WHERE sso_subject IS NOT NULL
      ORDER BY display_name ASC, email ASC
    `;
    return NextResponse.json(users.map((user) => ({
      username: user.username,
      name: user.display_name || user.sso_user_id || user.email || user.username,
      email: user.email,
      userId: user.sso_user_id,
      department: user.department,
      division: user.division,
      role: user.role === "admin" || user.role === "manager" ? user.role : "employee",
      isAdmin: user.role === "admin",
      createdAt: Number(user.created_at || 0),
      lastLoginAt: Number(user.last_login_at || 0),
    })));
  } catch (error) {
    console.error("GET admin-users error:", error);
    return NextResponse.json({ error: "Unable to load users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { username, role } = await request.json() as { username?: string; role?: UserRole };
    const nextRole = role === "admin" || role === "manager" || role === "employee" ? role : null;
    if (!username || !nextRole) {
      return NextResponse.json({ error: "Invalid user or role" }, { status: 400 });
    }

    const target = await sql`SELECT sso_subject, role FROM stock_flow_admin_users WHERE username = ${username} LIMIT 1`;
    if (!target[0]?.sso_subject) {
      return NextResponse.json({ error: "SSO user not found" }, { status: 404 });
    }
    if (target[0].sso_subject === actor.sub && nextRole !== "admin") {
      return NextResponse.json({ error: "ไม่สามารถลดสิทธิ์บัญชีของตนเองได้" }, { status: 400 });
    }
    if (target[0].role === "admin" && nextRole !== "admin") {
      const admins = await sql`SELECT COUNT(*)::int AS count FROM stock_flow_admin_users WHERE sso_subject IS NOT NULL AND role = 'admin'`;
      if (Number(admins[0]?.count) <= 1) {
        return NextResponse.json({ error: "ระบบต้องมีแอดมินอย่างน้อย 1 คน" }, { status: 400 });
      }
    }

    await sql`
      UPDATE stock_flow_admin_users
      SET role = ${nextRole}, is_admin = ${nextRole === "admin"}
      WHERE username = ${username} AND sso_subject IS NOT NULL
    `;
    return NextResponse.json({ success: true, username, role: nextRole, isAdmin: nextRole === "admin" });
  } catch (error) {
    console.error("POST admin-users error:", error);
    return NextResponse.json({ error: "Unable to update role" }, { status: 500 });
  }
}
