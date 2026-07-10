import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/users";

async function ensureCategoryTable() {
  await sql`CREATE TABLE IF NOT EXISTS product_categories (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at BIGINT,
    updated_at BIGINT
  )`;
}

export async function GET() {
  const actor = await getCurrentUser();
  if (actor?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await ensureCategoryTable();
  const rows = await sql`
    SELECT name FROM product_categories
    UNION SELECT category AS name FROM products WHERE category IS NOT NULL AND category <> '' AND category <> '-'
    UNION SELECT category AS name FROM transactions WHERE category IS NOT NULL AND category <> '' AND category <> '-'
    ORDER BY name
  `;
  return NextResponse.json(rows.map((row) => String(row.name)));
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (actor?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await ensureCategoryTable();
  const body = await request.json();
  const name = String(body.name || "").trim();
  if (!name || name === "-") return NextResponse.json({ error: "กรอกชื่อหมวดหมู่" }, { status: 400 });
  const now = Date.now();
  await sql`INSERT INTO product_categories (id, name, created_at, updated_at)
    VALUES (${`cat-${now}-${Math.random().toString(36).slice(2, 8)}`}, ${name}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at)`;
  return NextResponse.json({ success: true });
}

export async function PUT(request: Request) {
  const actor = await getCurrentUser();
  if (actor?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await ensureCategoryTable();
  const body = await request.json();
  const oldName = String(body.oldName || "").trim();
  const newName = String(body.newName || "").trim();
  if (!oldName || !newName || newName === "-") return NextResponse.json({ error: "ชื่อหมวดหมู่ไม่ถูกต้อง" }, { status: 400 });
  await sql.begin(async (tx) => {
    const now = Date.now();
    await tx`INSERT INTO product_categories (id, name, created_at, updated_at)
      VALUES (${`cat-${now}-${Math.random().toString(36).slice(2, 8)}`}, ${newName}, ${now}, ${now})
      ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at)`;
    await tx`UPDATE products SET category = ${newName}, "updatedAt" = ${now} WHERE category = ${oldName}`;
    await tx`UPDATE transactions SET category = ${newName} WHERE category = ${oldName}`;
    await tx`DELETE FROM product_categories WHERE name = ${oldName}`;
  });
  return NextResponse.json({ success: true });
}
