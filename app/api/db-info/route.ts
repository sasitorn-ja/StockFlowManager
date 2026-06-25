import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 500 });
    }

    // Extract host from connection string for presentation
    let host = "Unknown";
    try {
      const url = new URL(process.env.DATABASE_URL);
      host = url.hostname;
    } catch {
      // If it's a non-standard postgres:// URL (e.g. pooler), try to parse manually
      const match = process.env.DATABASE_URL.match(/@([^/?:#]+)/);
      if (match) {
        host = match[1];
      }
    }

    const startPing = Date.now();
    await sql`SELECT 1;`;
    const ping = Date.now() - startPing;

    // Get table count
    let rowCount = 0;
    try {
      const countRes = await sql`SELECT COUNT(*) as count FROM transactions;`;
      rowCount = parseInt(countRes[0]?.count || "0", 10);
    } catch (e) {
      // Table might not exist yet
    }

    // Get column definitions from information_schema
    let columns: any[] = [];
    try {
      columns = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'transactions'
        ORDER BY ordinal_position;
      `;
    } catch (e) {
      // Table might not exist yet
    }

    return NextResponse.json({
      connected: true,
      host,
      pingMs: ping,
      tableName: "transactions",
      rowCount,
      columns: columns.map((col: any) => ({
        columnName: col.column_name,
        dataType: col.data_type,
        isNullable: col.is_nullable,
      })),
    });
  } catch (error: any) {
    console.error("GET db-info error:", error);
    return NextResponse.json({
      connected: false,
      error: error.message,
    }, { status: 500 });
  }
}
