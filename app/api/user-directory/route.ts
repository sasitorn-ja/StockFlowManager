import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/users";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const users = await sql`
      SELECT display_name, email, sso_user_id, role
      FROM users
      WHERE sso_subject IS NOT NULL
      ORDER BY display_name ASC, email ASC
    `;

    return NextResponse.json(users.map((user) => ({
      name: user.display_name || user.sso_user_id || user.email || "ผู้ใช้งาน",
      email: user.email || "",
      userId: user.sso_user_id || "",
      role: user.role === "admin" || user.role === "manager" ? user.role : "employee",
    })));
  } catch (error) {
    console.error("GET user-directory error:", error);
    return NextResponse.json({ error: "Unable to load user directory" }, { status: 500 });
  }
}
