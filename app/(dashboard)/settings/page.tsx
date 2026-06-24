"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataPanel } from "@/components/stock-flow/DataPanel";
import { Table } from "@/components/stock-flow/Table";
import { LOW_STOCK_THRESHOLD } from "@/lib/stock-flow/constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildInventoryMap,
  buildItemKey,
  getLocalDateValue,
  formatDate,
  formatNumber,
  formatCurrency,
  getProductImportTypeLabel,
} from "@/lib/stock-flow/utils";
import type { InventoryItem, ProductImportType } from "@/types/stock-flow";
import { useTransactions } from "../TransactionContext";

const inputClassName = "control-input";

type ProductEditForm = {
  name: string;
  sku: string;
  category: string;
  productImportType: ProductImportType;
  imageDataUrl: string;
  unit: string;
  price: string;
  costPrice: string;
  expiryDate: string;
};

type DbColumn = {
  columnName: string;
  dataType: string;
  isNullable: string;
};

type DbInfo = {
  connected: boolean;
  host: string;
  pingMs: number;
  tableName: string;
  rowCount: number;
  columns: DbColumn[];
  error?: string;
};

type SettingsSectionProps = {
  inventory: InventoryItem[];
  openEditProductDialog: (item: InventoryItem) => void;
  handleDeleteProduct: (item: InventoryItem) => void;
  isLoadingDb: boolean;
  dbInfo: DbInfo | null;
  fetchDbInfo: () => void;
};

function SettingsSection({
  inventory,
  openEditProductDialog,
  handleDeleteProduct,
  isLoadingDb,
  dbInfo,
  fetchDbInfo,
}: SettingsSectionProps) {
  return (
    <section id="settings" className="grid gap-3">
      <section className="dashboard-card">
        <div className="dashboard-panel-header">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-sky-600">
              Product Settings
            </p>
            <h3 className="dashboard-section-title">ตั้งค่ารายการสินค้า</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              จัดการรายการสินค้าและข้อมูลที่ใช้งานในระบบ
            </p>
          </div>
        </div>
      </section>

      <DataPanel
        title="รายการสินค้าทั้งหมด"
        description="รวมสินค้าทั้งซื้อมาขายไปและสินค้า stable ในหน้าเดียว"
      >
        <Table
          headers={[
            "สินค้า",
            "ประเภทสินค้า",
            "หมวดหมู่",
            "หมดอายุใกล้สุด",
            "คงเหลือ",
            "รับเข้า",
            "จ่ายออก",
            "ราคาต้นทุน",
            "มูลค่าคงเหลือ",
            "มูลค่าต้นทุน",
            "จัดการ",
          ]}
          emptyMessage="ยังไม่มีรายการสินค้า"
          columnCount={11}
        >
          {inventory
            .slice()
            .sort((a, b) => {
              const typeCompare = getProductImportTypeLabel(a.productImportType).localeCompare(
                getProductImportTypeLabel(b.productImportType),
                "th"
              );

              return typeCompare || a.name.localeCompare(b.name, "th");
            })
            .map((item) => (
              <tr key={`${item.key}-settings`}>
                <td>
                  <strong className="font-semibold text-[var(--text-strong)]">{item.name}</strong>
                  <div className="text-[12px] text-[var(--text-muted)]">{item.sku || "-"}</div>
                </td>
                <td>{getProductImportTypeLabel(item.productImportType)}</td>
                <td>{item.category}</td>
                <td>{item.nearestExpiryDate ? formatDate(item.nearestExpiryDate) : "-"}</td>
                <td
                  className={`text-right ${
                    item.balance <= LOW_STOCK_THRESHOLD ? "font-semibold text-amber-700" : ""
                  }`}
                >
                  {formatNumber(item.balance)}{" "}
                  <span className="text-[12px] text-[var(--text-subtle)]">{item.unit}</span>
                </td>
                <td className="text-right">
                  {formatNumber(item.totalIn)}{" "}
                  <span className="text-[12px] text-[var(--text-subtle)]">{item.unit}</span>
                </td>
                <td className="text-right">
                  {formatNumber(item.totalOut)}{" "}
                  <span className="text-[12px] text-[var(--text-subtle)]">{item.unit}</span>
                </td>
                <td className="text-right">{formatCurrency(item.costPrice ?? 0)}</td>
                <td className="text-right">{formatCurrency(item.balance * item.price)}</td>
                <td className="text-right">
                  {formatCurrency(item.balance * (item.costPrice ?? 0))}
                </td>
                <td>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditProductDialog(item)}
                    >
                      <Pencil size={14} />
                      แก้ไข
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteProduct(item)}
                    >
                      <Trash2 size={14} />
                      ลบ
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
        </Table>
      </DataPanel>

      <DataPanel
        title="ฐานข้อมูล Neon PostgreSQL (Schema View)"
        description="รายละเอียดคอลัมน์ของตารางข้อมูลและสถานะการเชื่อมต่อแบบเรียลไทม์กับฐานข้อมูล Neon"
      >
        {isLoadingDb ? (
          <div className="p-4 text-center text-sm text-[var(--text-muted)]">
            กำลังดึงข้อมูลฐานข้อมูล...
          </div>
        ) : dbInfo ? (
          <div className="grid gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-[var(--bg-muted)] p-4 border border-[var(--border-muted)]">
              <div className="grid gap-1">
                <span className="text-[12px] text-[var(--text-muted)]">สถานะการเชื่อมต่อ</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      dbInfo.connected ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                  ></span>
                  <strong className="text-sm">
                    {dbInfo.connected ? "เชื่อมต่อแล้ว (Connected)" : "ไม่สามารถเชื่อมต่อได้"}
                  </strong>
                </div>
              </div>
              {dbInfo.connected && (
                <>
                  <div className="grid gap-1">
                    <span className="text-[12px] text-[var(--text-muted)]">โฮสต์ฐานข้อมูล</span>
                    <strong className="text-sm font-mono truncate max-w-[200px] sm:max-w-none">
                      {dbInfo.host}
                    </strong>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-[12px] text-[var(--text-muted)]">ชื่อตาราง</span>
                    <strong className="text-sm font-mono">{dbInfo.tableName}</strong>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-[12px] text-[var(--text-muted)]">จำนวนแถวทั้งหมด</span>
                    <strong className="text-sm font-mono">{formatNumber(dbInfo.rowCount)}</strong>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-[12px] text-[var(--text-muted)]">ความล่าช้า (Ping)</span>
                    <strong className="text-sm font-mono">{dbInfo.pingMs}ms</strong>
                  </div>
                </>
              )}
            </div>

            {dbInfo.error && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-rose-800 text-sm">
                <strong>ข้อผิดพลาด:</strong> {dbInfo.error}
              </div>
            )}

            {dbInfo.connected && dbInfo.columns && dbInfo.columns.length > 0 && (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[500px]">
                  <thead>
                    <tr>
                      <th>ชื่อคอลัมน์ (Column Name)</th>
                      <th>ประเภทข้อมูล (Data Type)</th>
                      <th>อนุญาตค่าว่าง (Nullable)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbInfo.columns.map((col) => (
                      <tr key={col.columnName}>
                        <td className="font-mono font-semibold text-[var(--text-strong)]">
                          {col.columnName}
                        </td>
                        <td className="font-mono text-sky-700">{col.dataType}</td>
                        <td>
                          <span
                            className={`stock-pill ${
                              col.isNullable === "YES" ? "stock-pill-ok" : "stock-pill-warn"
                            }`}
                          >
                            {col.isNullable === "YES" ? "YES (มีค่าว่างได้)" : "NO (ห้ามว่าง)"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end">
              <Button type="button" onClick={fetchDbInfo} disabled={isLoadingDb}>
                รีเฟรชข้อมูลฐานข้อมูล
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-sm text-[var(--text-muted)]">
            ไม่พบข้อมูลฐานข้อมูล
          </div>
        )}
      </DataPanel>
    </section>
  );
}

export default function SettingsPage() {
  const { transactions, refresh } = useTransactions();
  const [dbInfo, setDbInfo] = useState<{
    connected: boolean;
    host: string;
    pingMs: number;
    tableName: string;
    rowCount: number;
    columns: { columnName: string; dataType: string; isNullable: string }[];
    error?: string;
  } | null>(null);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [isEditProductDialogOpen, setIsEditProductDialogOpen] = useState(false);
  const [editingItemKey, setEditingItemKey] = useState("");
  const [productEditForm, setProductEditForm] = useState<ProductEditForm>({
    name: "",
    sku: "",
    category: "",
    productImportType: "resale",
    imageDataUrl: "",
    unit: "",
    price: "0",
    costPrice: "0",
    expiryDate: "",
  });


  async function fetchDbInfo() {
    setIsLoadingDb(true);
    try {
      const res = await fetch("/api/db-info");
      if (res.ok) {
        const data = await res.json();
        setDbInfo(data);
      } else {
        const data = await res.json().catch(() => null);
        setDbInfo({ connected: false, error: data?.error || "Failed to fetch db info" } as any);
      }
    } catch (error: any) {
      setDbInfo({ connected: false, error: error.message } as any);
    } finally {
      setIsLoadingDb(false);
    }
  }

  useEffect(() => {
    fetchDbInfo();
  }, []);

  const inventory = useMemo(() => [...buildInventoryMap(transactions).values()], [transactions]);

  function updateProductEditForm<K extends keyof ProductEditForm>(
    key: K,
    value: ProductEditForm[K]
  ) {
    setProductEditForm((current) => ({ ...current, [key]: value }));
  }

  function openEditProductDialog(item: InventoryItem) {
    setEditingItemKey(item.key);
    setProductEditForm({
      name: item.name,
      sku: item.sku,
      category: item.category,
      productImportType: item.productImportType,
      imageDataUrl: item.imageDataUrl || "",
      unit: item.unit,
      price: String(item.price),
      costPrice: String(item.costPrice ?? 0),
      expiryDate: item.nearestExpiryDate,
    });
    setIsEditProductDialogOpen(true);
  }

  function handleDeleteProduct(item: InventoryItem) {
    const shouldDelete = window.confirm(
      `ต้องการลบสินค้า "${item.name}" ใช่หรือไม่\n\nรายการรับเข้า จ่ายออก และประวัติของสินค้านี้จะถูกลบออกทั้งหมด`
    );

    if (!shouldDelete) {
      return;
    }

    // Pessimistically delete
    fetch(`/api/transactions?itemKey=${encodeURIComponent(item.key)}`, {
      method: "DELETE",
    }).then((res) => {
      if (res.ok) {
        refresh();
        fetchDbInfo();
      } else {
        window.alert("ไม่สามารถลบข้อมูลสินค้าออกจากฐานข้อมูล Neon ได้");
      }
    });
  }

  function handleProductEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextName = productEditForm.name.trim();
    const nextUnit = productEditForm.unit.trim();
    const nextPrice = Number(productEditForm.price || 0);
    const nextCostPrice = Number(productEditForm.costPrice || 0);

    if (!nextName || !nextUnit) {
      window.alert("กรอกชื่อสินค้าและหน่วยนับให้ครบก่อนบันทึก");
      return;
    }

    if (!Number.isFinite(nextPrice) || !Number.isFinite(nextCostPrice)) {
      window.alert("กรอกราคาและราคาต้นทุนเป็นตัวเลขที่ถูกต้องก่อนบันทึก");
      return;
    }

    const updatedData = {
      name: nextName,
      sku: productEditForm.sku.trim(),
      category: productEditForm.category.trim() || "-",
      productImportType: productEditForm.productImportType,
      imageDataUrl: productEditForm.imageDataUrl,
      unit: nextUnit,
      price: Math.max(0, nextPrice),
      costPrice: Math.max(0, nextCostPrice),
      expiryDate: productEditForm.expiryDate,
    };

    fetch("/api/transactions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_product",
        itemKey: editingItemKey,
        updatedData,
      }),
    }).then((res) => {
      if (res.ok) {
        refresh();
        fetchDbInfo();
        setIsEditProductDialogOpen(false);
        setEditingItemKey("");
      } else {
        window.alert("ไม่สามารถอัปเดตข้อมูลสินค้าในฐานข้อมูล Neon ได้");
      }
    });
  }

  function handleProductEditImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      window.alert("เลือกไฟล์รูปภาพเท่านั้น");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      updateProductEditForm("imageDataUrl", result);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  return (
    <>
      <SettingsSection
        inventory={inventory}
        openEditProductDialog={openEditProductDialog}
        handleDeleteProduct={handleDeleteProduct}
        isLoadingDb={isLoadingDb}
        dbInfo={dbInfo}
        fetchDbInfo={fetchDbInfo}
      />

      <Dialog open={isEditProductDialogOpen} onOpenChange={(open) => { if (!open) { setIsEditProductDialogOpen(false); setEditingItemKey(""); } }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[880px]">
          <DialogHeader>
            <DialogTitle>แก้ไขรายการสินค้า</DialogTitle>
            <DialogDescription>
              ปรับรายละเอียดสินค้า ราคาต่อหน่วย และราคาต้นทุนของรายการนี้
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4 p-4" onSubmit={handleProductEditSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                ชื่อสินค้า
                <input
                  value={productEditForm.name}
                  onChange={(event) => updateProductEditForm("name", event.target.value)}
                  className={inputClassName}
                  required
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                รหัสสินค้า
                <input
                  value={productEditForm.sku}
                  onChange={(event) => updateProductEditForm("sku", event.target.value)}
                  className={inputClassName}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                หมวดหมู่
                <input
                  value={productEditForm.category}
                  onChange={(event) => updateProductEditForm("category", event.target.value)}
                  className={inputClassName}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                ประเภทสินค้า
                <select
                  value={productEditForm.productImportType}
                  onChange={(event) =>
                    updateProductEditForm(
                      "productImportType",
                      event.target.value as ProductImportType
                    )
                  }
                  className={inputClassName}
                >
                  <option value="resale">ซื้อมาขายไป</option>
                  <option value="stable">สินค้า stable</option>
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)] sm:col-span-2">
                รูปสินค้า
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProductEditImageChange}
                  className={inputClassName}
                />
              </label>

              {productEditForm.imageDataUrl ? (
                <div className="grid gap-3 sm:col-span-2">
                  <div className="receive-image-preview">
                    <img src={productEditForm.imageDataUrl} alt={productEditForm.name || "รูปสินค้า"} />
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => updateProductEditForm("imageDataUrl", "")}
                    >
                      ลบรูปสินค้า
                    </Button>
                  </div>
                </div>
              ) : null}

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                หน่วยนับ
                <input
                  value={productEditForm.unit}
                  onChange={(event) => updateProductEditForm("unit", event.target.value)}
                  className={inputClassName}
                  required
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                วันหมดอายุ
                <input
                  type="date"
                  value={productEditForm.expiryDate}
                  onChange={(event) => updateProductEditForm("expiryDate", event.target.value)}
                  className={inputClassName}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                ราคาต่อหน่วย
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productEditForm.price}
                  onChange={(event) => updateProductEditForm("price", event.target.value)}
                  className={inputClassName}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                ราคาต้นทุน
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productEditForm.costPrice}
                  onChange={(event) => updateProductEditForm("costPrice", event.target.value)}
                  className={inputClassName}
                />
              </label>
            </div>

            <Button type="submit" className="w-full sm:w-auto">
              บันทึกการแก้ไข
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

