"use client";

import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  FileImage,
  FileText,
  Filter,
  Minus,
  Plus,
  Save,
  Search,
} from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import {
  getClientAppSettings,
  getClientSession,
  invalidateClientMasterProductsCache,
} from "@/lib/dashboard-client-cache";
import { Button } from "@/components/ui/button";
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
  buildInventoryLotMap,
  buildInventoryLotKey,
  createEmptyForm,
  createTransactionId,
  getLocalDateValue,
  formatDate,
  formatNumber,
  formatCurrencyWithLabel,
  getProductImportTypeLabel,
  getStockTargetStatus,
  sanitizeSku,
  matchesMasterProduct,
} from "@/lib/stock-flow/utils";
import type { Transaction, CostCurrency, ProductImportType, ProductMaster } from "@/types/stock-flow";
import type { FormState } from "./types";
import { useTransactions } from "../TransactionContext";
import { defaultAppSettings, type AppSettings } from "@/lib/app-settings-shared";

type OverviewFilter = "all" | ProductImportType;
type ReceiveView = "receipts" | "inventory";
type UserRole = "employee" | "manager" | "admin";
type ReceiveComboboxKey = "productImportType" | "category" | "product" | "storageLocation";
type ReceiveProductSuggestion = {
  key: string;
  masterProductId?: string;
  name: string;
  sku: string;
  category: string;
  imageDataUrl?: string;
  productImportType: ProductImportType;
  unit: string;
  price: number;
  costPrice: number;
  costCurrency: CostCurrency;
  minStock: number;
  maxStock: number;
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
  const [currentRole, setCurrentRole] = useState<UserRole>("employee");
  const [isRoleLoaded, setIsRoleLoaded] = useState(false);
  const [masterProducts, setMasterProducts] = useState<ProductMaster[]>([]);
  const [categoryCatalog, setCategoryCatalog] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [receiveFilter, setReceiveFilter] = useState<OverviewFilter>("all");
  const [activeView, setActiveView] = useState<ReceiveView>("inventory");
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [isReceivePanelOpen, setIsReceivePanelOpen] = useState(false);
  const [receiveImagePreview, setReceiveImagePreview] = useState<{ src: string; title: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoRecordTime, setAutoRecordTime] = useState(Date.now());
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);
  const [openReceiveCombobox, setOpenReceiveCombobox] = useState<ReceiveComboboxKey | null>(null);

  const inventory = useMemo(() => [...buildInventoryMap(transactions).values()], [transactions]);

  const lotLabels = useMemo(() => {
    const lots = Array.from(buildInventoryLotMap(transactions).values()).sort(
      (a, b) =>
        getProductImportTypeLabel(a.productImportType).localeCompare(
          getProductImportTypeLabel(b.productImportType),
          "th"
        ) ||
        a.name.localeCompare(b.name, "th") ||
        a.receivedDate.localeCompare(b.receivedDate) ||
        a.expiryDate.localeCompare(b.expiryDate) ||
        a.createdAt - b.createdAt
    );
    const counters = new Map<string, number>();
    const labels = new Map<string, string>();

    lots.forEach((lot) => {
      const sequence = (counters.get(lot.baseItemKey) ?? 0) + 1;
      counters.set(lot.baseItemKey, sequence);
      labels.set(lot.key, `ล็อต ${sequence}`);
    });

    return labels;
  }, [transactions]);

  const inventoryRows = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return inventory
      .filter((item) => {
        if (receiveFilter !== "all" && item.productImportType !== receiveFilter) {
          return false;
        }

        const haystack = `${item.name} ${item.sku} ${item.category}`.toLowerCase();
        return haystack.includes(normalizedSearchTerm);
      })
      .map((item) => {
        const matchedProduct = masterProducts.find((product) => matchesMasterProduct(item, product));
        const minStock = matchedProduct?.minStock ?? 0;
        const maxStock = matchedProduct?.maxStock ?? 0;

        return {
          ...item,
          minStock,
          maxStock,
          stockTargetStatus: getStockTargetStatus(item.balance, minStock, maxStock),
        };
      })
      .sort((a, b) => {
        const statusPriority = { low: 0, high: 1, normal: 2, missing: 3 } as const;
        return (
          statusPriority[a.stockTargetStatus] - statusPriority[b.stockTargetStatus] ||
          getProductImportTypeLabel(a.productImportType).localeCompare(
            getProductImportTypeLabel(b.productImportType),
            "th"
          ) ||
          a.name.localeCompare(b.name, "th")
        );
      });
  }, [inventory, masterProducts, receiveFilter, searchTerm]);

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

        const lotKey = buildInventoryLotKey(item);
        const haystack = `${item.name} ${item.sku} ${item.category} ${item.note} ${lotLabels.get(lotKey) || ""}`.toLowerCase();
        return haystack.includes(normalizedSearchTerm);
      })
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [lotLabels, receiveFilter, searchTerm, transactions]);

  const receiveProductSuggestions = useMemo<ReceiveProductSuggestion[]>(() => {
    const inactiveMasterProducts = masterProducts.filter((item) => !item.isActive);
    const inventorySuggestions = inventory
      .filter(
        (item) =>
          !inactiveMasterProducts.some((product) => matchesMasterProduct(item, product))
      )
      .map((item) => {
        const masterProduct = masterProducts.find(
          (product) => product.isActive && matchesMasterProduct(item, product)
        );

        return {
          key: `inventory-${item.key}`,
          masterProductId: masterProduct?.id,
          name: item.name,
          sku: item.sku,
          category: item.category,
          imageDataUrl: item.imageDataUrl || "",
          productImportType: item.productImportType,
          unit: item.unit,
          price: item.price,
          costPrice: item.costPrice ?? 0,
          costCurrency: item.costCurrency ?? "THB",
          minStock: masterProduct?.minStock ?? 0,
          maxStock: masterProduct?.maxStock ?? 0,
          defaultStorageLocation: masterProduct?.defaultStorageLocation || "",
        };
      });

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
        masterProductId: item.id,
        name: item.name,
        sku: item.sku,
        category: item.category,
        imageDataUrl: item.imageDataUrl || "",
        productImportType: item.productImportType,
        unit: item.unit,
        price: item.price ?? 0,
        costPrice: item.costPrice ?? 0,
        costCurrency: item.costCurrency ?? "THB",
        minStock: item.minStock ?? 0,
        maxStock: item.maxStock ?? 0,
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
    () => {
      const recordTime = new Date(autoRecordTime);
      const dateLabel = recordTime.toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const timeLabel = recordTime.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      });

      return `${dateLabel} · ${timeLabel}`;
    },
    [autoRecordTime]
  );
  const hasSelectedProductType = Boolean(form.productImportType);
  const isCategoryReady = Boolean(form.productImportType && form.category.trim());
  const canCreateNewProduct = currentRole === "admin";
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
    const loadCurrentRole = () => {
      const storedRole = localStorage.getItem("current_role");

      if (storedRole === "admin" || storedRole === "manager" || storedRole === "employee") {
        setCurrentRole(storedRole);
        return;
      }

      setCurrentRole("employee");
    };

    loadCurrentRole();
    getClientSession()
      .then((data) => {
        const role = data?.user?.role;
        setCurrentRole(role === "admin" || role === "manager" ? role : "employee");
      })
      .catch(() => setCurrentRole("employee"))
      .finally(() => setIsRoleLoaded(true));
    window.addEventListener("current-user-changed", loadCurrentRole);

    return () => window.removeEventListener("current-user-changed", loadCurrentRole);
  }, []);

  useEffect(() => {
    async function fetchMasterProducts() {
      try {
        const res = await fetch(withBasePath("/api/master-products"));
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
    getClientAppSettings()
      .then((settings) => setAppSettings(settings))
      .catch(() => setAppSettings(defaultAppSettings));
    fetch(withBasePath("/api/categories"), { cache: "no-store" })
      .then((response) => response.ok ? response.json() : [])
      .then((data) => setCategoryCatalog(Array.isArray(data) ? data : []))
      .catch(() => setCategoryCatalog([]));
  }, []);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleReceiveComboboxOpenChange(key: ReceiveComboboxKey, open: boolean) {
    if (open) {
      setOpenReceiveCombobox(key);
      return;
    }

    setOpenReceiveCombobox((current) => (current === key ? null : current));
  }

  function handleProductImportTypeChange(value: ProductImportType) {
    setOpenReceiveCombobox(null);
    setForm((current) => ({
      ...current,
      productImportType: value,
      category: "",
      name: "",
      sku: "",
      imageDataUrl: "",
      unit: "",
      price: "0",
      costPrice: "0",
      costCurrency: "THB",
      minStock: "0",
      maxStock: "0",
      requester: "",
      expiryDate: "",
      issueKey: "",
      note: "",
    }));
  }

  function applyProductImage(file?: File) {
    if (!file) {
      updateForm("imageDataUrl", "");
      return;
    }

    if (!file.type.startsWith("image/")) {
      window.alert("อัปโหลดได้เฉพาะไฟล์รูปภาพ");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      window.alert("ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      updateForm("imageDataUrl", result);
    };
    reader.readAsDataURL(file);
  }

  function handleProductImageChange(event: ChangeEvent<HTMLInputElement>) {
    applyProductImage(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleProductImageDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (!isCategoryReady || !canCreateNewProduct) return;
    applyProductImage(event.dataTransfer.files?.[0]);
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
        minStock: "0",
        maxStock: "0",
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
        const isMinStockUnchanged = current.minStock === String(prevMatchedItem.minStock ?? 0);
        const isMaxStockUnchanged = current.maxStock === String(prevMatchedItem.maxStock ?? 0);
        const isImageUnchanged = (current.imageDataUrl || "") === (prevMatchedItem.imageDataUrl || "");

        updatedFields = {
          sku: isSkuUnchanged ? "" : current.sku,
          category: isCategoryUnchanged ? "" : current.category,
          unit: isUnitUnchanged ? "" : current.unit,
          costPrice: isCostPriceUnchanged ? "0" : current.costPrice,
          price: isPriceUnchanged ? "0" : current.price,
          costCurrency: isCurrencyUnchanged ? "THB" : current.costCurrency,
          minStock: isMinStockUnchanged ? "0" : current.minStock,
          maxStock: isMaxStockUnchanged ? "0" : current.maxStock,
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
          minStock: String(matchedItem.minStock ?? 0),
          maxStock: String(matchedItem.maxStock ?? 0),
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
    setOpenReceiveCombobox(null);
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
      minStock:
        current.name &&
        filteredReceiveProductSuggestions.some(
          (item) => item.name.trim().toLowerCase() === current.name.trim().toLowerCase()
        )
          ? current.minStock
          : "0",
      maxStock:
        current.name &&
        filteredReceiveProductSuggestions.some(
          (item) => item.name.trim().toLowerCase() === current.name.trim().toLowerCase()
        )
          ? current.maxStock
          : "0",
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
      setOpenReceiveCombobox(null);
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

  async function handleReceiveExport() {
    const rows = receiveTransactions.map((item, index) => {
      const lotKey = buildInventoryLotKey(item);

      return {
        "เลขที่รับเข้า": `${appSettings.receivePrefix || "IN"}-${item.date.replaceAll("-", "")}-${String(index + 1).padStart(3, "0")}`,
        "ล็อต": lotLabels.get(lotKey) || "-",
        "วันที่รับเข้า": formatDate(item.date),
        "เวลาบันทึก": new Date(item.createdAt).toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        "วันหมดอายุ": item.expiryDate ? formatDate(item.expiryDate) : "-",
        "จุดเก็บ / คลังย่อย": item.requester || "-",
        "รายการสินค้า": item.name,
        "รหัสสินค้า": item.sku || "-",
        "จำนวน": item.quantity,
        "หน่วย": item.unit,
        "ต้นทุนต่อหน่วย": item.costPrice || item.price || 0,
        "สกุลเงิน": item.costCurrency || "THB",
        "มูลค่ารวมตามสกุล": item.quantity * (item.costPrice || item.price || 0),
        "หมายเหตุ": item.note || "-",
      };
    });

    if (rows.length === 0) {
      window.alert("ยังไม่มีรายการรับเข้าสินค้าที่พร้อมส่งออก");
      return;
    }

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Receive");
    const headers = Object.keys(rows[0]);

    worksheet.addRow(headers);
    rows.forEach((row) => {
      worksheet.addRow(headers.map((header) => row[header as keyof typeof row]));
    });

    worksheet.columns.forEach((column) => {
      let maxLength = 16;
      column?.eachCell?.({ includeEmpty: true }, (cell) => {
        const cellLength = String(cell.value ?? "").length;
        if (cellLength > maxLength) {
          maxLength = cellLength;
        }
      });
      if (column) {
        column.width = Math.min(maxLength + 2, 40);
      }
    });

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `receive-transactions-${getLocalDateValue()}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const quantity = Number(form.quantity);
    const price = Number(form.price || 0);
    const costPrice = Number(form.costPrice || 0);
    const minStock = Math.max(0, Math.floor(Number(form.minStock || 0)));
    const maxStock = Math.max(0, Math.floor(Number(form.maxStock || 0)));

    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(price) ||
      !Number.isFinite(costPrice) ||
      !Number.isFinite(minStock) ||
      !Number.isFinite(maxStock)
    ) {
      window.alert("กรอกจำนวน ราคา ต้นทุน และค่า min / max เป็นตัวเลขที่ถูกต้องก่อนบันทึก");
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      window.alert("จำนวนสินค้าต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป");
      return;
    }

    if (maxStock > 0 && minStock > maxStock) {
      window.alert("จำนวนขั้นต่ำ (min) ต้องไม่มากกว่าจำนวนสูงสุด (max)");
      return;
    }

    if (!canCreateNewProduct && !matchedReceiveProduct) {
      window.alert("พนักงานรับเข้าได้เฉพาะสินค้าที่มีอยู่ในระบบแล้ว กรุณาเลือกจากรายการเดิม");
      return;
    }

    if (!form.productImportType) {
      window.alert("เลือกประเภทสินค้าก่อนบันทึกรับเข้า");
      return;
    }

    const baseProduct = matchedReceiveProduct;
    const selectedProductImportType = form.productImportType;

    const transaction: Transaction = {
      id: createTransactionId(),
      name: (baseProduct?.name ?? form.name).trim(),
      sku: sanitizeSku((baseProduct?.sku ?? form.sku).trim()),
      category: (baseProduct?.category ?? form.category).trim() || "-",
      imageDataUrl: baseProduct?.imageDataUrl || form.imageDataUrl,
      productImportType: baseProduct?.productImportType ?? selectedProductImportType,
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

    const inactiveProduct = masterProducts.find(
      (product) => !product.isActive && matchesMasterProduct(transaction, product)
    );

    if (inactiveProduct) {
      window.alert(`สินค้า "${inactiveProduct.name}" ถูกปิดใช้งาน กรุณาเปิดใช้งานใน ข้อมูลหลักสินค้า ก่อนรับเข้า`);
      return;
    }

    if (!transaction.name || !transaction.unit || quantity <= 0) {
      window.alert("กรอกข้อมูลสินค้า หน่วยนับ และจำนวนให้ครบก่อนบันทึก");
      return;
    }

    setIsSubmitting(true);
    try {
      const categoryExists = categoryCatalog.some(
        (category) => normalizeCategoryValue(category) === normalizeCategoryValue(transaction.category)
      );
      if (!categoryExists && transaction.category !== "-") {
        const categoryResponse = await fetch(withBasePath("/api/categories"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: transaction.category }),
        });
        if (!categoryResponse.ok) throw new Error("Unable to save category");
        setCategoryCatalog((current) => [...new Set([...current, transaction.category])]);
      }

      const existingMasterProduct = masterProducts.find((product) =>
        matchesMasterProduct(transaction, product)
      );
      if (!existingMasterProduct) {
        const productResponse = await fetch(withBasePath("/api/master-products"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...transaction,
            minStock,
            maxStock,
            defaultStorageLocation: transaction.requester,
            defaultExpiryDate: transaction.expiryDate,
            isActive: true,
          }),
        });
        if (!productResponse.ok) {
          const detail = await productResponse.json().catch(() => null);
          throw new Error(detail?.error || "Unable to save product master");
        }
      } else if (
        existingMasterProduct.minStock !== minStock ||
        existingMasterProduct.maxStock !== maxStock
      ) {
        const productResponse = await fetch(withBasePath("/api/master-products"), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...existingMasterProduct,
            minStock,
            maxStock,
          }),
        });
        if (!productResponse.ok) {
          const detail = await productResponse.json().catch(() => null);
          throw new Error(detail?.error || "Unable to update product min / max");
        }
      }

      const response = await fetch(withBasePath("/api/transactions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transaction),
      });
      if (!response.ok) throw new Error("Unable to save stock receipt");
      invalidateClientMasterProductsCache();
      const refreshedProductsResponse = await fetch(withBasePath("/api/master-products"), {
        cache: "no-store",
      });
      if (refreshedProductsResponse.ok) {
        const refreshedProducts = (await refreshedProductsResponse.json()) as ProductMaster[];
        if (Array.isArray(refreshedProducts)) setMasterProducts(refreshedProducts);
      }
      await refresh();
      closeReceiveDialog();
    } catch (error) {
      console.error("Submit error:", error);
      window.alert(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึกรับเข้า");
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentReceiveFilterLabel =
    filterOptions.find((item) => item.value === receiveFilter)?.label ?? "ทั้งหมด";
  const receiveCurrencies = useMemo(
    () =>
      Array.from(
        new Set(
          receiveTransactions
            .map((item) => item.costCurrency || "THB")
            .filter(Boolean)
        )
      ),
    [receiveTransactions]
  );

  if (!isRoleLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--text-muted)]">
        กำลังตรวจสอบสิทธิ์...
      </div>
    );
  }

  if (currentRole !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="dashboard-card max-w-[480px] p-8 text-center shadow-xl backdrop-blur-xl">
          <h3 className="text-lg font-bold text-[var(--text-strong)]">ปฏิเสธการเข้าถึง</h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            การรับสินค้าเข้าคลังเป็นหน้าที่ของแอดมินเท่านั้น
          </p>
          <div className="mt-6">
            <Button type="button" onClick={() => window.location.assign(withBasePath("/issue"))}>
              ไปหน้าเบิกจ่ายสินค้า
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <section id="receive" className="receive-page">
        <div className="receive-main">
          <div className="receive-header">
            <div>
              <h2>คลังสินค้าและรับเข้า</h2>
              <p>หน้าเดียวสำหรับดูสินค้าในคลังและบันทึกรับเข้าสินค้า</p>
            </div>
            <div className="receive-header-actions">
              <Button type="button" onClick={openReceiveDialog}>
                <Plus size={17} />
                บันทึกรับเข้า
              </Button>
            </div>
          </div>

          <section className="receive-table-card">
            <div className="receive-view-tabs" role="tablist" aria-label="มุมมองคลังสินค้า">
              <button
                type="button"
                className={activeView === "inventory" ? "active" : ""}
                onClick={() => setActiveView("inventory")}
              >
                สินค้าในคลัง
              </button>
              <button
                type="button"
                className={activeView === "receipts" ? "active" : ""}
                onClick={() => setActiveView("receipts")}
              >
                ประวัติรับเข้า
              </button>
            </div>
            <div className="receive-table-toolbar">
              <label className="overview-search">
                <Search size={17} />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={activeView === "receipts" ? "ค้นหาเลขที่รับเข้า, ล็อต, รหัสสินค้า..." : "ค้นหาชื่อสินค้า รหัส หรือหมวดหมู่..."}
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
                {activeView === "receipts" ? (
                  <Button type="button" variant="secondary" size="sm" onClick={handleReceiveExport}>
                    <FileText size={15} />
                    ส่งออก
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="receive-table-note">
              {activeView === "receipts"
                ? `แสดงล็อตและมูลค่าตามสกุลของแต่ละรายการ${receiveCurrencies.length > 1 ? ` · มี ${receiveCurrencies.join(", ")}` : ""}`
                : `แสดงสินค้าในคลัง ${formatNumber(inventoryRows.length)} รายการ พร้อมสถานะ min / max`}
            </div>

            <div className="overview-table-wrap">
              {activeView === "receipts" ? (
                <table className="overview-table receive-table">
                  <thead>
                    <tr>
                      <th>เลขที่รับเข้า / ล็อต</th>
                      <th>รูปภาพสินค้า</th>
                      <th>วันที่รับเข้า / เวลาบันทึก</th>
                      <th>จุดเก็บ / คลังย่อย</th>
                      <th>รายการสินค้า</th>
                      <th>จำนวนรายการ</th>
                      <th>ต้นทุนต่อหน่วย</th>
                      <th>มูลค่ารวมตามสกุล</th>
                      <th>หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiveTransactions.length > 0 ? (
                      receiveTransactions.map((item, index) => {
                        const receiveNo = `${appSettings.receivePrefix || "IN"}-${item.date.replaceAll("-", "")}-${String(
                          index + 1
                        ).padStart(3, "0")}`;
                        const lotKey = buildInventoryLotKey(item);
                        const lotLabel = lotLabels.get(lotKey) || "-";
                        const totalValue = item.quantity * (item.costPrice || item.price || 0);

                        return (
                          <tr key={`receive-${item.id}`}>
                            <td>
                              <strong className="sku-cell">{receiveNo}</strong>
                              <span>{lotLabel}{item.expiryDate ? ` · หมดอายุ ${formatDate(item.expiryDate)}` : " · ไม่มีวันหมดอายุ"}</span>
                            </td>
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
                                  aria-label={`ดูรูปสินค้า ${item.name || receiveNo}`}
                                >
                                  <img
                                    src={item.imageDataUrl}
                                    alt={item.name || receiveNo}
                                    className="receive-table-image"
                                  />
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
                            <td>
                              <strong>{formatCurrencyWithLabel(item.costPrice || item.price || 0, item.costCurrency)}</strong>
                              <span>ต่อ {item.unit}</span>
                            </td>
                            <td>
                              <strong>{formatCurrencyWithLabel(totalValue, item.costCurrency)}</strong>
                              <span>{formatNumber(item.quantity)} {item.unit}</span>
                            </td>
                            <td>{item.note || "-"}</td>
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
              ) : (
                <table className="overview-table receive-table inventory-inline-table">
                  <thead>
                    <tr>
                      <th>สินค้า</th>
                      <th>ประเภท / หมวดหมู่</th>
                      <th>คงเหลือ</th>
                      <th>รับเข้า / เบิกจ่าย</th>
                      <th>min / max</th>
                      <th>สถานะ</th>
                      <th>หมดอายุใกล้สุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryRows.length > 0 ? (
                      inventoryRows.map((item) => (
                        <tr key={`inventory-${item.key}`}>
                          <td>
                            <strong>{item.name}</strong>
                            <span>{item.sku || "ไม่มีรหัสสินค้า"} · {item.unit}</span>
                          </td>
                          <td>
                            <strong>{getProductImportTypeLabel(item.productImportType)}</strong>
                            <span>{item.category}</span>
                          </td>
                          <td>
                            <strong>{formatNumber(item.balance)} {item.unit}</strong>
                            <span>คงเหลือปัจจุบัน</span>
                          </td>
                          <td>
                            <strong>เข้า {formatNumber(item.totalIn)} / ออก {formatNumber(item.totalOut)}</strong>
                            <span>รวมทุกความเคลื่อนไหว</span>
                          </td>
                          <td>
                            <strong>{formatNumber(item.minStock)} / {formatNumber(item.maxStock)}</strong>
                            <span>{item.unit}</span>
                          </td>
                          <td>
                            <span className={`stock-pill ${
                              item.stockTargetStatus === "low"
                                ? "stock-pill-danger"
                                : item.stockTargetStatus === "high"
                                  ? "stock-pill-warn"
                                  : item.stockTargetStatus === "normal"
                                    ? "stock-pill-ok"
                                    : ""
                            }`}>
                              {item.stockTargetStatus === "low"
                                ? "ต่ำกว่า min"
                                : item.stockTargetStatus === "high"
                                  ? "สูงกว่า max"
                                  : item.stockTargetStatus === "normal"
                                    ? "อยู่ในช่วง"
                                    : "ยังไม่ตั้งค่า"}
                            </span>
                          </td>
                          <td>{item.nearestExpiryDate ? formatDate(item.nearestExpiryDate) : "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7}>
                          <div className="empty-state">ไม่พบสินค้าในคลังที่ตรงกับตัวกรอง</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="overview-pagination">
              <span>
                {activeView === "receipts"
                  ? `แสดง 1 - ${Math.min(receiveTransactions.length, 10)} จาก ${formatNumber(receiveTransactions.length)} รายการ`
                  : `แสดงสินค้าในคลัง ${formatNumber(inventoryRows.length)} รายการ`}
              </span>
              {activeView === "receipts" ? <div>
                <button type="button">‹</button>
                <button type="button" className="active">
                  1
                </button>
                <button type="button">2</button>
                <button type="button">3</button>
                <button type="button">›</button>
              </div> : null}
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
        <DialogContent className="receive-entry-dialog flex max-h-[calc(100dvh-24px)] flex-col overflow-hidden sm:max-h-[88vh] sm:max-w-[900px]">
          <DialogHeader className="receive-dialog-header">
            <div className="min-w-0">
              <DialogTitle>บันทึกรับเข้า</DialogTitle>
              <DialogDescription>เลือกวันที่รับเข้าเอง ระบบจะบันทึกเวลาทำรายการให้อัตโนมัติ</DialogDescription>
            </div>
            <div className="receive-auto-time" aria-label="วันและเวลาบันทึกอัตโนมัติ">
              <CalendarDays size={16} aria-hidden="true" />
              <span>วัน/เวลาบันทึก</span>
              <strong>{autoRecordTimeLabel}</strong>
            </div>
          </DialogHeader>

          <form className="receive-form" onSubmit={handleSubmit}>
            <div className="receive-form-scroll">
            <div className="receive-form-grid">
              <label>
                <span>ประเภทสินค้า *</span>
                <ComboboxInput
                  value={form.productImportType}
                  onValueChange={(value) => handleProductImportTypeChange(value as ProductImportType)}
                  open={openReceiveCombobox === "productImportType"}
                  onOpenChange={(open) => handleReceiveComboboxOpenChange("productImportType", open)}
                  options={productImportTypeOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  placeholder="เลือกประเภทสินค้าก่อน"
                  portalled={false}
                  searchPlaceholder="ค้นหาประเภทสินค้า..."
                  allowCustomValue={false}
                />
              </label>

              <label>
                <span>หมวดหมู่ *</span>
                <ComboboxInput
                  className={showMissingCategoryError ? "receive-input-error" : ""}
                  value={form.category}
                  onValueChange={handleReceiveCategoryChange}
                  open={openReceiveCombobox === "category"}
                  onOpenChange={(open) => handleReceiveComboboxOpenChange("category", open)}
                  options={receiveCategorySuggestions.map(({ category, productCount }) => ({
                    value: category,
                    label: `${category} ${productCount > 0 ? `${formatNumber(productCount)} รายการ` : "0 รายการ"}`,
                  }))}
                  placeholder={
                    canCreateNewProduct
                      ? "พิมพ์หมวดหมู่ใหม่ได้เลย หรือเลือกจากรายการเดิม"
                      : "เลือกหมวดหมู่จากรายการเดิมก่อน"
                  }
                  portalled={false}
                  searchPlaceholder="ค้นหาหรือพิมพ์หมวดหมู่..."
                  emptyText="ไม่พบหมวดหมู่ในระบบ"
                  allowCustomValue={canCreateNewProduct}
                  disabled={!hasSelectedProductType}
                />
              </label>
              {!hasSelectedProductType ? (
                <small className="receive-grid-helper">ขั้นตอนที่ 1: เลือกประเภทสินค้าก่อน แล้วระบบจะปลดล็อกช่องหมวดหมู่</small>
              ) : !isCategoryReady ? (
                <small className="receive-grid-helper">ขั้นตอนที่ 2: เปิด dropdown แล้วเลือกหมวดเดิม หรือพิมพ์เพิ่มหมวดใหม่ได้ทันที</small>
              ) : showMissingCategoryError ? (
                <small className="receive-grid-helper receive-field-error">ไม่มีสินค้านี้อยู่ในระบบ</small>
              ) : !canCreateNewProduct ? (
                <small className="receive-grid-helper">พนักงานเลือกได้เฉพาะหมวดหมู่และสินค้าที่มีอยู่ในระบบแล้ว</small>
              ) : (
                <small className="receive-grid-helper">แอดมินสามารถเลือกจาก dropdown หรือพิมพ์ชื่อหมวดใหม่ แล้วกดใช้ค่านั้นได้เลย</small>
              )}
            </div>

            <div className="receive-form-grid">
              <label>
                <span>รายการสินค้า *</span>
                <ComboboxInput
                  className={showMissingProductError ? "receive-input-error" : ""}
                  value={form.name}
                  onValueChange={handleReceiveProductNameChange}
                  open={openReceiveCombobox === "product"}
                  onOpenChange={(open) => handleReceiveComboboxOpenChange("product", open)}
                  options={filteredReceiveProductSuggestions.map((item) => ({
                    value: item.name,
                    label: item.sku ? `${item.name} (${item.sku} · ${item.unit})` : `${item.name} (${item.unit})`,
                  }))}
                  placeholder={
                    canCreateNewProduct
                      ? "พิมพ์ชื่อสินค้าได้ทันที"
                      : "พิมพ์เพื่อค้นหาสินค้าเดิม"
                  }
                  portalled={false}
                  searchPlaceholder={
                    canCreateNewProduct
                      ? "พิมพ์ชื่อสินค้าใหม่ หรือค้นหาจากรายการเดิม..."
                      : "ค้นหาสินค้าเดิมในระบบ..."
                  }
                  emptyText="ไม่พบสินค้าที่ตรงกับเงื่อนไข"
                  allowCustomValue={canCreateNewProduct}
                  disabled={!isCategoryReady}
                />
                {!canCreateNewProduct ? (
                  showMissingProductError ? (
                    <small className="receive-field-error">ไม่มีสินค้านี้อยู่ในระบบ</small>
                  ) : (
                    <small>ถ้าไม่พบสินค้าในรายการ ต้องให้ผู้ดูแลระบบเพิ่มสินค้าใหม่ก่อน</small>
                  )
                ) : (
                  <small>พิมพ์ชื่อสินค้าใหม่ได้ทันที หรือเลือกชื่อสินค้าที่ระบบแนะนำ</small>
                )}
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

            <div className="receive-form-grid receive-form-grid-compact">
              <label>
                <span>จำนวน *</span>
                <div className="receive-quantity-stepper">
                  <button
                    type="button"
                    aria-label="ลดจำนวน"
                    disabled={!isCategoryReady || Number(form.quantity || 1) <= 1}
                    onClick={() => updateForm("quantity", String(Math.max(1, Number(form.quantity || 1) - 1)))}
                  >
                    <Minus size={17} />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={form.quantity}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "" || /^\d+$/.test(value)) updateForm("quantity", value);
                    }}
                    disabled={!isCategoryReady}
                    required
                  />
                  <button
                    type="button"
                    aria-label="เพิ่มจำนวน"
                    disabled={!isCategoryReady}
                    onClick={() => updateForm("quantity", String(Number(form.quantity || 0) + 1))}
                  >
                    <Plus size={17} />
                  </button>
                </div>
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
                  <select
                    value={form.costCurrency}
                    onChange={(event) =>
                      updateForm("costCurrency", event.target.value as CostCurrency)
                    }
                    disabled={!isCategoryReady}
                    aria-label="สกุลเงินของล็อตที่รับเข้า"
                  >
                    {costCurrencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <small>เลือกสกุลเงินสำหรับล็อตรับเข้ารอบนี้ได้อย่างอิสระ</small>
              </label>

              <label>
                <span>จุดเก็บ / คลังย่อย</span>
                <ComboboxInput
                  value={form.requester}
                  onValueChange={(value) => updateForm("requester", value)}
                  open={openReceiveCombobox === "storageLocation"}
                  onOpenChange={(open) => handleReceiveComboboxOpenChange("storageLocation", open)}
                  options={receiveStorageLocationSuggestions.map((item) => ({
                    value: item,
                    label: item,
                  }))}
                  placeholder="โปรดเลือกจุดเก็บ"
                  portalled={false}
                  searchPlaceholder="ค้นหาหรือพิมพ์จุดเก็บ..."
                  disabled={!isCategoryReady}
                />
              </label>
            </div>

            <div className="receive-form-grid receive-stock-target-grid">
              <label>
                <span>จำนวนขั้นต่ำ (min)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={form.minStock}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "" || /^\d+$/.test(value)) updateForm("minStock", value);
                  }}
                  placeholder="0"
                  disabled={!isCategoryReady}
                />
                <small>แจ้งเตือนเมื่อจำนวนคงเหลือต่ำกว่าค่านี้</small>
              </label>

              <label>
                <span>จำนวนสูงสุด (max)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={form.maxStock}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "" || /^\d+$/.test(value)) updateForm("maxStock", value);
                  }}
                  placeholder="0"
                  disabled={!isCategoryReady}
                />
                <small>ใช้เปรียบเทียบเพดานสต็อก โดยกำหนด 0 หากไม่ต้องการตั้งค่า</small>
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

            <div className="receive-form-grid receive-form-grid-half">
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

            </div>

            <label className="receive-note-field">
              <span>หมายเหตุ</span>
              <textarea
                value={form.note}
                onChange={(event) => updateForm("note", event.target.value)}
                placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
                disabled={!isCategoryReady}
                maxLength={255}
                rows={2}
              />
              <small className="receive-note-count">{form.note.length} / 255</small>
            </label>

            <div className="receive-upload-field">
              <span>รูปสินค้า</span>
              <label
                className={`receive-upload-dropzone ${!isCategoryReady || !canCreateNewProduct ? "is-disabled" : ""}`}
                htmlFor="receive-product-image"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleProductImageDrop}
              >
                {form.imageDataUrl ? (
                  <img src={form.imageDataUrl} alt={form.name || "รูปสินค้า"} />
                ) : (
                  <span className="receive-upload-icon"><FileImage size={22} /></span>
                )}
                <span className="receive-upload-copy">
                  <strong>{form.imageDataUrl ? "เลือกไฟล์ใหม่" : "เลือกไฟล์"}</strong> หรือลากไฟล์มาวางที่นี่
                  <small>รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 5MB</small>
                </span>
                <span className="receive-upload-button">เลือกไฟล์</span>
              </label>
              <input
                id="receive-product-image"
                type="file"
                accept="image/*"
                onChange={handleProductImageChange}
                disabled={!isCategoryReady || !canCreateNewProduct}
                className="sr-only"
              />
            </div>
            </div>

            <div className="receive-panel-actions">
              <Button type="submit" disabled={isSubmitting || !isCategoryReady}>
                <Save size={17} /> {isSubmitting ? "กำลังบันทึก..." : "บันทึกรายการ"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
