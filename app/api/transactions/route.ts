import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { createSampleTransactions } from "@/lib/stock-flow/sample-data";
import { buildItemKey } from "@/lib/stock-flow/utils";

export const dynamic = "force-dynamic";

// In-memory cache flag to avoid checking table existence on every query
let isTableChecked = false;

// Helper function to create the transactions table if it doesn't exist
async function ensureTableExists() {
  if (isTableChecked) return;
  try {
    // Ensure admin_users table exists
    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        username VARCHAR(255) PRIMARY KEY,
        is_admin BOOLEAN DEFAULT TRUE,
        role VARCHAR(50) DEFAULT 'admin',
        created_at BIGINT
      );
    `;

    await sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'admin';`;
    await sql`
      UPDATE admin_users
      SET role = CASE WHEN is_admin THEN 'admin' ELSE 'employee' END
      WHERE role IS NULL OR role = '';
    `;

    // Seed default admin if it doesn't exist
    const admins = await sql`SELECT 1 FROM admin_users WHERE username = 'แอดมิน' LIMIT 1;`;
    if (admins.length === 0) {
      await sql`
        INSERT INTO admin_users (username, is_admin, role, created_at)
        VALUES ('แอดมิน', TRUE, 'admin', ${Date.now()});
      `;
    }

    const managers = await sql`SELECT 1 FROM admin_users WHERE username = 'ผู้จัดการ' LIMIT 1;`;
    if (managers.length === 0) {
      await sql`
        INSERT INTO admin_users (username, is_admin, role, created_at)
        VALUES ('ผู้จัดการ', FALSE, 'manager', ${Date.now()});
      `;
    }

    // Check if table exists
    await sql`SELECT 1 FROM transactions LIMIT 1;`;
    
    // Add column if it doesn't exist for existing DBs
    await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'confirmed';`;
    isTableChecked = true;
  } catch (error: any) {
    // If table doesn't exist, create it
    if (error?.message?.includes("does not exist") || error?.code === "42P01") {
      console.log("Table 'transactions' does not exist. Creating it...");
      await sql`
        CREATE TABLE IF NOT EXISTS transactions (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          sku VARCHAR(100),
          category VARCHAR(100),
          "imageDataUrl" TEXT,
          "productImportType" VARCHAR(50),
          unit VARCHAR(50),
          type VARCHAR(50),
          quantity NUMERIC,
          price NUMERIC,
          "costPrice" NUMERIC,
          "costCurrency" VARCHAR(10),
          date VARCHAR(50),
          "expiryDate" VARCHAR(50),
          "issueKey" VARCHAR(100),
          requester VARCHAR(255),
          approver VARCHAR(255),
          note TEXT,
          "createdAt" BIGINT,
          status VARCHAR(50) DEFAULT 'confirmed'
        );
      `;

      // Seed table with sample data
      const sampleTxns = createSampleTransactions();
      for (const item of sampleTxns) {
        await sql`
          INSERT INTO transactions (
            id, name, sku, category, "imageDataUrl", "productImportType", unit, type,
            quantity, price, "costPrice", "costCurrency", date, "expiryDate", "issueKey", requester, approver, note, "createdAt", status
          ) VALUES (
            ${item.id},
            ${item.name},
            ${item.sku || ""},
            ${item.category || "-"},
            ${item.imageDataUrl || ""},
            ${item.productImportType},
            ${item.unit},
            ${item.type},
            ${item.quantity},
            ${item.price},
            ${item.costPrice},
            ${item.costCurrency},
            ${item.date},
            ${item.expiryDate || ""},
            ${item.issueKey || ""},
            ${item.requester || ""},
            ${item.approver || ""},
            ${item.note || ""},
            ${item.createdAt},
            'confirmed'
          )
        `;
      }
      console.log("Table 'transactions' created and seeded successfully.");
      isTableChecked = true;
    } else {
      console.error("Error checking or creating database tables:", error);
    }
  }
}

// GET all transactions
export async function GET() {
  try {
    await ensureTableExists();

    const rows = await sql`
      SELECT 
        id, name, sku, category, 
        "imageDataUrl", "productImportType", unit, type,
        CAST(quantity AS FLOAT) as quantity, 
        CAST(price AS FLOAT) as price, 
        CAST("costPrice" AS FLOAT) as "costPrice", 
        "costCurrency", date, "expiryDate", "issueKey", 
        requester, approver, note, "createdAt", status
      FROM transactions 
      ORDER BY "createdAt" DESC;
    `;

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("GET transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST new transaction(s)
export async function POST(request: Request) {
  try {
    await ensureTableExists();
    const body = await request.json();

    // Check if it is a batch of transactions (array)
    const items = Array.isArray(body) ? body : [body];

    for (const item of items) {
      if (!item.name || !item.unit) {
        return NextResponse.json({ error: "Missing required fields: name or unit" }, { status: 400 });
      }

      await sql`
        INSERT INTO transactions (
          id, name, sku, category, "imageDataUrl", "productImportType", unit, type,
          quantity, price, "costPrice", "costCurrency", date, "expiryDate", "issueKey", requester, approver, note, "createdAt", status
        ) VALUES (
          ${item.id || `txn-${Date.now()}-${Math.random().toString(36).slice(2)}`},
          ${item.name},
          ${item.sku || ""},
          ${item.category || "-"},
          ${item.imageDataUrl || ""},
          ${item.productImportType || "resale"},
          ${item.unit},
          ${item.type || "in"},
          ${item.quantity || 0},
          ${item.price || 0},
          ${item.costPrice || 0},
          ${item.costCurrency || "THB"},
          ${item.date},
          ${item.expiryDate || ""},
          ${item.issueKey || ""},
          ${item.requester || ""},
          ${item.approver || ""},
          ${item.note || ""},
          ${item.createdAt || Date.now()},
          ${item.status || (item.type === 'out' ? 'pending' : 'confirmed')}
        )
      `;
    }

    return NextResponse.json({ success: true, count: items.length });
  } catch (error: any) {
    console.error("POST transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT (update a product across transactions or a single transaction)
export async function PUT(request: Request) {
  try {
    await ensureTableExists();
    const body = await request.json();
    const { action, itemKey, updatedData, id, issueKey, status } = body;

    // Action 3: Update status for an entire issueKey batch
    if (action === "update_status" && issueKey && status) {
      if (body.approver) {
        await sql`
          UPDATE transactions
          SET status = ${status}, approver = ${body.approver}
          WHERE "issueKey" = ${issueKey}
        `;
      } else {
        await sql`
          UPDATE transactions
          SET status = ${status}
          WHERE "issueKey" = ${issueKey}
        `;
      }
      return NextResponse.json({ success: true });
    }

    // Action 1: Update all transactions matching a product itemKey
    if (action === "update_product" && itemKey && updatedData) {
      const rows = await sql`SELECT id, name, sku, category, "productImportType", unit FROM transactions;`;
      
      const idsToUpdate: string[] = [];
      for (const row of rows) {
        const key = buildItemKey({
          name: row.name,
          sku: row.sku,
          category: row.category,
          productImportType: row.productImportType,
          unit: row.unit,
        } as any);

        if (key === itemKey) {
          idsToUpdate.push(row.id);
        }
      }

      if (idsToUpdate.length > 0) {
        for (const transactionId of idsToUpdate) {
          await sql`
            UPDATE transactions
            SET 
              name = ${updatedData.name},
              sku = ${updatedData.sku},
              category = ${updatedData.category || "-"},
              "productImportType" = ${updatedData.productImportType},
              "imageDataUrl" = ${updatedData.imageDataUrl || ""},
              unit = ${updatedData.unit},
              price = ${updatedData.price},
              "costPrice" = ${updatedData.costPrice},
              "expiryDate" = ${updatedData.expiryDate || ""}
            WHERE id = ${transactionId}
          `;
        }
      }

      return NextResponse.json({ success: true, updatedCount: idsToUpdate.length });
    }

    // Action 2: Update a single transaction
    if (id) {
      await sql`
        UPDATE transactions
        SET 
          name = ${body.name},
          sku = ${body.sku || ""},
          category = ${body.category || "-"},
          "imageDataUrl" = ${body.imageDataUrl || ""},
          "productImportType" = ${body.productImportType || "resale"},
          unit = ${body.unit},
          type = ${body.type || "in"},
          quantity = ${body.quantity || 0},
          price = ${body.price || 0},
          "costPrice" = ${body.costPrice || 0},
          "costCurrency" = ${body.costCurrency || "THB"},
          date = ${body.date},
          "expiryDate" = ${body.expiryDate || ""},
          "issueKey" = ${body.issueKey || ""},
          requester = ${body.requester || ""},
          approver = ${body.approver || ""},
          note = ${body.note || ""},
          status = ${body.status || "confirmed"}
        WHERE id = ${id}
      `;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action or parameters" }, { status: 400 });
  } catch (error: any) {
    console.error("PUT transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE transactions
export async function DELETE(request: Request) {
  try {
    await ensureTableExists();
    const url = new URL(request.url);
    const reset = url.searchParams.get("reset");
    const itemKey = url.searchParams.get("itemKey");
    const id = url.searchParams.get("id");

    // Case 1: Reset database
    if (reset === "true") {
      await sql`DELETE FROM transactions;`;
      return NextResponse.json({ success: true, message: "Cleared all transactions" });
    }

    // Case 2: Delete by product itemKey
    if (itemKey) {
      const rows = await sql`SELECT id, name, sku, category, "productImportType", unit FROM transactions;`;
      const idsToDelete: string[] = [];
      for (const row of rows) {
        const key = buildItemKey({
          name: row.name,
          sku: row.sku,
          category: row.category,
          productImportType: row.productImportType,
          unit: row.unit,
        } as any);

        if (key === itemKey) {
          idsToDelete.push(row.id);
        }
      }

      if (idsToDelete.length > 0) {
        for (const idToDelete of idsToDelete) {
          await sql`DELETE FROM transactions WHERE id = ${idToDelete}`;
        }
      }

      return NextResponse.json({ success: true, deletedCount: idsToDelete.length });
    }

    // Case 3: Delete single transaction
    if (id) {
      await sql`DELETE FROM transactions WHERE id = ${id}`;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Missing delete target parameters" }, { status: 400 });
  } catch (error: any) {
    console.error("DELETE transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
