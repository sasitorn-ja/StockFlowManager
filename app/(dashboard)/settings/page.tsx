"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Boxes, Database, FileDown, Pencil, RotateCcw, ShieldCheck, SlidersHorizontal, Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComboboxSelect } from "@/components/ui/combobox-select";
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
  getLocalDateValue,
  formatDate,
  formatNumber,
  formatCurrency,
  getProductImportTypeLabel,
  sanitizeSku,
} from "@/lib/stock-flow/utils";
import type { InventoryItem, ProductImportType } from "@/types/stock-flow";
import { useTransactions } from "../TransactionContext";

const inputClassName = "control-input";
const SETTINGS_STORAGE_KEY = "stock-flow-manager-system-settings-v1";

type AppSettings = {
  lowStockThreshold: string;
  expiryWarningDays: string;
  issuePrefix: string;
  receivePrefix: string;
  approvalMode: "required" | "manager_only" | "off";
  allocationMode: "fefo" | "fifo";
  requireEmployeeConfirmation: boolean;
  allowNegativeStock: boolean;
};

const defaultAppSettings: AppSettings = {
  lowStockThreshold: "5",
  expiryWarningDays: "90",
  issuePrefix: "REQ",
  receivePrefix: "IN",
  approvalMode: "required",
  allocationMode: "fefo",
  requireEmployeeConfirmation: true,
  allowNegativeStock: false,
};

const approvalModeOptions = [
  { value: "required", label: "ต้องอนุมัติทุกใบเบิก" },
  { value: "manager_only", label: "เฉพาะผู้จัดการ/แอดมิน" },
  { value: "off", label: "ไม่ต้องอนุมัติ" },
];

const allocationModeOptions = [
  { value: "fefo", label: "FEFO - หมดอายุก่อนออกก่อน" },
  { value: "fifo", label: "FIFO - รับเข้าก่อนออกก่อน" },
];

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
  transactionsCount: number;
  appSettings: AppSettings;
  updateAppSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetAppSettings: () => void;
  exportBackup: (format: "json" | "csv") => void;
  openEditProductDialog: (item: InventoryItem) => void;
  handleDeleteProduct: (item: InventoryItem) => void;
  isLoadingDb: boolean;
  dbInfo: DbInfo | null;
  fetchDbInfo: () => void;
};

function SettingsSection({
  inventory,
  transactionsCount,
  appSettings,
  updateAppSetting,
  resetAppSettings,
  exportBackup,
  openEditProductDialog,
  handleDeleteProduct,
  isLoadingDb,
  dbInfo,
  fetchDbInfo,
}: SettingsSectionProps) {
  const activeProducts = inventory.filter((item) => item.balance > 0).length;
  const lowStockProducts = inventory.filter(
    (item) => item.balance > 0 && item.balance <= Number(appSettings.lowStockThreshold || 0)
  ).length;

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
              ควบคุมเกณฑ์แจ้งเตือน ขั้นตอนอนุมัติ การสำรองข้อมูล และข้อมูลระบบหลัก
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={resetAppSettings}>
            <RotateCcw size={15} />
            คืนค่าเริ่มต้น
          </Button>
        </div>
      </section>

      <section className="settings-overview-grid">
        <article className="settings-summary-card">
          <div className="settings-summary-icon">
            <Boxes size={18} />
          </div>
          <div>
            <span>สินค้าที่มีสต๊อก</span>
            <strong>{formatNumber(activeProducts)}</strong>
            <p>จากสินค้าในคลังทั้งหมด {formatNumber(inventory.length)} รายการ</p>
          </div>
        </article>
        <article className="settings-summary-card">
          <div className="settings-summary-icon settings-summary-icon-amber">
            <SlidersHorizontal size={18} />
          </div>
          <div>
            <span>ใกล้สต๊อกต่ำ</span>
            <strong>{formatNumber(lowStockProducts)}</strong>
            <p>เกณฑ์ปัจจุบันไม่เกิน {formatNumber(Number(appSettings.lowStockThreshold || 0))} หน่วย</p>
          </div>
        </article>
        <article className="settings-summary-card">
          <div className="settings-summary-icon settings-summary-icon-emerald">
            <Workflow size={18} />
          </div>
          <div>
            <span>รายการเคลื่อนไหว</span>
            <strong>{formatNumber(transactionsCount)}</strong>
            <p>ใช้สำหรับ export และตรวจสอบย้อนหลัง</p>
          </div>
        </article>
      </section>

      <section className="settings-grid">
        <DataPanel
          title="เกณฑ์แจ้งเตือนคลัง"
          description="ตั้งค่าที่ใช้ประเมินสต๊อกต่ำและสินค้าใกล้หมดอายุ"
        >
          <div className="settings-form-grid">
            <label className="settings-field">
              <span>เกณฑ์สต๊อกต่ำ</span>
              <input
                className={inputClassName}
                type="number"
                min="0"
                value={appSettings.lowStockThreshold}
                onChange={(event) => updateAppSetting("lowStockThreshold", event.target.value)}
              />
            </label>
            <label className="settings-field">
              <span>เตือนก่อนหมดอายุ (วัน)</span>
              <input
                className={inputClassName}
                type="number"
                min="1"
                value={appSettings.expiryWarningDays}
                onChange={(event) => updateAppSetting("expiryWarningDays", event.target.value)}
              />
            </label>
          </div>
        </DataPanel>

        <DataPanel
          title="Workflow รับเข้า-เบิกจ่าย"
          description="กำหนดรูปแบบการอนุมัติและการเลือกล็อตสินค้า"
        >
          <div className="settings-form-grid">
            <label className="settings-field">
              <span>การอนุมัติใบเบิก</span>
              <ComboboxSelect
                value={appSettings.approvalMode}
                onValueChange={(value) => updateAppSetting("approvalMode", value as AppSettings["approvalMode"])}
                options={approvalModeOptions}
                className={inputClassName}
                searchPlaceholder="ค้นหารูปแบบอนุมัติ..."
              />
            </label>
            <label className="settings-field">
              <span>การเลือกล็อต</span>
              <ComboboxSelect
                value={appSettings.allocationMode}
                onValueChange={(value) => updateAppSetting("allocationMode", value as AppSettings["allocationMode"])}
                options={allocationModeOptions}
                className={inputClassName}
                searchPlaceholder="ค้นหาวิธีเลือกล็อต..."
              />
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={appSettings.requireEmployeeConfirmation}
                onChange={(event) => updateAppSetting("requireEmployeeConfirmation", event.target.checked)}
              />
              <span>ให้พนักงานยืนยันรับของหลังอนุมัติ</span>
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={appSettings.allowNegativeStock}
                onChange={(event) => updateAppSetting("allowNegativeStock", event.target.checked)}
              />
              <span>อนุญาตให้เบิกเกินสต๊อก</span>
            </label>
          </div>
        </DataPanel>

        <DataPanel
          title="เลขเอกสารและข้อมูลสำรอง"
          description="ตั้ง prefix เอกสารและ export ข้อมูลใช้งาน"
        >
          <div className="settings-form-grid">
            <label className="settings-field">
              <span>Prefix ใบเบิก</span>
              <input
                className={inputClassName}
                value={appSettings.issuePrefix}
                onChange={(event) => updateAppSetting("issuePrefix", event.target.value.toUpperCase())}
              />
            </label>
            <label className="settings-field">
              <span>Prefix ใบรับเข้า</span>
              <input
                className={inputClassName}
                value={appSettings.receivePrefix}
                onChange={(event) => updateAppSetting("receivePrefix", event.target.value.toUpperCase())}
              />
            </label>
            <div className="settings-action-row">
              <Button type="button" variant="secondary" onClick={() => exportBackup("json")}>
                <FileDown size={16} />
                Export JSON
              </Button>
              <Button type="button" variant="secondary" onClick={() => exportBackup("csv")}>
                <FileDown size={16} />
                Export CSV
              </Button>
            </div>
          </div>
        </DataPanel>

        <DataPanel
          title="ความปลอดภัย"
          description="สรุปแนวทางป้องกันข้อมูลสำคัญในระบบ"
        >
          <div className="settings-security-list">
            <div>
              <ShieldCheck size={17} />
              <span>ไฟล์ `.env` ถูก ignore และไม่ควรนำขึ้น GitHub</span>
            </div>
            <div>
              <Database size={17} />
              <span>ระบบใช้งาน Supabase table ชุด `stock_flow_*` แยกจากระบบอื่น</span>
            </div>
          </div>
        </DataPanel>
      </section>

      <DataPanel
        title="รายการสินค้าทั้งหมด"
        description="รวมสินค้าทั้งซื้อมาขายไปและสินค้าเข้าสต็อกในหน้าเดียว"
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
        title="ฐานข้อมูล Supabase PostgreSQL (Schema View)"
        description="รายละเอียดคอลัมน์ของตารางข้อมูลและสถานะการเชื่อมต่อแบบเรียลไทม์กับฐานข้อมูล Supabase PostgreSQL"
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
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);

  useEffect(() => {
    try {
      const storedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!storedSettings) return;

      setAppSettings({
        ...defaultAppSettings,
        ...(JSON.parse(storedSettings) as Partial<AppSettings>),
      });
    } catch (error) {
      console.error("Failed to load system settings", error);
    }
  }, []);

  function persistAppSettings(nextSettings: AppSettings) {
    setAppSettings(nextSettings);
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  }

  function updateAppSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    persistAppSettings({ ...appSettings, [key]: value });
  }

  function resetAppSettings() {
    persistAppSettings(defaultAppSettings);
  }

  function downloadTextFile(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportBackup(format: "json" | "csv") {
    const exportDate = getLocalDateValue();

    if (format === "json") {
      downloadTextFile(
        `stock-flow-backup-${exportDate}.json`,
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            settings: appSettings,
            transactions,
            inventory,
          },
          null,
          2
        ),
        "application/json;charset=utf-8"
      );
      return;
    }

    const csvHeaders = [
      "name",
      "sku",
      "category",
      "productImportType",
      "unit",
      "balance",
      "totalIn",
      "totalOut",
      "price",
      "costPrice",
      "nearestExpiryDate",
    ];
    const csvRows = inventory.map((item) =>
      csvHeaders
        .map((key) => {
          const value = String(item[key as keyof InventoryItem] ?? "");
          return `"${value.replaceAll('"', '""')}"`;
        })
        .join(",")
    );

    downloadTextFile(
      `stock-flow-inventory-${exportDate}.csv`,
      [csvHeaders.join(","), ...csvRows].join("\n"),
      "text/csv;charset=utf-8"
    );
  }

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
      sku: sanitizeSku(item.sku),
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
        window.alert("ไม่สามารถลบข้อมูลสินค้าออกจากฐานข้อมูล Supabase PostgreSQL ได้");
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
      sku: sanitizeSku(productEditForm.sku.trim()),
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
        window.alert("ไม่สามารถอัปเดตข้อมูลสินค้าในฐานข้อมูล Supabase PostgreSQL ได้");
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
        transactionsCount={transactions.length}
        appSettings={appSettings}
        updateAppSetting={updateAppSetting}
        resetAppSettings={resetAppSettings}
        exportBackup={exportBackup}
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
                  onChange={(event) => updateProductEditForm("sku", sanitizeSku(event.target.value))}
                  className={inputClassName}
                  inputMode="text"
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
                <ComboboxSelect
                  value={productEditForm.productImportType}
                  onValueChange={(value) =>
                    updateProductEditForm(
                      "productImportType",
                      value as ProductImportType
                    )
                  }
                  options={[
                    { value: "resale", label: "ซื้อมาขายไป" },
                    { value: "stable", label: "สินค้าเข้าสต็อก" },
                  ]}
                  className={inputClassName}
                  searchPlaceholder="ค้นหาประเภทสินค้า..."
                />
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
