"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, PackageCheck, Pencil, Plus, Search, ShieldAlert, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComboboxSelect } from "@/components/ui/combobox-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataPanel } from "@/components/stock-flow/DataPanel";
import { Table } from "@/components/stock-flow/Table";
import {
  buildInventoryMap,
  formatCurrency,
  formatNumber,
  getProductImportTypeLabel,
  sanitizeSku,
} from "@/lib/stock-flow/utils";
import type { CostCurrency, InventoryItem, ProductImportType, ProductMaster } from "@/types/stock-flow";
import { useTransactions } from "../TransactionContext";

type UserRole = "employee" | "manager" | "admin";

type ProductMasterForm = {
  name: string;
  sku: string;
  category: string;
  productImportType: ProductImportType;
  imageDataUrl: string;
  unit: string;
  price: string;
  costPrice: string;
  costCurrency: CostCurrency;
  defaultStorageLocation: string;
  defaultExpiryDate: string;
  vendor: string;
  note: string;
  isActive: boolean;
};

const inputClassName = "control-input";

const defaultForm: ProductMasterForm = {
  name: "",
  sku: "",
  category: "",
  productImportType: "resale",
  imageDataUrl: "",
  unit: "",
  price: "0",
  costPrice: "0",
  costCurrency: "THB",
  defaultStorageLocation: "",
  defaultExpiryDate: "",
  vendor: "",
  note: "",
  isActive: true,
};

const costCurrencyOptions: { value: CostCurrency; label: string }[] = [
  { value: "THB", label: "บาท (THB)" },
  { value: "JPY", label: "เยน (JPY)" },
  { value: "CNY", label: "หยวน (CNY)" },
  { value: "USD", label: "ดอลลาร์ (USD)" },
];

const productImportTypeOptions: { value: ProductImportType; label: string }[] = [
  { value: "resale", label: "ซื้อมาขายไป" },
  { value: "stable", label: "สินค้าเข้าสต็อก" },
];

function buildMasterProductKey(product: {
  name: string;
  sku: string;
  category: string;
  productImportType: ProductImportType;
  unit: string;
}) {
  return [
    product.name.trim().toLowerCase(),
    product.sku.trim().toLowerCase(),
    product.category.trim().toLowerCase(),
    product.productImportType.trim().toLowerCase(),
    product.unit.trim().toLowerCase(),
  ].join("::");
}

function findInventoryMatch(masterProduct: ProductMaster, inventory: InventoryItem[]) {
  return (
    inventory.find(
      (item) =>
        item.sku.trim().toLowerCase() === masterProduct.sku.trim().toLowerCase() &&
        item.sku.trim().length > 0
    ) ??
    inventory.find(
      (item) =>
        item.name.trim().toLowerCase() === masterProduct.name.trim().toLowerCase() &&
        item.category.trim().toLowerCase() === masterProduct.category.trim().toLowerCase() &&
        item.unit.trim().toLowerCase() === masterProduct.unit.trim().toLowerCase() &&
        item.productImportType === masterProduct.productImportType
    ) ??
    null
  );
}

function buildInventoryDerivedProductMasters(inventory: InventoryItem[]): ProductMaster[] {
  return inventory.map((item, index) => ({
    id: `inventory-fallback-${index}-${item.key}`,
    name: item.name,
    sku: item.sku,
    category: item.category,
    productImportType: item.productImportType,
    imageDataUrl: item.imageDataUrl || "",
    unit: item.unit,
    price: item.price ?? 0,
    costPrice: item.costPrice ?? 0,
    costCurrency: item.costCurrency ?? "THB",
    defaultStorageLocation: "",
    defaultExpiryDate: item.nearestExpiryDate || "",
    vendor: "",
    note: "",
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
}

export default function MasterDataPage() {
  const { transactions, refresh } = useTransactions();
  const [userRole, setUserRole] = useState<UserRole>("employee");
  const [masterProducts, setMasterProducts] = useState<ProductMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<ProductMasterForm>(defaultForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const isSyncingMissingProductsRef = useRef(false);

  const inventory = useMemo(() => [...buildInventoryMap(transactions).values()], [transactions]);
  const masterProductKeys = useMemo(
    () => new Set(masterProducts.map((product) => buildMasterProductKey(product))),
    [masterProducts]
  );
  const inventoryDerivedProducts = useMemo(
    () => buildInventoryDerivedProductMasters(inventory),
    [inventory]
  );
  const effectiveMasterProducts = useMemo(
    () =>
      masterProducts
        .slice()
        .sort((left, right) => {
          if (left.isActive !== right.isActive) {
            return left.isActive ? -1 : 1;
          }

          return (
            Number(right.updatedAt || 0) - Number(left.updatedAt || 0) ||
            left.name.localeCompare(right.name, "th")
          );
        }),
    [masterProducts]
  );

  const summarizedProducts = useMemo(() => {
    return effectiveMasterProducts.map((product) => ({
      ...product,
      inventoryItem: findInventoryMatch(product, inventory),
    }));
  }, [effectiveMasterProducts, inventory]);

  const activeProductCount = summarizedProducts.filter((product) => product.isActive).length;
  const activeCategoryCount = new Set(
    summarizedProducts.filter((product) => product.isActive).map((product) => product.category)
  ).size;
  const stockedProductCount = summarizedProducts.filter(
    (product) => (product.inventoryItem?.balance ?? 0) > 0
  ).length;
  const categorySummary = useMemo(() => {
    const categoryMap = new Map<string, number>();

    summarizedProducts
      .filter((product) => product.isActive)
      .forEach((product) => {
        const categoryName = product.category?.trim() || "-";
        categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + 1);
      });

    return Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "th"));
  }, [summarizedProducts]);
  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return summarizedProducts.filter((product) => {
      if (statusFilter === "active" && !product.isActive) {
        return false;
      }

      if (statusFilter === "inactive" && product.isActive) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        product.name,
        product.sku,
        product.category,
        product.defaultStorageLocation,
        product.vendor,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [searchTerm, statusFilter, summarizedProducts]);

  useEffect(() => {
    const syncRole = () => {
      const storedRole = localStorage.getItem("current_role");
      if (storedRole === "admin" || storedRole === "manager" || storedRole === "employee") {
        setUserRole(storedRole);
        return;
      }

      setUserRole("employee");
    };

    syncRole();
    window.addEventListener("current-user-changed", syncRole);

    return () => window.removeEventListener("current-user-changed", syncRole);
  }, []);

  useEffect(() => {
    fetchMasterProducts();
  }, []);

  useEffect(() => {
    async function syncMissingProductsIntoMaster() {
      if (isSyncingMissingProductsRef.current || inventoryDerivedProducts.length === 0) {
        return;
      }

      const missingProducts = inventoryDerivedProducts.filter(
        (product) => !masterProductKeys.has(buildMasterProductKey(product))
      );

      if (missingProducts.length === 0) {
        return;
      }

      isSyncingMissingProductsRef.current = true;

      try {
        for (const product of missingProducts) {
          const res = await fetch("/api/master-products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: product.name,
              sku: product.sku,
              category: product.category,
              productImportType: product.productImportType,
              imageDataUrl: product.imageDataUrl || "",
              unit: product.unit,
              price: product.price ?? 0,
              costPrice: product.costPrice ?? 0,
              costCurrency: product.costCurrency ?? "THB",
              defaultStorageLocation: product.defaultStorageLocation || "",
              defaultExpiryDate: product.defaultExpiryDate || "",
              vendor: product.vendor || "",
              note: product.note || "",
              isActive: true,
            }),
          });

          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as { error?: string } | null;
            if (
              data?.error !== "รหัสสินค้านี้มีอยู่แล้วใน ข้อมูลหลักสินค้า" &&
              data?.error !== "สินค้านี้มีอยู่แล้วใน ข้อมูลหลักสินค้า"
            ) {
              throw new Error(data?.error || "ไม่สามารถซิงก์สินค้าเข้า ข้อมูลหลักสินค้า ได้");
            }
          }
        }

        await fetchMasterProducts();
      } catch (error) {
        console.error("Failed to sync missing products into master data", error);
      } finally {
        isSyncingMissingProductsRef.current = false;
      }
    }

    syncMissingProductsIntoMaster();
  }, [inventoryDerivedProducts, masterProductKeys]);

  async function fetchMasterProducts() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/master-products");
      const data: unknown = await res.json().catch(() => null);

      if (!res.ok || !Array.isArray(data)) {
        const errorMessage =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "ไม่สามารถดึงข้อมูล ข้อมูลหลักสินค้า ได้";

        throw new Error(errorMessage);
      }

      setMasterProducts(data as ProductMaster[]);
    } catch (error) {
      console.error(error);
      window.alert("ไม่สามารถโหลด ข้อมูลหลักสินค้า สินค้าได้");
    } finally {
      setIsLoading(false);
    }
  }

  function updateForm<K extends keyof ProductMasterForm>(key: K, value: ProductMasterForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreateDialog(prefill?: Partial<ProductMasterForm>) {
    setEditingId("");
    setForm({ ...defaultForm, ...prefill });
    setIsDialogOpen(true);
  }

  function openEditDialog(product: ProductMaster) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      sku: sanitizeSku(product.sku),
      category: product.category,
      productImportType: product.productImportType,
      imageDataUrl: product.imageDataUrl || "",
      unit: product.unit,
      price: String(product.price ?? 0),
      costPrice: String(product.costPrice ?? 0),
      costCurrency: product.costCurrency ?? "THB",
      defaultStorageLocation: product.defaultStorageLocation || "",
      defaultExpiryDate: product.defaultExpiryDate || "",
      vendor: product.vendor || "",
      note: product.note || "",
      isActive: product.isActive,
    });
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingId("");
    setForm(defaultForm);
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      window.alert("เลือกได้เฉพาะไฟล์รูปภาพ");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      updateForm("imageDataUrl", result);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    const payload = {
      ...form,
      name: form.name.trim(),
      sku: sanitizeSku(form.sku.trim()),
      category: form.category.trim() || "-",
      unit: form.unit.trim(),
      price: Math.max(0, Number(form.price || 0)),
      costPrice: Math.max(0, Number(form.costPrice || 0)),
      defaultStorageLocation: form.defaultStorageLocation.trim(),
      defaultExpiryDate: form.defaultExpiryDate,
      vendor: form.vendor.trim(),
      note: form.note.trim(),
    };

    if (!payload.name || !payload.unit) {
      window.alert("กรอกชื่อสินค้าและหน่วยนับให้ครบก่อนบันทึก");
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch("/api/master-products", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถบันทึก ข้อมูลหลักสินค้า สินค้าได้");
      }

      await Promise.all([fetchMasterProducts(), refresh()]);
      closeDialog();
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : "ไม่สามารถบันทึก ข้อมูลหลักสินค้า สินค้าได้");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(product: ProductMaster) {
    const nextActionLabel = product.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน";
    const impactMessage = product.isActive
      ? "สินค้านี้จะไม่สามารถรับเข้าใหม่หรือสร้างใบเบิกใหม่ได้ แต่สต๊อกและประวัติเดิมจะยังถูกเก็บไว้"
      : "สินค้านี้จะกลับมาเลือกใช้ในหน้ารับเข้าและหน้าเบิกสินค้าได้";
    const confirmed = window.confirm(
      `ต้องการ${nextActionLabel}สินค้า "${product.name}" ใช่หรือไม่\n\n${impactMessage}`
    );

    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch("/api/master-products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_active", id: product.id }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถเปลี่ยนสถานะสินค้าได้");
      }

      await fetchMasterProducts();
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : "ไม่สามารถเปลี่ยนสถานะสินค้าได้");
    }
  }

  async function handleDeleteProduct(product: ProductMaster) {
    const confirmed = window.confirm(`ต้องการลบสินค้า "${product.name}" ออกจาก ข้อมูลหลักสินค้า ใช่หรือไม่`);

    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/master-products?id=${encodeURIComponent(product.id)}`, {
        method: "DELETE",
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถลบสินค้าออกจาก ข้อมูลหลักสินค้า ได้");
      }

      await fetchMasterProducts();
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : "ไม่สามารถลบสินค้าออกจาก ข้อมูลหลักสินค้า ได้");
    }
  }

  if (userRole !== "admin") {
    return (
      <section className="dashboard-card">
        <div className="dashboard-panel-header">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-1 text-rose-500" size={22} />
            <div>
              <h2 className="dashboard-section-title">ข้อมูลหลักสินค้า สินค้า</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                หน้านี้สำหรับแอดมินใช้เพิ่มหรือแก้ไขสินค้าใหม่ในระบบเท่านั้น
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="master-data-page">
        <section className="dashboard-card master-data-hero">
          <div className="dashboard-panel-header">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-sky-600">
                ข้อมูลมาตรฐานสินค้า
              </p>
              <h2 className="dashboard-section-title">ข้อมูลหลักสินค้า สินค้า</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                ใช้เพิ่มสินค้าใหม่และดูรายการสินค้ามาตรฐานของระบบ โดยระบบจะซิงก์สินค้าที่มีอยู่ในคลังเข้ามาให้ด้วย
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => openCreateDialog()}>
                <Plus size={16} />
                เพิ่มสินค้าใหม่
              </Button>
            </div>
          </div>
        </section>

        <section className="master-data-stats">
          <div className="master-data-stat-card">
            <div className="master-data-stat-icon">
              <PackageCheck size={20} />
            </div>
            <div className="master-data-stat-content">
              <p className="master-data-stat-label">สินค้าที่เปิดใช้งาน</p>
              <div className="master-data-stat-body">
                <strong className="master-data-stat-value">{formatNumber(activeProductCount)}</strong>
                <span className="master-data-stat-helper">พร้อมใช้ในระบบตอนนี้</span>
              </div>
            </div>
          </div>
          <div className="master-data-stat-card">
            <div className="master-data-stat-icon">
              <Boxes size={20} />
            </div>
            <div className="master-data-stat-content">
              <p className="master-data-stat-label">หมวดหมู่ทั้งหมด</p>
              <div className="master-data-stat-body">
                <strong className="master-data-stat-value">{formatNumber(activeCategoryCount)}</strong>
                <span className="master-data-stat-helper">รวมทุกหมวดที่มีการใช้งาน</span>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="master-data-stat-button"
              onClick={() => setIsCategoryDialogOpen(true)}
            >
              ดูหมวดหมู่
            </Button>
          </div>
          <div className="master-data-stat-card">
            <div className="master-data-stat-icon">
              <Store size={20} />
            </div>
            <div className="master-data-stat-content">
              <p className="master-data-stat-label">สินค้าที่มีสต๊อกคงเหลือ</p>
              <div className="master-data-stat-body">
                <strong className="master-data-stat-value">{formatNumber(stockedProductCount)}</strong>
                <span className="master-data-stat-helper">อ้างอิงจากของที่ยังคงเหลือในคลัง</span>
              </div>
            </div>
          </div>
        </section>

        <DataPanel
          title="รายการสินค้าใน ข้อมูลหลักสินค้า"
          description="แอดมินสามารถเพิ่มสินค้าใหม่ไว้ที่หน้านี้ก่อนนำไปใช้ในหน้ารับเข้า"
          action={
            <div className="master-data-toolbar">
              <label className="master-data-search">
                <Search size={15} />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="ค้นหาชื่อสินค้า, รหัส, หมวดหมู่..."
                />
              </label>
              <ComboboxSelect
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as "all" | "active" | "inactive")
                }
                options={[
                  { value: "all", label: "ทุกสถานะ" },
                  { value: "active", label: "เปิดใช้งาน" },
                  { value: "inactive", label: "ปิดใช้งาน" },
                ]}
                className="master-data-filter"
                searchPlaceholder="ค้นหาสถานะ..."
              />
            </div>
          }
        >
          <Table
            headers={[
              "สินค้า",
              "ประเภทสินค้า",
              "หมวดหมู่ / หน่วย",
              "จุดเก็บ / ผู้ขาย",
              "วันหมดอายุ",
              "คงเหลือในคลัง",
              "ต้นทุนมาตรฐาน",
              "สถานะ",
              "จัดการ",
            ]}
            emptyMessage={isLoading ? "กำลังโหลด ข้อมูลหลักสินค้า..." : "ยังไม่มีสินค้าใน ข้อมูลหลักสินค้า"}
            columnCount={8}
          >
            {filteredProducts.map((product) => (
              <tr key={product.id}>
                <td>
                  <div className="master-data-product-cell">
                    <strong className="font-semibold text-[var(--text-strong)]">{product.name}</strong>
                    <div className="text-[12px] text-[var(--text-muted)]">
                      {product.sku || "ยังไม่มีรหัสสินค้า"}
                    </div>
                  </div>
                </td>
                <td>{getProductImportTypeLabel(product.productImportType)}</td>
                <td>
                  <div className="master-data-stack-cell">
                    <strong>{product.category || "-"}</strong>
                    <span>หน่วย {product.unit}</span>
                  </div>
                </td>
                <td>
                  <div className="master-data-stack-cell">
                    <strong>{product.defaultStorageLocation || "-"}</strong>
                    <span>{product.vendor || "ยังไม่ระบุผู้ขาย"}</span>
                  </div>
                </td>
                <td>{product.defaultExpiryDate || "-"}</td>
                <td className="text-right">
                  <div className="master-data-amount-cell">
                    <strong>{formatNumber(product.inventoryItem?.balance ?? 0)}</strong>
                    <span>{product.unit}</span>
                  </div>
                </td>
                <td className="text-right">{formatCurrency(product.costPrice ?? 0)}</td>
                <td>
                  <span className={`stock-pill ${product.isActive ? "stock-pill-ok" : "stock-pill-danger"}`}>
                    {product.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                  </span>
                </td>
                <td>
                  <div className="master-data-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditDialog(product)}
                    >
                      <Pencil size={14} />
                      แก้ไข
                    </Button>
                    <Button
                      type="button"
                      variant={product.isActive ? "danger" : "secondary"}
                      size="sm"
                      onClick={() => handleToggleActive(product)}
                    >
                      {product.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteProduct(product)}
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
      </section>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[860px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "แก้ไข ข้อมูลหลักสินค้า สินค้า" : "เพิ่มสินค้าใหม่ใน ข้อมูลหลักสินค้า"}</DialogTitle>
            <DialogDescription>
              กำหนดข้อมูลมาตรฐานของสินค้าเพื่อให้ใช้ต่อในหน้ารับเข้าได้ทันที
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4 p-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                ประเภทสินค้า *
                <ComboboxSelect
                  value={form.productImportType}
                  onValueChange={(value) =>
                    updateForm("productImportType", value as ProductImportType)
                  }
                  options={productImportTypeOptions}
                  className={inputClassName}
                  searchPlaceholder="ค้นหาประเภทสินค้า..."
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                หมวดหมู่
                <input
                  value={form.category}
                  onChange={(event) => updateForm("category", event.target.value)}
                  className={inputClassName}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                ชื่อสินค้า *
                <input
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  className={inputClassName}
                  required
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                รหัสสินค้า
                <input
                  value={form.sku}
                  onChange={(event) => updateForm("sku", sanitizeSku(event.target.value))}
                  className={inputClassName}
                  inputMode="text"
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                หน่วยนับ *
                <input
                  value={form.unit}
                  onChange={(event) => updateForm("unit", event.target.value)}
                  className={inputClassName}
                  required
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                สถานะใช้งาน
                <ComboboxSelect
                  value={form.isActive ? "active" : "inactive"}
                  onValueChange={(value) => updateForm("isActive", value === "active")}
                  options={[
                    { value: "active", label: "เปิดใช้งาน" },
                    { value: "inactive", label: "ปิดใช้งาน" },
                  ]}
                  className={inputClassName}
                  searchPlaceholder="ค้นหาสถานะ..."
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                ต้นทุนมาตรฐาน
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costPrice}
                  onChange={(event) => updateForm("costPrice", event.target.value)}
                  className={inputClassName}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                สกุลเงินต้นทุน
                <ComboboxSelect
                  value={form.costCurrency}
                  onValueChange={(value) => updateForm("costCurrency", value as CostCurrency)}
                  options={costCurrencyOptions}
                  className={inputClassName}
                  searchPlaceholder="ค้นหาสกุลเงิน..."
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                ราคาขายมาตรฐาน
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(event) => updateForm("price", event.target.value)}
                  className={inputClassName}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                ผู้ขาย
                <input
                  value={form.vendor}
                  onChange={(event) => updateForm("vendor", event.target.value)}
                  className={inputClassName}
                  placeholder="เช่น บริษัทผู้ขาย / ร้านค้า"
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                จุดเก็บมาตรฐาน
                <input
                  value={form.defaultStorageLocation}
                  onChange={(event) => updateForm("defaultStorageLocation", event.target.value)}
                  className={inputClassName}
                  placeholder="เช่น A01 - ลานวางแผ่นพื้น"
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                วันหมดอายุ
                <input
                  type="date"
                  value={form.defaultExpiryDate}
                  onChange={(event) => updateForm("defaultExpiryDate", event.target.value)}
                  className={inputClassName}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)] sm:col-span-2">
                รูปสินค้า
                <input type="file" accept="image/*" onChange={handleImageChange} className={inputClassName} />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)] sm:col-span-2">
                หมายเหตุ
                <textarea
                  value={form.note}
                  onChange={(event) => updateForm("note", event.target.value)}
                  className={`${inputClassName} min-h-[64px] h-auto resize-y py-2.5`}
                  rows={2}
                  placeholder="บันทึกรายละเอียดเพิ่มเติมของสินค้า"
                />
              </label>

              {form.imageDataUrl ? (
                <div className="grid gap-3 sm:col-span-2">
                  <div className="receive-image-preview">
                    <img src={form.imageDataUrl} alt={form.name || "รูปสินค้า"} />
                  </div>
                  <div>
                    <Button type="button" variant="secondary" size="sm" onClick={() => updateForm("imageDataUrl", "")}>
                      ลบรูปสินค้า
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={closeDialog} disabled={isSaving}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "บันทึกสินค้าใหม่"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>หมวดหมู่ทั้งหมดในระบบ</DialogTitle>
            <DialogDescription>
              ดูรายชื่อหมวดหมู่ที่มีอยู่ตอนนี้ พร้อมจำนวนสินค้าที่อยู่ในแต่ละหมวด
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            {categorySummary.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-[var(--text-muted)]">
                ยังไม่มีหมวดหมู่ในระบบ
              </div>
            ) : (
              categorySummary.map((category) => (
                <div
                  key={category.name}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3"
                >
                  <strong className="text-sm font-semibold text-[var(--text-strong)]">{category.name}</strong>
                  <span className="text-sm text-[var(--text-muted)]">
                    {formatNumber(category.count)} รายการ
                  </span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
