import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Query admin list from database
    const dbAdmins = (await sql`
      SELECT username, is_admin, created_at FROM admin_users;
    `) as { username: string; is_admin: boolean; created_at: string | number }[];

    // 2. Query other users who have transactions in history
    let txUsers: { username: string }[] = [];
    try {
      txUsers = (await sql`
        SELECT DISTINCT requester AS username FROM transactions WHERE type = 'out' AND requester IS NOT NULL AND requester != ''
        UNION
        SELECT DISTINCT approver AS username FROM transactions WHERE type = 'out' AND approver IS NOT NULL AND approver != ''
      `) as { username: string }[];
    } catch (e) {
      console.warn("Transactions table may not exist yet or is empty:", e);
    }

    const userMap = new Map<string, { username: string; isAdmin: boolean; createdAt: number }>();

    // Seed default simulated entities immediately
    userMap.set("พนักงาน", { username: "พนักงาน", isAdmin: false, createdAt: 0 });
    userMap.set("แอดมิน", { username: "แอดมิน", isAdmin: true, createdAt: 0 });

    // Populate transaction users
    for (const u of txUsers) {
      const name = u.username.trim();
      if (name) {
        userMap.set(name, {
          username: name,
          isAdmin: false,
          createdAt: Date.now(),
        });
      }
    }

    // Overwrite with DB admin values
    for (const adm of dbAdmins) {
      const name = adm.username.trim();
      if (name) {
        userMap.set(name, {
          username: name,
          isAdmin: Boolean(adm.is_admin),
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
    const { username, isAdmin } = await request.json();
    const name = username?.trim();

    if (!name) {
      return NextResponse.json({ error: "ต้องระบุชื่อพนักงาน" }, { status: 400 });
    }

    const timestamp = Date.now();

    await sql`
      INSERT INTO admin_users (username, is_admin, created_at)
      VALUES (${name}, ${Boolean(isAdmin)}, ${timestamp})
      ON CONFLICT (username)
      DO UPDATE SET is_admin = ${Boolean(isAdmin)};
    `;

    return NextResponse.json({ success: true, username: name, isAdmin });
  } catch (error: any) {
    console.error("POST admin-users error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
