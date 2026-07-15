"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Pencil, RotateCcw, Search, Trash2 } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import {
  getClientMasterProducts,
  invalidateClientMasterProductsCache,
} from "@/lib/dashboard-client-cache";
import { Button } from "@/components/ui/button";
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
  formatNumber,
  getStockTargetStatus,
  matchesMasterProduct,
  sanitizeSku,
} from "@/lib/stock-flow/utils";
import type { ProductImportType, ProductMaster } from "@/types/stock-flow";
import { useTransactions } from "../TransactionContext";

const inputClassName = "control-input";

type ProductEditForm = {
  name: string;
  sku: string;
  category: string;
  productImportType: ProductImportType;
  unit: string;
  minStock: string;
  maxStock: string;
};

const defaultProductEditForm: ProductEditForm = {
  name: "",
  sku: "",
  category: "",
  productImportType: "resale",
  unit: "",
  minStock: "0",
  maxStock: "0",
};

export default function SettingsPage() {
  const { transactions, refresh } = useTransactions();
  const [masterProducts, setMasterProducts] = useState<ProductMaster[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditProductDialogOpen, setIsEditProductDialogOpen] = useState(false);
  const [editingMasterProductId, setEditingMasterProductId] = useState("");
  const [editingItemKey, setEditingItemKey] = useState("");
  const [productEditForm, setProductEditForm] = useState<ProductEditForm>(defaultProductEditForm);

  useEffect(() => {
    getClientMasterProducts()
      .then((products) => setMasterProducts(products))
      .catch(() => setMasterProducts([]));
  }, []);

  const inventory = useMemo(() => [...buildInventoryMap(transactions).values()], [transactions]);

  const summarizedProducts = useMemo(
    () =>
      masterProducts
        .map((product) => {
          const inventoryItem = inventory.find((item) => matchesMasterProduct(item, product)) ?? null;
          const balance = inventoryItem?.balance ?? 0;

          return {
            ...product,
            balance,
            stockTargetStatus: getStockTargetStatus(balance, product.minStock, product.maxStock),
          };
        })
        .sort((left, right) => left.name.localeCompare(right.name, "th")),
    [inventory, masterProducts]
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return summarizedProducts.filter((product) => {
      if (!normalizedSearch) {
        return true;
      }

      const haystack = [product.name, product.sku, product.category].join(" ").toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [searchTerm, summarizedProducts]);

  function updateProductEditForm<K extends keyof ProductEditForm>(key: K, value: ProductEditForm[K]) {
    setProductEditForm((current) => ({ ...current, [key]: value }));
  }

  function resetDialog() {
    setIsEditProductDialogOpen(false);
    setEditingMasterProductId("");
    setEditingItemKey("");
    setProductEditForm(defaultProductEditForm);
  }

  function openEditProductDialog(product: ProductMaster) {
    const matchedInventory = inventory.find((item) => matchesMasterProduct(item, product)) ?? null;

    setEditingMasterProductId(product.id);
    setEditingItemKey(matchedInventory?.key || "");
    setProductEditForm({
      name: product.name,
      sku: sanitizeSku(product.sku),
      category: product.category,
      productImportType: product.productImportType,
      unit: product.unit,
      minStock: String(product.minStock ?? 0),
      maxStock: String(product.maxStock ?? 0),
    });
    setIsEditProductDialogOpen(true);
  }

  async function refreshProducts() {
    invalidateClientMasterProductsCache();
    const products = await getClientMasterProducts().catch(() => []);
    setMasterProducts(products);
  }

  async function handleProductActiveChange(product: ProductMaster, nextIsActive: boolean) {
    const shouldUpdate = window.confirm(
      nextIsActive
        ? `ต้องการเปิดใช้งานสินค้า "${product.name}" ใช่หรือไม่\n\nสินค้านี้จะกลับไปแสดงในหน้าเบิกและหน้ารับเข้า`
        : `ต้องการปิดใช้งานสินค้า "${product.name}" ใช่หรือไม่\n\nเป็นการซ่อนสินค้า ไม่ใช่ลบข้อมูล ประวัติรับเข้า-เบิกจ่ายจะยังอยู่ครบ`
    );

    if (!shouldUpdate) {
      return;
    }

    setMasterProducts((current) =>
      current.map((item) => (item.id === product.id ? { ...item, isActive: nextIsActive } : item))
    );

    const response = await fetch(withBasePath("/api/master-products"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: product.id,
        action: "set_active",
        isActive: nextIsActive,
      }),
    });

    if (!response.ok) {
      setMasterProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, isActive: product.isActive } : item))
      );
      const detail = await response.json().catch(() => null);
      console.error("Unable to update product active state", detail);
      window.alert(nextIsActive ? "ไม่สามารถเปิดใช้งานสินค้าได้" : "ไม่สามารถปิดใช้งานสินค้าได้");
      return;
    }

    await refreshProducts();
    refresh();
  }

  async function handleProductDelete(product: ProductMaster) {
    const shouldDelete = window.confirm(
      `ต้องการลบสินค้า "${product.name}" ออกจากรายการสินค้าใช่หรือไม่\n\nระบบจะซ่อนสินค้านี้จาก dropdown หน้า รับเข้า/เบิกจ่าย แต่ยังเก็บประวัติรับเข้า-เบิกจ่ายเดิมไว้ครบ`
    );

    if (!shouldDelete) {
      return;
    }

    setMasterProducts((current) =>
      current.map((item) => (item.id === product.id ? { ...item, isActive: false } : item))
    );

    const response = await fetch(withBasePath(`/api/master-products?id=${encodeURIComponent(product.id)}`), {
      method: "DELETE",
    });

    if (!response.ok) {
      setMasterProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, isActive: product.isActive } : item))
      );
      const detail = await response.json().catch(() => null);
      console.error("Unable to delete product", detail);
      window.alert("ไม่สามารถลบสินค้าได้");
      return;
    }

    await refreshProducts();
    refresh();
  }

  async function handleProductEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const currentProduct = masterProducts.find((product) => product.id === editingMasterProductId);
    if (!currentProduct) {
      window.alert("ไม่พบข้อมูลสินค้าที่ต้องการแก้ไข");
      return;
    }

    const nextName = productEditForm.name.trim();
    const nextUnit = productEditForm.unit.trim();
    const nextSku = sanitizeSku(productEditForm.sku.trim());
    const nextCategory = productEditForm.category.trim() || "-";
    const nextMinStock = Math.max(0, Math.floor(Number(productEditForm.minStock || 0)));
    const nextMaxStock = Math.max(0, Math.floor(Number(productEditForm.maxStock || 0)));

    if (!nextName || !nextUnit) {
      window.alert("กรอกชื่อสินค้าและหน่วยนับให้ครบก่อนบันทึก");
      return;
    }

    if (nextMaxStock > 0 && nextMinStock > nextMaxStock) {
      window.alert("จำนวนสต๊อกต่ำสุดต้องไม่มากกว่าจำนวนสต๊อกสูงสุด");
      return;
    }

    const requests: Promise<Response>[] = [
      fetch(withBasePath("/api/master-products"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentProduct.id,
          name: nextName,
          sku: nextSku,
          category: nextCategory,
          productImportType: productEditForm.productImportType,
          imageDataUrl: currentProduct.imageDataUrl || "",
          unit: nextUnit,
          price: currentProduct.price,
          costPrice: currentProduct.costPrice,
          costCurrency: currentProduct.costCurrency,
          minStock: nextMinStock,
          maxStock: nextMaxStock,
          defaultStorageLocation: currentProduct.defaultStorageLocation || "",
          defaultExpiryDate: currentProduct.defaultExpiryDate || "",
          vendor: currentProduct.vendor || "",
          note: currentProduct.note || "",
          isActive: currentProduct.isActive,
        }),
      }),
    ];

    if (editingItemKey) {
      requests.push(
        fetch(withBasePath("/api/transactions"), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_product",
            itemKey: editingItemKey,
            updatedData: {
              name: nextName,
              sku: nextSku,
              category: nextCategory,
              productImportType: productEditForm.productImportType,
              imageDataUrl: currentProduct.imageDataUrl || "",
              unit: nextUnit,
              price: currentProduct.price,
              costPrice: currentProduct.costPrice,
              expiryDate: currentProduct.defaultExpiryDate || "",
            },
          }),
        })
      );
    }

    const responses = await Promise.all(requests);
    if (responses.some((response) => !response.ok)) {
      window.alert("ไม่สามารถอัปเดตข้อมูลสินค้าในฐานข้อมูลได้");
      return;
    }

    await refreshProducts();
    refresh();
    resetDialog();
  }

  return (
    <>
      <section id="settings" className="grid gap-3">
        <section className="dashboard-card">
          <div className="dashboard-panel-header">
            <div>
              <h3 className="dashboard-section-title">ตั้งค่ารายการสินค้า</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                ใช้หน้านี้แก้ชื่อสินค้า ย้ายหมวดหมู่ และกำหนด min / max ของแต่ละรายการแบบตรงไปตรงมา
              </p>
            </div>
          </div>
        </section>

        <DataPanel
          title="รายการสินค้าทั้งหมด"
          description="ดูเป็นรายสินค้า แล้วแก้ชื่อ ย้ายหมวดหมู่ และตั้งค่า min / max ได้จากจุดเดียว"
          action={
            <label className="master-data-search">
              <Search size={15} />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ค้นหาชื่อสินค้า, รหัสสินค้า, หมวดหมู่..."
              />
            </label>
          }
        >
          <Table
            headers={["สินค้า", "หมวดหมู่", "คงเหลือ", "min / max", "สถานะ", "จัดการ"]}
            emptyMessage="ยังไม่มีรายการสินค้า"
            columnCount={6}
          >
            {filteredProducts.map((product) => (
              <tr key={product.id} className={!product.isActive ? "opacity-70" : undefined}>
                <td>
                  <strong className="font-semibold text-[var(--text-strong)]">{product.name}</strong>
                  <div className="text-[12px] text-[var(--text-muted)]">
                    {product.sku || "ยังไม่มีรหัสสินค้า"} · หน่วย {product.unit}
                  </div>
                </td>
                <td>{product.category || "-"}</td>
                <td className="text-right">
                  {formatNumber(product.balance)}{" "}
                  <span className="text-[12px] text-[var(--text-subtle)]">{product.unit}</span>
                </td>
                <td>
                  <div className="master-data-stack-cell">
                    <strong>min {formatNumber(product.minStock)}</strong>
                    <span>max {formatNumber(product.maxStock)}</span>
                  </div>
                </td>
                <td>
                  {!product.isActive ? (
                    <span className="stock-pill stock-pill-muted">ถูกลบ</span>
                  ) : (
                    <span
                      className={`stock-pill ${
                        product.stockTargetStatus === "low"
                          ? "stock-pill-danger"
                          : product.stockTargetStatus === "high"
                            ? "stock-pill-warn"
                            : product.stockTargetStatus === "normal"
                              ? "stock-pill-ok"
                              : ""
                      }`}
                    >
                      {product.stockTargetStatus === "low"
                        ? "ต่ำกว่า min"
                        : product.stockTargetStatus === "high"
                          ? "สูงกว่า max"
                          : product.stockTargetStatus === "normal"
                            ? "อยู่ในช่วง"
                            : "ยังไม่ตั้งค่า"}
                    </span>
                  )}
                </td>
                <td>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditProductDialog(product)}
                    >
                      <Pencil size={14} />
                      แก้ไข
                    </Button>
                    {product.isActive ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                        onClick={() => handleProductDelete(product)}
                      >
                        <Trash2 size={14} />
                        ลบ
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                        onClick={() => handleProductActiveChange(product, true)}
                      >
                        <RotateCcw size={14} />
                        กู้คืน
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </DataPanel>
      </section>

      <Dialog open={isEditProductDialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>แก้ไขรายการสินค้า</DialogTitle>
            <DialogDescription>
              แก้ชื่อสินค้า หมวดหมู่ หน่วยนับ และค่า min / max ของรายการนี้
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4 p-4" onSubmit={handleProductEditSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)] sm:col-span-2">
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
                <select
                  value={productEditForm.productImportType}
                  onChange={(event) =>
                    updateProductEditForm("productImportType", event.target.value as ProductImportType)
                  }
                  className={inputClassName}
                >
                  <option value="resale">ซื้อมาขายไป</option>
                  <option value="stable">สินค้าเข้าสต็อก</option>
                </select>
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
                หน่วยนับ
                <input
                  value={productEditForm.unit}
                  onChange={(event) => updateProductEditForm("unit", event.target.value)}
                  className={inputClassName}
                  required
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
