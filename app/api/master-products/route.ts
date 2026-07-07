import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/users";

export const dynamic = "force-dynamic";

let masterProductTableSetup: Promise<void> | null = null;

async function ensureMasterProductTableExists() {
  if (masterProductTableSetup) {
    return masterProductTableSetup;
  }

  masterProductTableSetup = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS stock_flow_master_products (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(100) DEFAULT '',
        category VARCHAR(255) DEFAULT '-',
        "productImportType" VARCHAR(50) DEFAULT 'resale',
        "imageDataUrl" TEXT DEFAULT '',
        unit VARCHAR(50) NOT NULL,
        price NUMERIC DEFAULT 0,
        "costPrice" NUMERIC DEFAULT 0,
        "costCurrency" VARCHAR(10) DEFAULT 'THB',
        "defaultStorageLocation" VARCHAR(255) DEFAULT '',
        "defaultExpiryDate" VARCHAR(50) DEFAULT '',
        vendor VARCHAR(255) DEFAULT '',
        note TEXT DEFAULT '',
        "isActive" BOOLEAN DEFAULT TRUE,
        "createdAt" BIGINT,
        "updatedAt" BIGINT
      );
    `;

  })().catch((error) => {
    masterProductTableSetup = null;
    throw error;
  });

  return masterProductTableSetup;
}

function createMasterProductId() {
  return `prd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function syncMasterProductsFromTransactions() {
  try {
    const existingProducts = (await sql`
      SELECT id, name, sku, category, "productImportType", unit
      FROM stock_flow_master_products;
    `) as Array<{
      id: string;
      name: string;
      sku: string;
      category: string;
      productImportType: string;
      unit: string;
    }>;

    const existingKeys = new Set(
      existingProducts.map((item) =>
        [
          item.name?.trim().toLowerCase(),
          item.sku?.trim().toLowerCase(),
          (item.category || "-").trim().toLowerCase(),
          (item.productImportType || "resale").trim().toLowerCase(),
          item.unit?.trim().toLowerCase(),
        ].join("::")
      )
    );

    const transactionRows = (await sql`
      SELECT
        name,
        sku,
        category,
        "productImportType",
        "imageDataUrl",
        unit,
        CAST(price AS FLOAT) AS price,
        CAST("costPrice" AS FLOAT) AS "costPrice",
        "costCurrency",
        requester,
        "expiryDate",
        "createdAt"
      FROM stock_flow_transactions
      WHERE COALESCE(name, '') <> '' AND COALESCE(unit, '') <> ''
      ORDER BY "createdAt" DESC;
    `) as Array<{
      name: string;
      sku: string;
      category: string;
      productImportType: string;
      imageDataUrl: string;
      unit: string;
      price: number;
      costPrice: number;
      costCurrency: string;
      requester: string;
      expiryDate: string;
      createdAt: number;
    }>;

    const uniqueProducts = new Map<string, (typeof transactionRows)[number]>();

    transactionRows.forEach((item) => {
      const key = [
        item.name?.trim().toLowerCase(),
        item.sku?.trim().toLowerCase(),
        (item.category || "-").trim().toLowerCase(),
        (item.productImportType || "resale").trim().toLowerCase(),
        item.unit?.trim().toLowerCase(),
      ].join("::");

      if (!uniqueProducts.has(key)) {
        uniqueProducts.set(key, item);
      }
    });

    for (const product of uniqueProducts.values()) {
      const uniqueKey = [
        String(product.name || "").trim().toLowerCase(),
        String(product.sku || "").trim().toLowerCase(),
        String(product.category || "-").trim().toLowerCase(),
        String(product.productImportType || "resale").trim().toLowerCase(),
        String(product.unit || "").trim().toLowerCase(),
      ].join("::");

      if (existingKeys.has(uniqueKey)) {
        continue;
      }

      const timestamp = Number(product.createdAt || Date.now());

      await sql`
        INSERT INTO stock_flow_master_products (
          id,
          name,
          sku,
          category,
          "productImportType",
          "imageDataUrl",
          unit,
          price,
          "costPrice",
          "costCurrency",
          "defaultStorageLocation",
          "defaultExpiryDate",
          vendor,
          note,
          "isActive",
          "createdAt",
          "updatedAt"
        ) VALUES (
          ${createMasterProductId()},
          ${String(product.name || "").trim()},
          ${String(product.sku || "").trim()},
          ${String(product.category || "-").trim() || "-"},
          ${product.productImportType === "stable" ? "stable" : "resale"},
          ${String(product.imageDataUrl || "").trim()},
          ${String(product.unit || "").trim()},
          ${Math.max(0, Number(product.price || 0))},
          ${Math.max(0, Number(product.costPrice || 0))},
          ${product.costCurrency === "JPY" ||
          product.costCurrency === "CNY" ||
          product.costCurrency === "USD"
            ? product.costCurrency
            : "THB"},
          ${String(product.requester || "").trim()},
          ${String(product.expiryDate || "").trim()},
          ${""},
          ${""},
          ${true},
          ${timestamp},
          ${timestamp}
        );
      `;

      existingKeys.add(uniqueKey);
    }
  } catch (error) {
    console.error("Sync master-products from stock_flow_transactions error:", error);
  }
}

function normalizeProductPayload(payload: Record<string, unknown>) {
  return {
    name: String(payload.name || "").trim(),
    sku: String(payload.sku || "").trim(),
    category: String(payload.category || "-").trim() || "-",
    productImportType:
      payload.productImportType === "stable" || payload.productImportType === "resale"
        ? payload.productImportType
        : "resale",
    imageDataUrl: String(payload.imageDataUrl || "").trim(),
    unit: String(payload.unit || "").trim(),
    price: Math.max(0, Number(payload.price || 0)),
    costPrice: Math.max(0, Number(payload.costPrice || 0)),
    costCurrency:
      payload.costCurrency === "JPY" ||
      payload.costCurrency === "CNY" ||
      payload.costCurrency === "USD" ||
      payload.costCurrency === "THB"
        ? payload.costCurrency
        : "THB",
    defaultStorageLocation: String(payload.defaultStorageLocation || "").trim(),
    defaultExpiryDate: String(payload.defaultExpiryDate || "").trim(),
    vendor: String(payload.vendor || "").trim(),
    note: String(payload.note || "").trim(),
    isActive: payload.isActive !== false,
  };
}

async function validateDuplicateProduct(
  normalizedProduct: ReturnType<typeof normalizeProductPayload>,
  excludedId?: string
) {
  if (normalizedProduct.sku) {
    const skuRows = await sql`
      SELECT id FROM stock_flow_master_products
      WHERE LOWER(sku) = LOWER(${normalizedProduct.sku})
        AND (${excludedId || ""} = '' OR id <> ${excludedId || ""})
      LIMIT 1;
    `;

    if (skuRows.length > 0) {
      return "รหัสสินค้านี้มีอยู่แล้วใน Master Data";
    }
  }

  const duplicateRows = await sql`
    SELECT id FROM stock_flow_master_products
    WHERE LOWER(name) = LOWER(${normalizedProduct.name})
      AND LOWER(category) = LOWER(${normalizedProduct.category})
      AND LOWER(unit) = LOWER(${normalizedProduct.unit})
      AND LOWER("productImportType") = LOWER(${normalizedProduct.productImportType})
      AND (${excludedId || ""} = '' OR id <> ${excludedId || ""})
    LIMIT 1;
  `;

  if (duplicateRows.length > 0) {
    return "สินค้านี้มีอยู่แล้วใน Master Data";
  }

  return null;
}

export async function GET() {
  try {
    await ensureMasterProductTableExists();
    await syncMasterProductsFromTransactions();

    const rows = await sql`
      SELECT
        id,
        name,
        sku,
        category,
        "productImportType",
        "imageDataUrl",
        unit,
        CAST(price AS FLOAT) AS price,
        CAST("costPrice" AS FLOAT) AS "costPrice",
        "costCurrency",
        "defaultStorageLocation",
        "defaultExpiryDate",
        vendor,
        note,
        "isActive",
        "createdAt",
        "updatedAt"
      FROM stock_flow_master_products
      ORDER BY "isActive" DESC, "updatedAt" DESC, name ASC;
    `;

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("GET master-products error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getCurrentUser();
    if (actor?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await ensureMasterProductTableExists();
    const body = (await request.json()) as Record<string, unknown>;
    const product = normalizeProductPayload(body);

    if (!product.name || !product.unit) {
      return NextResponse.json({ error: "กรอกชื่อสินค้าและหน่วยนับให้ครบก่อนบันทึก" }, { status: 400 });
    }

    const duplicateMessage = await validateDuplicateProduct(product);
    if (duplicateMessage) {
      return NextResponse.json({ error: duplicateMessage }, { status: 400 });
    }

    const timestamp = Date.now();

    await sql`
      INSERT INTO stock_flow_master_products (
        id,
        name,
        sku,
        category,
        "productImportType",
        "imageDataUrl",
        unit,
        price,
        "costPrice",
        "costCurrency",
        "defaultStorageLocation",
        "defaultExpiryDate",
        vendor,
        note,
        "isActive",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${createMasterProductId()},
        ${product.name},
        ${product.sku},
        ${product.category},
        ${product.productImportType},
        ${product.imageDataUrl},
        ${product.unit},
        ${product.price},
        ${product.costPrice},
        ${product.costCurrency},
        ${product.defaultStorageLocation},
        ${product.defaultExpiryDate},
        ${product.vendor},
        ${product.note},
        ${product.isActive},
        ${timestamp},
        ${timestamp}
      );
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST master-products error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await getCurrentUser();
    if (actor?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await ensureMasterProductTableExists();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "update");
    const id = String(body.id || "").trim();

    if (!id) {
      return NextResponse.json({ error: "ไม่พบรหัสสินค้าใน Master Data" }, { status: 400 });
    }

    if (action === "toggle_active") {
      await sql`
        UPDATE stock_flow_master_products
        SET "isActive" = NOT "isActive", "updatedAt" = ${Date.now()}
        WHERE id = ${id};
      `;

      return NextResponse.json({ success: true });
    }

    const existingRows = await sql`
      SELECT id, name, sku, category, "productImportType", unit
      FROM stock_flow_master_products
      WHERE id = ${id}
      LIMIT 1;
    `;

    if (existingRows.length === 0) {
      return NextResponse.json({ error: "ไม่พบสินค้าใน Master Data" }, { status: 404 });
    }

    const existingProduct = existingRows[0] as {
      id: string;
      name: string;
      sku: string;
      category: string;
      productImportType: string;
      unit: string;
    };

    const product = normalizeProductPayload(body);
    if (!product.name || !product.unit) {
      return NextResponse.json({ error: "กรอกชื่อสินค้าและหน่วยนับให้ครบก่อนบันทึก" }, { status: 400 });
    }

    const duplicateMessage = await validateDuplicateProduct(product, id);
    if (duplicateMessage) {
      return NextResponse.json({ error: duplicateMessage }, { status: 400 });
    }

    const timestamp = Date.now();

    await sql`
      UPDATE stock_flow_master_products
      SET
        name = ${product.name},
        sku = ${product.sku},
        category = ${product.category},
        "productImportType" = ${product.productImportType},
        "imageDataUrl" = ${product.imageDataUrl},
        unit = ${product.unit},
        price = ${product.price},
        "costPrice" = ${product.costPrice},
        "costCurrency" = ${product.costCurrency},
        "defaultStorageLocation" = ${product.defaultStorageLocation},
        "defaultExpiryDate" = ${product.defaultExpiryDate},
        vendor = ${product.vendor},
        note = ${product.note},
        "isActive" = ${product.isActive},
        "updatedAt" = ${timestamp}
      WHERE id = ${id};
    `;

    await sql`
      UPDATE stock_flow_transactions
      SET
        name = ${product.name},
        sku = ${product.sku},
        category = ${product.category},
        "productImportType" = ${product.productImportType},
        "imageDataUrl" = ${product.imageDataUrl},
        unit = ${product.unit},
        price = ${product.price},
        "costPrice" = ${product.costPrice},
        "costCurrency" = ${product.costCurrency},
        requester = CASE
          WHEN (requester IS NULL OR requester = '') AND ${product.defaultStorageLocation} <> ''
            THEN ${product.defaultStorageLocation}
          ELSE requester
        END
      WHERE LOWER(name) = LOWER(${existingProduct.name})
        AND LOWER(COALESCE(sku, '')) = LOWER(${existingProduct.sku || ""})
        AND LOWER(COALESCE(category, '-')) = LOWER(${existingProduct.category || "-"})
        AND LOWER(COALESCE("productImportType", 'resale')) = LOWER(${existingProduct.productImportType || "resale"})
        AND LOWER(COALESCE(unit, '')) = LOWER(${existingProduct.unit || ""});
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PUT master-products error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await getCurrentUser();
    if (actor?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await ensureMasterProductTableExists();
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json({ error: "ไม่พบรหัสสินค้าใน Master Data" }, { status: 400 });
    }

    await sql`DELETE FROM stock_flow_master_products WHERE id = ${id};`;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE master-products error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
