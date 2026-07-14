"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Boxes, Pencil, Plus, RotateCcw, SlidersHorizontal, Trash2, Workflow } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import {
  getClientMasterProducts,
  invalidateClientMasterProductsCache,
} from "@/lib/dashboard-client-cache";
import { Button } from "@/components/ui/button";
import { ComboboxSelect } from "@/components/ui/combobox-select";
import { DataPanel } from "@/components/stock-flow/DataPanel";
import { Table } from "@/components/stock-flow/Table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildInventoryMap,
  buildInventoryLotMap,
  formatDate,
  formatNumber,
  formatCurrency,
  getStockTargetStatus,
  getProductImportTypeLabel,
  matchesMasterProduct,
  sanitizeSku,
} from "@/lib/stock-flow/utils";
import type { InventoryItem, ProductImportType, ProductMaster, Transaction } from "@/types/stock-flow";
import { useTransactions } from "../TransactionContext";
import { defaultAppSettings, type AppSettings } from "@/lib/app-settings-shared";

const inputClassName = "control-input";

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
  minStock: string;
  maxStock: string;
  expiryDate: string;
};

type SettingsSectionProps = {
  inventory: InventoryItem[];
  masterProducts: ProductMaster[];
  transactions: Transaction[];
  transactionsCount: number;
  appSettings: AppSettings;
  updateAppSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetAppSettings: () => void;
  openEditProductDialog: (item: InventoryItem) => void;
  handleDeleteProduct: (item: InventoryItem) => void;
};

function SettingsSection({
  inventory,
  masterProducts,
  transactions,
  transactionsCount,
  appSettings,
  updateAppSetting,
  resetAppSettings,
  openEditProductDialog,
  handleDeleteProduct,
}: SettingsSectionProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState("");
  const summarizedInventory = useMemo(
    () =>
      inventory.map((item) => {
        const matchedProduct = masterProducts.find((product) => matchesMasterProduct(item, product));
        const minStock = matchedProduct?.minStock ?? 0;
        const maxStock = matchedProduct?.maxStock ?? 0;

        return {
          ...item,
          minStock,
          maxStock,
          stockTargetStatus: getStockTargetStatus(item.balance, minStock, maxStock),
        };
      }),
    [inventory, masterProducts]
  );
  const activeProducts = inventory.filter((item) => item.balance > 0).length;
  const lowStockProducts = inventory.filter(
    (item) => item.balance > 0 && item.balance <= Number(appSettings.lowStockThreshold || 0)
  ).length;
  const categoryStats = useMemo(() => {
    return categories.map((category) => {
      const productCount = inventory.filter((item) => item.category === category).length;
      const movementCount = transactions.filter((item) => item.category === category).length;
      const totalBalance = inventory
        .filter((item) => item.category === category)
        .reduce((sum, item) => sum + item.balance, 0);

      return {
        category,
        productCount,
        movementCount,
        totalBalance,
      };
    });
  }, [categories, inventory, transactions]);

  async function loadCategories() {
    const response = await fetch(withBasePath("/api/categories"), { cache: "no-store" });
    if (response.ok) setCategories(await response.json());
  }

  useEffect(() => { loadCategories().catch(console.error); }, []);

  async function addCategory() {
    if (!newCategory.trim()) return;
    const response = await fetch(withBasePath("/api/categories"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCategory }) });
    if (!response.ok) return window.alert("ไม่สามารถเพิ่มหมวดหมู่ได้");
    setNewCategory("");
    await loadCategories();
  }

  async function saveCategory(oldName: string) {
    if (!editingCategoryValue.trim()) return;
    const nextName = editingCategoryValue.trim();
    const shouldSave = window.confirm(
      `เปลี่ยนชื่อหมวดหมู่ "${oldName}" เป็น "${nextName}" ใช่หรือไม่\n\nระบบจะอัปเดตชื่อหมวดหมู่นี้ในสินค้าและประวัติรับเข้า-เบิกจ่ายทั้งหมดที่เชื่อมอยู่`
    );
    if (!shouldSave) return;
    const response = await fetch(withBasePath("/api/categories"), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oldName, newName: editingCategoryValue }) });
    if (!response.ok) return window.alert("ไม่สามารถแก้ไขชื่อหมวดหมู่ได้");
    setEditingCategory(null);
    setEditingCategoryValue("");
    await loadCategories();
  }

  return (
    <section id="settings" className="grid gap-3">
      <section className="dashboard-card">
        <div className="dashboard-panel-header">
          <div>
            <h3 className="dashboard-section-title">ตั้งค่ารายการสินค้า</h3>
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

      </section>

      <DataPanel
        title="ศูนย์กลางหมวดหมู่สินค้า"
        description="เพิ่มหรือเปลี่ยนชื่อหมวดหมู่จากจุดเดียว แล้วระบบจะอัปเดตข้อมูลที่เชื่อมอยู่ทั้งหมด"
      >
        <div className="category-settings">
          <div className="category-settings-note">
            หมวดหมู่ที่สร้างหรือเปลี่ยนชื่อจากหน้านี้ จะถูกใช้ร่วมกันในฟอร์มรับเข้า สินค้าในคลัง ข้อมูลสินค้า และประวัติรับเข้า-เบิกจ่ายทั้งหมด
          </div>
          <div className="category-settings-add">
            <input className={inputClassName} value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="ชื่อหมวดหมู่ใหม่" />
            <Button type="button" onClick={addCategory}><Plus size={16} />เพิ่มหมวดหมู่</Button>
          </div>
          <div className="category-settings-list">
            {categoryStats.map((item) => <div key={item.category}>
              <div className="category-settings-info">
                {editingCategory === item.category ? <input className={inputClassName} value={editingCategoryValue} onChange={(event) => setEditingCategoryValue(event.target.value)} autoFocus /> : <strong>{item.category}</strong>}
                <small>
                  {formatNumber(item.productCount)} สินค้า · {formatNumber(item.movementCount)} รายการเคลื่อนไหว · คงเหลือรวม {formatNumber(item.totalBalance)}
                </small>
              </div>
              <div>
                {editingCategory === item.category ? <Button type="button" size="sm" onClick={() => saveCategory(item.category)}>บันทึก</Button> : <Button type="button" size="sm" variant="secondary" onClick={() => { setEditingCategory(item.category); setEditingCategoryValue(item.category); }}><Pencil size={14} />เปลี่ยนชื่อทั้งระบบ</Button>}
              </div>
            </div>)}
          </div>
        </div>
      </DataPanel>

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
            "เป้าหมายสต๊อก",
            "สถานะสต๊อก",
            "รับเข้า",
            "จ่ายออก",
            "ราคาต้นทุน",
            "มูลค่าคงเหลือ",
            "มูลค่าต้นทุน",
            "จัดการ",
          ]}
          emptyMessage="ยังไม่มีรายการสินค้า"
          columnCount={13}
        >
          {summarizedInventory
            .slice()
            .sort((a, b) => {
              const typeCompare = getProductImportTypeLabel(a.productImportType).localeCompare(
                getProductImportTypeLabel(b.productImportType),
                "th"
              );
              const categoryCompare = a.category.localeCompare(b.category, "th");

              return typeCompare || categoryCompare || a.name.localeCompare(b.name, "th");
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
                    item.balance <= Number(appSettings.lowStockThreshold || 0) ? "font-semibold text-amber-700" : ""
                  }`}
                >
                  {formatNumber(item.balance)}{" "}
                  <span className="text-[12px] text-[var(--text-subtle)]">{item.unit}</span>
                </td>
                <td>
                  <div className="master-data-stack-cell">
                    <strong>min {formatNumber(item.minStock)}</strong>
                    <span>max {formatNumber(item.maxStock)}</span>
                  </div>
                </td>
                <td>
                  <span
                    className={`stock-pill ${
                      item.stockTargetStatus === "low"
                        ? "stock-pill-danger"
                        : item.stockTargetStatus === "high"
                          ? "stock-pill-warn"
                          : item.stockTargetStatus === "normal"
                            ? "stock-pill-ok"
                            : ""
                    }`}
                  >
                    {item.stockTargetStatus === "low"
                      ? "ต่ำกว่า min"
                      : item.stockTargetStatus === "high"
                        ? "สูงกว่า max"
                        : item.stockTargetStatus === "normal"
                          ? "อยู่ในช่วง"
                          : "ยังไม่ตั้งค่า"}
                  </span>
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
                      เลือกล็อต/แก้ไข
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteProduct(item)}
                    >
                      <Trash2 size={14} />
                      ปิดใช้งาน
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
        </Table>
      </DataPanel>

    </section>
  );
}

export default function SettingsPage() {
  const { transactions, refresh } = useTransactions();
  const [isEditProductDialogOpen, setIsEditProductDialogOpen] = useState(false);
  const [editingItemKey, setEditingItemKey] = useState("");
  const [editingMasterProductId, setEditingMasterProductId] = useState("");
  const [selectedLotKey, setSelectedLotKey] = useState("");
  const [masterProducts, setMasterProducts] = useState<ProductMaster[]>([]);
  const [productEditForm, setProductEditForm] = useState<ProductEditForm>({
    name: "",
    sku: "",
    category: "",
    productImportType: "resale",
    imageDataUrl: "",
    unit: "",
    price: "0",
    costPrice: "0",
    minStock: "0",
    maxStock: "0",
    expiryDate: "",
  });
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);

  useEffect(() => {
    fetch(withBasePath("/api/settings"), { cache: "no-store" })
      .then((response) => response.ok ? response.json() : defaultAppSettings)
      .then((settings) => setAppSettings({ ...defaultAppSettings, ...settings }))
      .catch((error) => {
      console.error("Failed to load system settings", error);
      });
    getClientMasterProducts()
      .then((products) => setMasterProducts(products))
      .catch(() => setMasterProducts([]));
  }, []);

  async function persistAppSettings(nextSettings: AppSettings) {
    setAppSettings(nextSettings);
    const response = await fetch(withBasePath("/api/settings"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextSettings),
    });
    if (response.ok) {
      setAppSettings(await response.json());
    } else {
      window.alert("ไม่สามารถบันทึกตั้งค่าระบบได้");
    }
  }

  function updateAppSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    persistAppSettings({ ...appSettings, [key]: value });
  }

  function resetAppSettings() {
    fetch(withBasePath("/api/settings"), { method: "DELETE" })
      .then((response) => response.ok ? response.json() : defaultAppSettings)
      .then((settings) => setAppSettings(settings))
      .catch(() => window.alert("ไม่สามารถคืนค่าเริ่มต้นได้"));
  }

  const inventory = useMemo(() => [...buildInventoryMap(transactions).values()], [transactions]);
  const inventoryLots = useMemo(
    () =>
      [...buildInventoryLotMap(transactions).values()].sort(
        (a, b) =>
          a.receivedDate.localeCompare(b.receivedDate) ||
          a.expiryDate.localeCompare(b.expiryDate) ||
          a.createdAt - b.createdAt
      ),
    [transactions]
  );
  const editingLots = useMemo(
    () => inventoryLots.filter((lot) => lot.baseItemKey === editingItemKey),
    [editingItemKey, inventoryLots]
  );
  const editingLotOptions = useMemo(
    () =>
      editingLots.map((lot, index) => ({
        value: lot.key,
        label: `ล็อต ${index + 1} · รับเข้า ${formatDate(lot.receivedDate)} · ${
          lot.expiryDate ? `หมดอายุ ${formatDate(lot.expiryDate)}` : "ไม่ระบุวันหมดอายุ"
        } · คงเหลือ ${formatNumber(lot.balance)} ${lot.unit}`,
      })),
    [editingLots]
  );

  function updateProductEditForm<K extends keyof ProductEditForm>(
    key: K,
    value: ProductEditForm[K]
  ) {
    setProductEditForm((current) => ({ ...current, [key]: value }));
  }

  function openEditProductDialog(item: InventoryItem) {
    const firstLot = inventoryLots.find((lot) => lot.baseItemKey === item.key);
    const matchedProduct = masterProducts.find((product) => matchesMasterProduct(item, product));
    setEditingItemKey(item.key);
    setEditingMasterProductId(matchedProduct?.id || "");
    setSelectedLotKey(firstLot?.key || "");
    setProductEditForm({
      name: item.name,
      sku: sanitizeSku(item.sku),
      category: item.category,
      productImportType: item.productImportType,
      imageDataUrl: item.imageDataUrl || "",
      unit: item.unit,
      price: String(firstLot?.price ?? item.price),
      costPrice: String(firstLot?.costPrice ?? item.costPrice ?? 0),
      minStock: String(matchedProduct?.minStock ?? 0),
      maxStock: String(matchedProduct?.maxStock ?? 0),
      expiryDate: firstLot?.expiryDate ?? item.nearestExpiryDate,
    });
    setIsEditProductDialogOpen(true);
  }

  function selectEditingLot(lotKey: string) {
    const lot = inventoryLots.find((item) => item.key === lotKey);
    if (!lot) return;

    setSelectedLotKey(lotKey);
    setProductEditForm((current) => ({
      ...current,
      price: String(lot.price),
      costPrice: String(lot.costPrice ?? 0),
      expiryDate: lot.expiryDate,
    }));
  }

  function handleDeleteProduct(item: InventoryItem) {
    const shouldDelete = window.confirm(
      `ต้องการปิดใช้งานสินค้า "${item.name}" ใช่หรือไม่\n\nสินค้านี้จะไม่แสดงในหน้าเบิก แต่ประวัติรับเข้า-เบิกจ่ายจะยังอยู่ครบ`
    );

    if (!shouldDelete) {
      return;
    }

    fetch(withBasePath("/api/master-products"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_active_by_key",
        name: item.name,
        sku: item.sku,
        category: item.category,
        productImportType: item.productImportType,
        unit: item.unit,
        isActive: false,
      }),
    }).then((res) => {
      if (res.ok) {
        refresh();
      } else {
        window.alert("ไม่สามารถปิดใช้งานสินค้าได้");
      }
    });
  }

  function handleProductEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextName = productEditForm.name.trim();
    const nextUnit = productEditForm.unit.trim();
    const nextPrice = Number(productEditForm.price || 0);
    const nextCostPrice = Number(productEditForm.costPrice || 0);
    const nextMinStock = Math.max(0, Math.floor(Number(productEditForm.minStock || 0)));
    const nextMaxStock = Math.max(0, Math.floor(Number(productEditForm.maxStock || 0)));

    if (!nextName || !nextUnit) {
      window.alert("กรอกชื่อสินค้าและหน่วยนับให้ครบก่อนบันทึก");
      return;
    }

    if (!Number.isFinite(nextPrice) || !Number.isFinite(nextCostPrice)) {
      window.alert("กรอกราคาและราคาต้นทุนเป็นตัวเลขที่ถูกต้องก่อนบันทึก");
      return;
    }

    if (nextMaxStock > 0 && nextMinStock > nextMaxStock) {
      window.alert("จำนวนสต๊อกต่ำสุดต้องไม่มากกว่าจำนวนสต๊อกสูงสุด");
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
    const selectedLot = inventoryLots.find((lot) => lot.key === selectedLotKey);

    if (!selectedLot) {
      window.alert("กรุณาเลือกล็อตที่ต้องการแก้ไข");
      return;
    }

    Promise.all([
      fetch(withBasePath("/api/transactions"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_product",
          itemKey: editingItemKey,
          lotExpiryDate: selectedLot.expiryDate,
          updatedData,
        }),
      }),
      editingMasterProductId
        ? fetch(withBasePath("/api/master-products"), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: editingMasterProductId,
              name: nextName,
              sku: sanitizeSku(productEditForm.sku.trim()),
              category: productEditForm.category.trim() || "-",
              productImportType: productEditForm.productImportType,
              imageDataUrl: productEditForm.imageDataUrl,
              unit: nextUnit,
              price: Math.max(0, nextPrice),
              costPrice: Math.max(0, nextCostPrice),
              costCurrency:
                masterProducts.find((product) => product.id === editingMasterProductId)?.costCurrency ?? "THB",
              minStock: nextMinStock,
              maxStock: nextMaxStock,
              defaultStorageLocation:
                masterProducts.find((product) => product.id === editingMasterProductId)?.defaultStorageLocation ?? "",
              defaultExpiryDate: productEditForm.expiryDate,
              vendor: masterProducts.find((product) => product.id === editingMasterProductId)?.vendor ?? "",
              note: masterProducts.find((product) => product.id === editingMasterProductId)?.note ?? "",
              isActive: masterProducts.find((product) => product.id === editingMasterProductId)?.isActive ?? true,
            }),
          })
        : Promise.resolve(new Response(null, { status: 204 })),
    ]).then(async ([transactionRes, masterRes]) => {
      if (!transactionRes.ok || !masterRes.ok) {
        window.alert("ไม่สามารถอัปเดตข้อมูลสินค้าในฐานข้อมูลได้");
        return;
      }

      invalidateClientMasterProductsCache();
      const products = await getClientMasterProducts().catch(() => []);
      setMasterProducts(products);
      refresh();
      setIsEditProductDialogOpen(false);
      setEditingItemKey("");
      setEditingMasterProductId("");
      setSelectedLotKey("");
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
        masterProducts={masterProducts}
        transactions={transactions}
        transactionsCount={transactions.length}
        appSettings={appSettings}
        updateAppSetting={updateAppSetting}
        resetAppSettings={resetAppSettings}
        openEditProductDialog={openEditProductDialog}
        handleDeleteProduct={handleDeleteProduct}
      />

      <Dialog open={isEditProductDialogOpen} onOpenChange={(open) => { if (!open) { setIsEditProductDialogOpen(false); setEditingItemKey(""); setEditingMasterProductId(""); setSelectedLotKey(""); } }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[880px]">
          <DialogHeader>
            <DialogTitle>แก้ไขสินค้าและล็อต</DialogTitle>
            <DialogDescription>
              เลือกล็อตก่อนแก้ไขวันหมดอายุ ราคา และราคาต้นทุน
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4 p-4" onSubmit={handleProductEditSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)] sm:col-span-2">
                ล็อตที่ต้องการแก้ไข
                <ComboboxSelect
                  value={selectedLotKey}
                  onValueChange={selectEditingLot}
                  options={editingLotOptions}
                  className={inputClassName}
                  searchPlaceholder="ค้นหาล็อต..."
                  placeholder="เลือกล็อต"
                />
              </label>
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

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                หมวดหมู่
                <input
                  value={productEditForm.category}
                  onChange={(event) => updateProductEditForm("category", event.target.value)}
                  className={inputClassName}
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

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                จำนวนต่ำสุด (min)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={productEditForm.minStock}
                  onChange={(event) => updateProductEditForm("minStock", event.target.value)}
                  className={inputClassName}
                  placeholder="0 = ยังไม่กำหนด"
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                จำนวนสูงสุด (max)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={productEditForm.maxStock}
                  onChange={(event) => updateProductEditForm("maxStock", event.target.value)}
                  className={inputClassName}
                  placeholder="0 = ยังไม่กำหนด"
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
