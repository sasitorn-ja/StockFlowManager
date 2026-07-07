"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Plus, Search, Filter, ChevronDown, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComboboxSelect } from "@/components/ui/combobox-select";
import { ComboboxInput } from "@/components/ui/combobox-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildInventoryMap,
  createEmptyForm,
  createTransactionId,
  getLocalDateValue,
  formatDate,
  formatNumber,
  formatCurrency,
  sanitizeSku,
} from "@/lib/stock-flow/utils";
import type { Transaction, CostCurrency, ProductImportType, ProductMaster } from "@/types/stock-flow";
import type { FormState } from "./types";
import { useTransactions } from "../TransactionContext";
import { RECEIVE_STATUS_LABEL } from "@/lib/stock-flow/status";

type OverviewFilter = "all" | ProductImportType;
type UserRole = "employee" | "manager" | "admin";
type ReceiveProductSuggestion = {
  key: string;
  name: string;
  sku: string;
  category: string;
  imageDataUrl?: string;
  productImportType: ProductImportType;
  unit: string;
  price: number;
  costPrice: number;
  costCurrency: CostCurrency;
  defaultStorageLocation?: string;
};

type ReceiveCategorySuggestion = {
  category: string;
  normalizedCategory: string;
  productCount: number;
};

const costCurrencyOptions: { value: CostCurrency; label: string }[] = [
  { value: "THB", label: "🇹🇭 THB" },
  { value: "JPY", label: "🇯🇵 JPY" },
  { value: "CNY", label: "🇨🇳 CNY" },
  { value: "USD", label: "🇺🇸 USD" },
];

const filterOptions: { value: OverviewFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "resale", label: "สินค้าซื้อมาขายไป" },
  { value: "stable", label: "สินค้าเข้าสต็อก" },
];

const productImportTypeOptions: { value: ProductImportType; label: string }[] = [
  { value: "resale", label: "ซื้อมาขายไป" },
  { value: "stable", label: "สินค้าเข้าสต็อก" },
];

function normalizeCategoryValue(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("th")
    .normalize("NFKD")
    .replace(/[\u0E31-\u0E3A\u0E47-\u0E4E]/g, "")
    .replace(/\s+/g, "");
}

export default function ReceivePage() {
  const { transactions, refresh } = useTransactions();
  const [simulatedRole, setSimulatedRole] = useState<UserRole>("employee");
  const [masterProducts, setMasterProducts] = useState<ProductMaster[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [receiveFilter, setReceiveFilter] = useState<OverviewFilter>("all");
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [isReceivePanelOpen, setIsReceivePanelOpen] = useState(false);
  const [receiveImagePreview, setReceiveImagePreview] = useState<{ src: string; title: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoRecordTime, setAutoRecordTime] = useState(Date.now());

  const inventory = useMemo(() => [...buildInventoryMap(transactions).values()], [transactions]);

  const receiveTransactions = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return transactions
      .filter((item) => {
        if (item.type !== "in") {
          return false;
        }

        if (receiveFilter !== "all" && item.productImportType !== receiveFilter) {
          return false;
        }

        const haystack = `${item.name} ${item.sku} ${item.category} ${item.note}`.toLowerCase();
        return haystack.includes(normalizedSearchTerm);
      })
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [receiveFilter, searchTerm, transactions]);

  const receiveProductSuggestions = useMemo<ReceiveProductSuggestion[]>(() => {
    const inventorySuggestions = inventory.map((item) => ({
      key: `inventory-${item.key}`,
      name: item.name,
      sku: item.sku,
      category: item.category,
      imageDataUrl: item.imageDataUrl || "",
      productImportType: item.productImportType,
      unit: item.unit,
      price: item.price,
      costPrice: item.costPrice ?? 0,
      costCurrency: item.costCurrency ?? "THB",
      defaultStorageLocation: "",
    }));

    const existingKeys = new Set(
      inventorySuggestions.map(
        (item) =>
          `${item.name.trim().toLowerCase()}::${item.sku.trim().toLowerCase()}::${item.category.trim().toLowerCase()}::${item.productImportType}::${item.unit.trim().toLowerCase()}`
      )
    );

    const masterSuggestions = masterProducts
      .filter((item) => item.isActive)
      .map((item) => ({
        key: `master-${item.id}`,
        name: item.name,
        sku: item.sku,
        category: item.category,
        imageDataUrl: item.imageDataUrl || "",
        productImportType: item.productImportType,
        unit: item.unit,
        price: item.price ?? 0,
        costPrice: item.costPrice ?? 0,
        costCurrency: item.costCurrency ?? "THB",
        defaultStorageLocation: item.defaultStorageLocation || "",
      }))
      .filter((item) => {
        const key = `${item.name.trim().toLowerCase()}::${item.sku.trim().toLowerCase()}::${item.category.trim().toLowerCase()}::${item.productImportType}::${item.unit.trim().toLowerCase()}`;
        return !existingKeys.has(key);
      });

    return [...inventorySuggestions, ...masterSuggestions].sort((a, b) =>
      a.name.localeCompare(b.name, "th")
    );
  }, [inventory, masterProducts]);

  const filteredReceiveProductSuggestions = useMemo(() => {
    return receiveProductSuggestions.filter((item) => {
      if (item.productImportType !== form.productImportType) {
        return false;
      }

      if (!form.category.trim()) {
        return true;
      }

      return normalizeCategoryValue(item.category) === normalizeCategoryValue(form.category);
    });
  }, [form.category, form.productImportType, receiveProductSuggestions]);

  const receiveCategorySuggestions = useMemo<ReceiveCategorySuggestion[]>(() => {
    const groupedCategories = new Map<
      string,
      { category: string; productKeys: Set<string> }
    >();

    receiveProductSuggestions
      .filter((item) => item.productImportType === form.productImportType)
      .forEach((item) => {
        const category = item.category.trim();
        const normalizedCategory = normalizeCategoryValue(category);

        if (!category || !normalizedCategory) {
          return;
        }

        const existing = groupedCategories.get(normalizedCategory);
        if (existing) {
          existing.productKeys.add(item.key);
          return;
        }

        groupedCategories.set(normalizedCategory, {
          category,
          productKeys: new Set([item.key]),
        });
      });

    return Array.from(groupedCategories.entries())
      .map(([normalizedCategory, entry]) => ({
        category: entry.category,
        normalizedCategory,
        productCount: entry.productKeys.size,
      }))
      .sort((a, b) => a.category.localeCompare(b.category, "th"));
  }, [form.productImportType, receiveProductSuggestions]);

  const receiveStorageLocationSuggestions = useMemo(() => {
    return Array.from(
      new Set(
        transactions
          .filter((item) => item.type === "in")
          .map((item) => item.requester?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b, "th"));
  }, [transactions]);

  const autoRecordTimeLabel = useMemo(
    () =>
      new Date(autoRecordTime).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [autoRecordTime]
  );
  const isCategoryReady = Boolean(form.productImportType && form.category.trim());
  const canCreateNewProduct = simulatedRole === "admin";
  const hasMatchedCategory = useMemo(() => {
    const normalizedCategory = form.category.trim().toLowerCase();

    if (!normalizedCategory) {
      return false;
    }

    return receiveCategorySuggestions.some(
      (item) => item.normalizedCategory === normalizeCategoryValue(form.category)
    );
  }, [form.category, receiveCategorySuggestions]);
  const matchedReceiveProduct = useMemo(() => {
    const normalizedName = form.name.trim().toLowerCase();
    const normalizedCategory = normalizeCategoryValue(form.category);

    if (!normalizedName) {
      return null;
    }

    return (
      receiveProductSuggestions.find(
        (item) =>
          item.name.trim().toLowerCase() === normalizedName &&
          item.productImportType === form.productImportType &&
          (!normalizedCategory || normalizeCategoryValue(item.category) === normalizedCategory)
      ) ?? null
    );
  }, [form.category, form.name, form.productImportType, receiveProductSuggestions]);
  const showMissingCategoryError =
    !canCreateNewProduct && form.category.trim().length > 0 && !hasMatchedCategory;
  const showMissingProductError =
    !canCreateNewProduct && form.name.trim().length > 0 && !matchedReceiveProduct;

  useEffect(() => {
    if (!isReceivePanelOpen) {
      return;
    }

    setAutoRecordTime(Date.now());
    const timerId = window.setInterval(() => setAutoRecordTime(Date.now()), 30000);

    return () => window.clearInterval(timerId);
  }, [isReceivePanelOpen]);

  useEffect(() => {
    const loadSimulatedRole = () => {
      const storedRole = localStorage.getItem("simulated_role");

      if (storedRole === "admin" || storedRole === "manager" || storedRole === "employee") {
        setSimulatedRole(storedRole);
        return;
      }

      setSimulatedRole("employee");
    };

    loadSimulatedRole();
    window.addEventListener("simulated-role-changed", loadSimulatedRole);

    return () => window.removeEventListener("simulated-role-changed", loadSimulatedRole);
  }, []);

  useEffect(() => {
    async function fetchMasterProducts() {
      try {
        const res = await fetch("/api/master-products");
        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as ProductMaster[];
        if (Array.isArray(data)) {
          setMasterProducts(data);
        }
      } catch (error) {
        console.error("Failed to load master products", error);
      }
    }

    fetchMasterProducts();
  }, []);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleProductImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      updateForm("imageDataUrl", "");
      return;
    }

    if (!file.type.startsWith("image/")) {
      window.alert("อัปโหลดได้เฉพาะไฟล์รูปภาพ");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      updateForm("imageDataUrl", result);
    };
    reader.readAsDataURL(file);
  }

  function handleReceiveProductNameChange(value: string) {
    const normalizedValue = value.trim().toLowerCase();

    if (!normalizedValue) {
      setForm((current) => ({
        ...current,
        name: value,
        sku: "",
        category: "",
        imageDataUrl: "",
        unit: "",
        price: "0",
        costPrice: "0",
        costCurrency: "THB",
      }));
      return;
    }

    const matchedItem = receiveProductSuggestions.find(
      (item) =>
        item.name.trim().toLowerCase() === normalizedValue &&
        item.productImportType === form.productImportType &&
        (!form.category.trim() ||
          normalizeCategoryValue(item.category) === normalizeCategoryValue(form.category))
    );

    if (!matchedItem && !canCreateNewProduct) {
      setForm((current) => ({
        ...current,
        name: value,
      }));
      return;
    }

    setForm((current) => {
      const prevNormalized = current.name.trim().toLowerCase();
      const prevMatchedItem = receiveProductSuggestions.find(
        (item) => item.name.trim().toLowerCase() === prevNormalized
      );

      let updatedFields = {};

      if (!matchedItem && prevMatchedItem) {
        const isSkuUnchanged = current.sku === prevMatchedItem.sku;
        const isCategoryUnchanged = current.category === prevMatchedItem.category;
        const isUnitUnchanged = current.unit === prevMatchedItem.unit;
        const isCostPriceUnchanged = current.costPrice === String(prevMatchedItem.costPrice ?? 0);
        const isPriceUnchanged = current.price === String(prevMatchedItem.price);
        const isCurrencyUnchanged = current.costCurrency === (prevMatchedItem.costCurrency ?? "THB");
        const isImageUnchanged = (current.imageDataUrl || "") === (prevMatchedItem.imageDataUrl || "");

        updatedFields = {
          sku: isSkuUnchanged ? "" : current.sku,
          category: isCategoryUnchanged ? "" : current.category,
          unit: isUnitUnchanged ? "" : current.unit,
          costPrice: isCostPriceUnchanged ? "0" : current.costPrice,
          price: isPriceUnchanged ? "0" : current.price,
          costCurrency: isCurrencyUnchanged ? "THB" : current.costCurrency,
          imageDataUrl: isImageUnchanged ? "" : current.imageDataUrl,
        };
      }

      if (matchedItem) {
        return {
          ...current,
          ...updatedFields,
          name: value,
          sku: sanitizeSku(matchedItem.sku),
          category: matchedItem.category,
          imageDataUrl: matchedItem.imageDataUrl || "",
          productImportType: matchedItem.productImportType,
          unit: matchedItem.unit,
          price: String(matchedItem.price),
          costPrice: String(matchedItem.costPrice ?? 0),
          costCurrency: matchedItem.costCurrency ?? "THB",
          requester: current.requester || matchedItem.defaultStorageLocation || "",
        };
      }

      return {
        ...current,
        ...updatedFields,
        name: value,
      };
    });
  }

  function handleReceiveCategorySelect(category: string) {
    if (!category) {
      setForm((current) => ({
        ...current,
        category: "",
      }));
      return;
    }

    const matchedCategory = receiveCategorySuggestions.find(
      (item) => item.normalizedCategory === normalizeCategoryValue(category)
    );

    if (!matchedCategory) {
      updateForm("category", category);
      return;
    }

    setForm((current) => ({
      ...current,
      category: matchedCategory.category,
      name:
        current.name &&
        filteredReceiveProductSuggestions.some(
          (item) => item.name.trim().toLowerCase() === current.name.trim().toLowerCase()
        )
          ? current.name
          : "",
      sku:
        current.name &&
        filteredReceiveProductSuggestions.some(
          (item) => item.name.trim().toLowerCase() === current.name.trim().toLowerCase()
        )
          ? current.sku
          : "",
      imageDataUrl:
        current.name &&
        filteredReceiveProductSuggestions.some(
          (item) => item.name.trim().toLowerCase() === current.name.trim().toLowerCase()
        )
          ? current.imageDataUrl
          : "",
      unit:
        current.name &&
        filteredReceiveProductSuggestions.some(
          (item) => item.name.trim().toLowerCase() === current.name.trim().toLowerCase()
        )
          ? current.unit
          : "",
      price:
        current.name &&
        filteredReceiveProductSuggestions.some(
          (item) => item.name.trim().toLowerCase() === current.name.trim().toLowerCase()
        )
          ? current.price
          : "0",
      costPrice:
        current.name &&
        filteredReceiveProductSuggestions.some(
          (item) => item.name.trim().toLowerCase() === current.name.trim().toLowerCase()
        )
          ? current.costPrice
          : "0",
      costCurrency:
        current.name &&
        filteredReceiveProductSuggestions.some(
          (item) => item.name.trim().toLowerCase() === current.name.trim().toLowerCase()
        )
          ? current.costCurrency
          : "THB",
      requester:
        current.name &&
        filteredReceiveProductSuggestions.some(
          (item) => item.name.trim().toLowerCase() === current.name.trim().toLowerCase()
        )
          ? current.requester
          : "",
    }));
  }

  function handleReceiveCategoryChange(value: string) {
    const normalizedValue = value.trim().toLowerCase();

    if (!normalizedValue) {
      setForm((current) => ({
        ...current,
        category: value,
      }));
      return;
    }

    const matchedCategory = receiveCategorySuggestions.find(
      (item) => item.normalizedCategory === normalizeCategoryValue(value)
    );

    if (matchedCategory) {
      handleReceiveCategorySelect(matchedCategory.category);
      return;
    }

    if (!canCreateNewProduct) {
      setForm((current) => ({
        ...current,
        category: value,
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      category: value,
    }));
  }

  function openReceiveDialog() {
    setForm({
      ...createEmptyForm(),
      productImportType: "resale",
      type: "in",
      date: getLocalDateValue(),
    });
    setAutoRecordTime(Date.now());
    setIsReceivePanelOpen(true);
  }

  function closeReceiveDialog() {
    setIsReceivePanelOpen(false);
    setForm(createEmptyForm());
  }

  function handleReceiveExport() {
    const rows = receiveTransactions.map((item, index) => ({
      "เลขที่รับเข้า": `IN-${item.date.replaceAll("-", "")}-${String(index + 1).padStart(3, "0")}`,
      "วันที่รับเข้า": formatDate(item.date),
      "เวลาบันทึก": new Date(item.createdAt).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      "จุดเก็บ / คลังย่อย": item.requester || "-",
      "รายการสินค้า": item.name,
      "รหัสสินค้า": item.sku || "-",
      "จำนวน": item.quantity,
      "หน่วย": item.unit,
      "มูลค่ารวม": item.quantity * (item.costPrice || item.price || 0),
      "หมายเหตุ": item.note || "-",
      "สถานะ": RECEIVE_STATUS_LABEL,
    }));

    if (rows.length === 0) {
      window.alert("ยังไม่มีรายการรับเข้าสินค้าที่พร้อมส่งออก");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Receive");
    XLSX.writeFile(workbook, `receive-transactions-${getLocalDateValue()}.xlsx`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const quantity = Number(form.quantity);
    const price = Number(form.price || 0);
    const costPrice = Number(form.costPrice || 0);

    if (!Number.isFinite(quantity) || !Number.isFinite(price) || !Number.isFinite(costPrice)) {
      window.alert("กรอกจำนวน ราคา และราคาต้นทุนเป็นตัวเลขที่ถูกต้องก่อนบันทึก");
      return;
    }

    if (!canCreateNewProduct && !matchedReceiveProduct) {
      window.alert("พนักงานรับเข้าได้เฉพาะสินค้าที่มีอยู่ในระบบแล้ว กรุณาเลือกจากรายการเดิม");
      return;
    }

    const baseProduct = matchedReceiveProduct;

    const transaction: Transaction = {
      id: createTransactionId(),
      name: (baseProduct?.name ?? form.name).trim(),
      sku: sanitizeSku((baseProduct?.sku ?? form.sku).trim()),
      category: (baseProduct?.category ?? form.category).trim() || "-",
      imageDataUrl: baseProduct?.imageDataUrl || form.imageDataUrl,
      productImportType: baseProduct?.productImportType ?? form.productImportType,
      unit: (baseProduct?.unit ?? form.unit).trim(),
      type: "in",
      quantity,
      price: Math.max(0, price),
      costPrice: Math.max(0, costPrice),
      costCurrency: form.costCurrency,
      date: form.date,
      expiryDate: form.expiryDate,
      issueKey: "",
      requester: form.requester.trim(),
      note: form.note.trim(),
      createdAt: Date.now(),
    };

    if (!transaction.name || !transaction.unit || quantity <= 0) {
      window.alert("กรอกข้อมูลสินค้า หน่วยนับ และจำนวนให้ครบก่อนบันทึก");
      return;
    }

    setIsSubmitting(true);

    // Pessimistically update UI & database
    fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transaction),
    })
      .then((res) => {
        if (res.ok) {
          refresh();
          closeReceiveDialog();
        } else {
          window.alert("ไม่สามารถบันทึกรายการสินค้าเข้าฐานข้อมูล Supabase PostgreSQL ได้");
        }
      })
      .catch((err) => {
        console.error("Submit error:", err);
        window.alert("เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }

  const currentReceiveFilterLabel =
    filterOptions.find((item) => item.value === receiveFilter)?.label ?? "ทั้งหมด";

  return (
    <>
      <section id="receive" className="receive-page">
        <div className="receive-main">
          <div className="receive-header">
            <div>
              <h2>รับเข้าสินค้า</h2>
              <p>บันทึกรายการรับเข้าและอัปเดตสต๊อกคงเหลือ</p>
            </div>
            <div className="receive-header-actions">
              <Button type="button" onClick={openReceiveDialog}>
                <Plus size={17} />
                บันทึกรับเข้า
              </Button>
            </div>
          </div>

          <section className="receive-table-card">
            <div className="receive-table-toolbar">
              <label className="overview-search">
                <Search size={17} />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="ค้นหาเลขที่รับเข้า, รหัสสินค้า, หมวดหมู่..."
                />
              </label>
              <div className="overview-table-actions">
                <details className="overview-filter-menu">
                  <summary>
                    <Filter size={15} />
                    <span>ตัวกรอง: {currentReceiveFilterLabel}</span>
                    <ChevronDown size={14} />
                  </summary>
                  <div className="overview-filter-dropdown">
                    {filterOptions.map((item) => (
                      <button
                        key={`receive-filter-${item.value}`}
                        type="button"
                        className={receiveFilter === item.value ? "active" : ""}
                        onClick={(event) => {
                          setReceiveFilter(item.value);
                          event.currentTarget.closest("details")?.removeAttribute("open");
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </details>
                <Button type="button" variant="secondary" size="sm" onClick={handleReceiveExport}>
                  <FileText size={15} />
                  ส่งออก
                </Button>
              </div>
            </div>

            <div className="overview-table-wrap">
              <table className="overview-table receive-table">
                <thead>
                  <tr>
                    <th>เลขที่รับเข้า</th>
                    <th>รูปภาพสินค้า</th>
                    <th>วันที่รับเข้า / เวลาบันทึก</th>
                    <th>จุดเก็บ / คลังย่อย</th>
                    <th>รายการสินค้า</th>
                    <th>จำนวนรายการ</th>
                    <th>มูลค่ารวม</th>
                    <th>หมายเหตุ</th>
                    <th>สถานะการรับเข้า</th>
                  </tr>
                </thead>
                <tbody>
                  {receiveTransactions.length > 0 ? (
                    receiveTransactions.map((item, index) => {
                      const receiveNo = `IN-${item.date.replaceAll("-", "")}-${String(
                        index + 1
                      ).padStart(3, "0")}`;
                      const totalValue = item.quantity * (item.costPrice || item.price || 0);

                      return (
                        <tr key={`receive-${item.id}`}>
                          <td className="sku-cell">{receiveNo}</td>
                          <td>
                            {item.imageDataUrl ? (
                              <button
                                type="button"
                                className="receive-image-trigger"
                                onClick={() =>
                                  setReceiveImagePreview({
                                    src: item.imageDataUrl as string,
                                    title: item.name || receiveNo,
                                  })
                                }
                              >
                                <ImageIcon size={15} />
                                ดูรูป
                              </button>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td>
                            <strong>{formatDate(item.date)}</strong>
                            <span>
                              บันทึก{" "}
                              {new Date(item.createdAt).toLocaleTimeString("th-TH", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </td>
                          <td>{item.requester || "-"}</td>
                          <td>
                            <strong>{item.name}</strong>
                            <span>{item.sku || "-"}</span>
                          </td>
                          <td>{formatNumber(item.quantity)}</td>
                          <td>{formatCurrency(totalValue)}</td>
                          <td>{item.note || "-"}</td>
                          <td>
                            <span className="stock-pill stock-pill-ok">{RECEIVE_STATUS_LABEL}</span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9}>
                        <div className="empty-state">ยังไม่มีรายการรับเข้าสินค้า</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="overview-pagination">
              <span>
                แสดง 1 - {Math.min(receiveTransactions.length, 10)} จาก{" "}
                {formatNumber(receiveTransactions.length)} รายการ
              </span>
              <div>
                <button type="button">‹</button>
                <button type="button" className="active">
                  1
                </button>
                <button type="button">2</button>
                <button type="button">3</button>
                <button type="button">›</button>
              </div>
            </div>
          </section>
        </div>
      </section>

      <Dialog open={Boolean(receiveImagePreview)} onOpenChange={(open) => { if (!open) setReceiveImagePreview(null); }}>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>{receiveImagePreview?.title || "รูปภาพสินค้า"}</DialogTitle>
            <DialogDescription>รูปสินค้าที่แนบไว้ตอนบันทึกรับเข้า</DialogDescription>
          </DialogHeader>

          {receiveImagePreview ? (
            <div className="receive-dialog-image">
              <img src={receiveImagePreview.src} alt={receiveImagePreview.title} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isReceivePanelOpen} onOpenChange={(open) => { if (!open) closeReceiveDialog(); }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>บันทึกรับเข้า</DialogTitle>
            <DialogDescription>เลือกวันที่รับเข้าเอง ระบบจะบันทึกเวลาทำรายการให้อัตโนมัติ</DialogDescription>
          </DialogHeader>

          <form className="receive-form" onSubmit={handleSubmit}>
            <div className="receive-form-grid">
              <label>
                <span>หมวดหลัก *</span>
                <ComboboxSelect
                  value={form.productImportType}
                  onValueChange={(value) =>
                    updateForm("productImportType", value as ProductImportType)
                  }
                  options={productImportTypeOptions}
                  searchPlaceholder="ค้นหาหมวดหลัก..."
                />
              </label>

              <label>
                <span>หมวดหมู่ *</span>
                <ComboboxInput
                  className={showMissingCategoryError ? "receive-input-error" : ""}
                  value={form.category}
                  onValueChange={handleReceiveCategoryChange}
                  options={receiveCategorySuggestions.map(({ category }) => ({
                    value: category,
                    label: category,
                  }))}
                  placeholder={
                    canCreateNewProduct
                      ? "พิมพ์หมวดหมู่ หรือเลือกจากรายการเดิม"
                      : "เลือกหมวดหมู่จากรายการเดิมก่อน"
                  }
                  searchPlaceholder="ค้นหาหรือพิมพ์หมวดหมู่..."
                  allowCustomValue={canCreateNewProduct}
                />
                {!isCategoryReady ? (
                  <small>กรุณาเลือกหมวดหลักและพิมพ์หรือเลือกหมวดหมู่ก่อน จึงจะกรอกข้อมูลส่วนอื่นได้</small>
                ) : showMissingCategoryError ? (
                  <small className="receive-field-error">ไม่มีสินค้านี้อยู่ในระบบ</small>
                ) : !canCreateNewProduct ? (
                  <small>พนักงานเลือกได้เฉพาะหมวดหมู่และสินค้าที่มีอยู่ในระบบแล้ว</small>
                ) : null}
              </label>
            </div>

            <div className="receive-form-grid">
              <label>
                <span>รายการสินค้า *</span>
                <ComboboxInput
                  className={showMissingProductError ? "receive-input-error" : ""}
                  value={form.name}
                  onValueChange={handleReceiveProductNameChange}
                  options={filteredReceiveProductSuggestions.map((item) => ({
                    value: item.name,
                    label: `${item.name}${item.sku ? ` (${item.sku})` : ""}`,
                  }))}
                  placeholder={
                    canCreateNewProduct
                      ? "พิมพ์ชื่อสินค้า หรือเลือกจากรายการเดิม"
                      : "เลือกสินค้าเดิมจากรายการเท่านั้น"
                  }
                  searchPlaceholder="ค้นหาหรือพิมพ์ชื่อสินค้า..."
                  allowCustomValue={canCreateNewProduct}
                  disabled={!isCategoryReady}
                />
                {!canCreateNewProduct ? (
                  showMissingProductError ? (
                    <small className="receive-field-error">ไม่มีสินค้านี้อยู่ในระบบ</small>
                  ) : (
                    <small>ถ้าไม่พบสินค้าในรายการ ต้องให้แอดมินหรือผู้จัดการเพิ่มสินค้าใหม่ก่อน</small>
                  )
                ) : null}
              </label>

              <label>
                <span>รหัสสินค้า</span>
                <input
                  value={form.sku}
                  onChange={(event) => updateForm("sku", sanitizeSku(event.target.value))}
                  placeholder="เช่น PC-HLD350-300"
                  inputMode="text"
                  disabled={!isCategoryReady || !canCreateNewProduct}
                />
              </label>
            </div>

            <div className="receive-form-grid">
              <label>
                <span>จำนวน *</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={(event) => updateForm("quantity", event.target.value)}
                  disabled={!isCategoryReady}
                  required
                />
              </label>

              <label>
                <span>หน่วย *</span>
                <input
                  value={form.unit}
                  onChange={(event) => updateForm("unit", event.target.value)}
                  placeholder="เช่น แผ่น / ถุง / ชิ้น"
                  disabled={!isCategoryReady || !canCreateNewProduct}
                  required
                />
              </label>
            </div>

            <div className="receive-form-grid">
              <label>
                <span>ต้นทุนต่อหน่วย *</span>
                <div className="cost-currency-control">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.costPrice}
                    onChange={(event) => updateForm("costPrice", event.target.value)}
                    disabled={!isCategoryReady}
                  />
                  <ComboboxSelect
                    value={form.costCurrency}
                    onValueChange={(value) =>
                      updateForm("costCurrency", value as CostCurrency)
                    }
                    disabled={!isCategoryReady}
                    options={costCurrencyOptions}
                    searchPlaceholder="ค้นหาสกุลเงิน..."
                  />
                </div>
              </label>

              <label>
                <span>จุดเก็บ / คลังย่อย</span>
                <ComboboxInput
                  value={form.requester}
                  onValueChange={(value) => updateForm("requester", value)}
                  options={receiveStorageLocationSuggestions.map((item) => ({
                    value: item,
                    label: item,
                  }))}
                  placeholder="เช่น A01 - ลานวางแผ่นพื้น"
                  searchPlaceholder="ค้นหาหรือพิมพ์จุดเก็บ..."
                  disabled={!isCategoryReady}
                />
              </label>
            </div>

            <div className="receive-form-grid">
              <label>
                <span>วันที่ผลิต</span>
                <input
                  type="date"
                  value={form.issueKey}
                  onChange={(event) => updateForm("issueKey", event.target.value)}
                  disabled={!isCategoryReady}
                />
              </label>

              <label>
                <span>วันหมดอายุ</span>
                <input
                  type="date"
                  value={form.expiryDate}
                  onChange={(event) => updateForm("expiryDate", event.target.value)}
                  disabled={!isCategoryReady}
                />
              </label>
            </div>

            <div className="receive-form-grid">
              <label>
                <span>วันที่รับเข้า *</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => updateForm("date", event.target.value)}
                  disabled={!isCategoryReady}
                  required
                />
                <small>ใช้วันที่นี้ในรายงาน สต็อก และกราฟภาพรวม</small>
              </label>

              <div className="receive-auto-time" aria-label="เวลาบันทึกอัตโนมัติ">
                <span>เวลาบันทึกอัตโนมัติ</span>
                <strong>{autoRecordTimeLabel}</strong>
                <small>ระบบเก็บจริงเมื่อกดบันทึกรายการ</small>
              </div>
            </div>

            <label>
              <span>หมายเหตุ</span>
              <input
                value={form.note}
                onChange={(event) => updateForm("note", event.target.value)}
                placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
                disabled={!isCategoryReady}
              />
            </label>

            <label>
              <span>รูปสินค้า</span>
              <input type="file" accept="image/*" onChange={handleProductImageChange} disabled={!isCategoryReady || !canCreateNewProduct} className="cursor-pointer file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
            </label>

            {form.imageDataUrl ? (
              <div className="receive-image-preview mt-1">
                <img src={form.imageDataUrl} alt={form.name || "รูปสินค้า"} className="rounded-lg object-cover max-h-48 w-full border" />
              </div>
            ) : null}

            <div className="receive-panel-actions">
              <Button type="button" variant="secondary" onClick={closeReceiveDialog} disabled={isSubmitting}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isSubmitting || !isCategoryReady}>
                {isSubmitting ? "กำลังบันทึก..." : "บันทึกรายการ"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
