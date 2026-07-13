import { NextResponse } from "next/server";
import { ensureColumn, ensureColumnDefinition, ensureIndex, sql } from "@/lib/db";
import { createSampleTransactions } from "@/lib/stock-flow/sample-data";
import { buildItemKey } from "@/lib/stock-flow/utils";
import { getCurrentUser } from "@/lib/auth/users";
import { sendRequisitionNotice } from "@/lib/requisition-email";
import { getAppSettings } from "@/lib/app-settings";
import type { TransactionStatus } from "@/types/stock-flow";

export const dynamic = "force-dynamic";

function isSasitornTester(user: { name?: string; email?: string }) {
  return user.name?.trim().toLowerCase() === "ศศิธร จรุงจรรยาพงศ์" ||
    user.email?.trim().toLowerCase() === "sasitoja@scg.com";
}

let transactionTableSetup: Promise<void> | null = null;

async function ensureTableExists() {
  if (transactionTableSetup) return transactionTableSetup;

  transactionTableSetup = (async () => {
    await sql.begin(async (tx) => {
      await tx`
        CREATE TABLE IF NOT EXISTS users (
          username VARCHAR(255) PRIMARY KEY,
          is_admin BOOLEAN DEFAULT 0,
          role VARCHAR(50) DEFAULT 'employee',
          created_at BIGINT
        );
      `;

      await ensureColumn("users", "role", "VARCHAR(50) DEFAULT 'employee'");
      await tx`
        UPDATE users
        SET role = CASE WHEN is_admin THEN 'admin' ELSE 'employee' END
        WHERE role IS NULL OR role = '';
      `;

      await tx`
        CREATE TABLE IF NOT EXISTS transactions (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          sku VARCHAR(100),
          category VARCHAR(100),
          "imageDataUrl" LONGTEXT,
          "productImportType" VARCHAR(50),
          unit VARCHAR(50),
          type VARCHAR(50),
          quantity BIGINT,
          price DECIMAL(15,4),
          "costPrice" DECIMAL(15,4),
          "costCurrency" VARCHAR(10),
          date VARCHAR(50),
          "expiryDate" VARCHAR(50),
          "issueKey" VARCHAR(100),
          requester VARCHAR(255),
          "createdBy" VARCHAR(255),
          approver VARCHAR(255),
          note TEXT,
          "createdAt" BIGINT,
          status VARCHAR(50) DEFAULT 'confirmed'
        );
      `;

      await ensureColumn("transactions", "status", "VARCHAR(50) DEFAULT 'confirmed'");
      await ensureColumn("transactions", "createdBy", "VARCHAR(255) DEFAULT ''");
      await ensureColumnDefinition("transactions", "imageDataUrl", "LONGTEXT");
      await tx`UPDATE transactions SET quantity = FLOOR(quantity) WHERE quantity <> FLOOR(quantity);`;
      await ensureColumnDefinition("transactions", "quantity", "BIGINT NOT NULL DEFAULT 0");
      await ensureIndex(
        "transactions",
        "transactions_created_at_idx",
        "CREATE INDEX transactions_created_at_idx ON transactions (`createdAt`)"
      );
      await ensureIndex(
        "transactions",
        "transactions_issue_key_idx",
        "CREATE INDEX transactions_issue_key_idx ON transactions (`issueKey`)"
      );
      await ensureIndex(
        "transactions",
        "transactions_status_idx",
        "CREATE INDEX transactions_status_idx ON transactions (status)"
      );
      await ensureIndex(
        "transactions",
        "transactions_requester_idx",
        "CREATE INDEX transactions_requester_idx ON transactions (requester)"
      );
      await ensureIndex(
        "transactions",
        "transactions_created_by_idx",
        "CREATE INDEX transactions_created_by_idx ON transactions (`createdBy`)"
      );
      await ensureIndex(
        "transactions",
        "transactions_approver_idx",
        "CREATE INDEX transactions_approver_idx ON transactions (approver)"
      );
    });
  })().catch((error) => {
    transactionTableSetup = null;
    throw error;
  });

  return transactionTableSetup;
}

// GET all transactions
export async function GET() {
  try {
    await ensureTableExists();
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const baseSelect = actor.role === "admin" ? await sql`
      SELECT 
        id, name, sku, category, 
        "imageDataUrl", "productImportType", unit, type,
        CAST(quantity AS FLOAT) as quantity, 
        CAST(price AS FLOAT) as price, 
        CAST("costPrice" AS FLOAT) as "costPrice", 
        "costCurrency", date, "expiryDate", "issueKey", 
        requester, "createdBy", approver, note, "createdAt", status
      FROM transactions 
      ORDER BY "createdAt" DESC;
    ` : actor.role === "manager" ? await sql`
      SELECT id, name, sku, category, "imageDataUrl", "productImportType", unit, type,
        CAST(quantity AS FLOAT) quantity, CAST(price AS FLOAT) price,
        CAST("costPrice" AS FLOAT) "costPrice", "costCurrency", date, "expiryDate",
        "issueKey", requester, "createdBy", approver, note, "createdAt", status
      FROM transactions
      WHERE type = 'in'
        OR requester = ${actor.name}
        OR "createdBy" = ${actor.name}
        OR approver = ${actor.name}
      ORDER BY "createdAt" DESC
    ` : await sql`
      SELECT id, name, sku, category, "imageDataUrl", "productImportType", unit, type,
        CAST(quantity AS FLOAT) quantity, CAST(price AS FLOAT) price,
        CAST("costPrice" AS FLOAT) "costPrice", "costCurrency", date, "expiryDate",
        "issueKey", requester, "createdBy", approver, note, "createdAt", status
      FROM transactions
      WHERE type = 'in'
        OR requester = ${actor.name}
        OR "createdBy" = ${actor.name}
      ORDER BY "createdAt" DESC
    `;
    return NextResponse.json(baseSelect);
  } catch (error: any) {
    console.error("GET transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST new transaction(s)
export async function POST(request: Request) {
  try {
    await ensureTableExists();
    const actor = await getCurrentUser();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const settings = await getAppSettings();

    // Check if it is a batch of transactions (array)
    const items = Array.isArray(body) ? body : [body];
    const hasStockIn = items.some((item) => (item.type || "in") === "in");
    if (hasStockIn && actor.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    for (const item of items) {
      if (!item.name || !item.unit) {
        return NextResponse.json({ error: "Missing required fields: name or unit" }, { status: 400 });
      }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return NextResponse.json({ error: "Quantity must be a positive integer" }, { status: 400 });
      }

      await sql`
        INSERT INTO transactions (
          id, name, sku, category, "imageDataUrl", "productImportType", unit, type,
          quantity, price, "costPrice", "costCurrency", date, "expiryDate", "issueKey", requester, "createdBy", approver, note, "createdAt", status
        ) VALUES (
          ${item.id || `txn-${Date.now()}-${Math.random().toString(36).slice(2)}`},
          ${item.name},
          ${item.sku || ""},
          ${item.category || "-"},
          ${item.imageDataUrl || ""},
          ${item.productImportType || "resale"},
          ${item.unit},
          ${item.type || "in"},
          ${quantity},
          ${item.price || 0},
          ${item.costPrice || 0},
          ${item.costCurrency || "THB"},
          ${item.date},
          ${item.expiryDate || ""},
          ${item.issueKey || ""},
          ${item.requester || actor.name || ""},
          ${actor.name || ""},
          ${item.approver || ""},
          ${item.note || ""},
          ${item.createdAt || Date.now()},
          ${item.status || (item.type === 'out' ? (settings.approvalMode === "off" ? "approved" : "pending") : 'confirmed')}
        )
      `;
    }

    const issue = items.find((item) => (item.type || "in") === "out");
    if (issue?.issueKey) {
      const issueStatus = (issue.status || (settings.approvalMode === "off" ? "approved" : "pending")) as TransactionStatus;
      await sendRequisitionNotice({
        issueKey: issue.issueKey,
        status: issueStatus,
        actorName: actor.name,
        requester: issue.requester || actor.name,
        createdBy: actor.name,
        approver: issue.approver || "",
      }).catch((error) => console.error("Requisition email failed", error));
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
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (action !== "update_status" && actor.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Action 3: Update status for an entire issueKey batch
    if (action === "update_status" && issueKey && status) {
      const requisitionRows = await sql`
        SELECT requester, "createdBy", approver, status
        FROM transactions WHERE "issueKey" = ${issueKey} LIMIT 1
      `;
      const requisition = requisitionRows[0];
      if (!requisition) return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
      const currentStatus = requisition.status || "completed";
      const settings = await getAppSettings();
      const isOwner = [requisition.requester, requisition.createdBy].some(
        (name) => String(name || "").trim() === actor.name.trim()
      );
      const allowed =
        (status === "approved" && currentStatus === "pending" && (actor.role === "manager" || (actor.role === "admin" && isSasitornTester(actor))) && (!requisition.approver || requisition.approver === actor.name)) ||
        (status === "issued" && currentStatus === "approved" && actor.role === "admin") ||
        (status === "received" && currentStatus === "issued" && String(requisition.requester || "").trim() === actor.name.trim()) ||
        (status === "completed" && currentStatus === "issued" && actor.role === "admin" && !settings.requireEmployeeConfirmation) ||
        (status === "completed" && (currentStatus === "received" || currentStatus === "employee_confirmed") && actor.role === "admin") ||
        (status === "cancelled" && currentStatus === "pending" && (isOwner || actor.role === "admin"));
      if (!allowed) return NextResponse.json({ error: "ไม่สามารถเปลี่ยนสถานะในขั้นตอนนี้ได้" }, { status: 403 });

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
      await sendRequisitionNotice({
        issueKey,
        status: status as TransactionStatus,
        actorName: actor.name,
        requester: requisition.requester,
        createdBy: requisition.createdBy,
        approver: body.approver || requisition.approver,
      }).catch((error) => console.error("Requisition email failed", error));
      return NextResponse.json({ success: true });
    }

    // Action 1: Update all transactions matching a product itemKey
    if (action === "update_product" && itemKey && updatedData) {
      const rows = await sql`SELECT id, name, sku, category, "productImportType", unit, "expiryDate" FROM transactions;`;
      const hasLotSelection = Object.prototype.hasOwnProperty.call(body, "lotExpiryDate");
      
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
          const row = rows.find((item) => item.id === transactionId);
          const isSelectedLot = !hasLotSelection || (row?.expiryDate || "") === (body.lotExpiryDate || "");

          if (isSelectedLot) {
            await sql`
              UPDATE transactions
              SET name = ${updatedData.name}, sku = ${updatedData.sku}, category = ${updatedData.category || "-"},
                  "productImportType" = ${updatedData.productImportType}, "imageDataUrl" = ${updatedData.imageDataUrl || ""},
                  unit = ${updatedData.unit}, price = ${updatedData.price}, "costPrice" = ${updatedData.costPrice},
                  "expiryDate" = ${updatedData.expiryDate || ""}
              WHERE id = ${transactionId}
            `;
          } else {
            await sql`
              UPDATE transactions
              SET name = ${updatedData.name}, sku = ${updatedData.sku}, category = ${updatedData.category || "-"},
                  "productImportType" = ${updatedData.productImportType}, "imageDataUrl" = ${updatedData.imageDataUrl || ""},
                  unit = ${updatedData.unit}
              WHERE id = ${transactionId}
            `;
          }
        }
      }

      return NextResponse.json({ success: true, updatedCount: idsToUpdate.length });
    }

    // Action 2: Update a single transaction
    if (id) {
      const quantity = Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return NextResponse.json({ error: "Quantity must be a positive integer" }, { status: 400 });
      }
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
          quantity = ${quantity},
          price = ${body.price || 0},
          "costPrice" = ${body.costPrice || 0},
          "costCurrency" = ${body.costCurrency || "THB"},
          date = ${body.date},
          "expiryDate" = ${body.expiryDate || ""},
          "issueKey" = ${body.issueKey || ""},
          requester = ${body.requester || ""},
          "createdBy" = ${body.createdBy || ""},
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
    const actor = await getCurrentUser();
    if (actor?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
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
