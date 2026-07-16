import { EXPIRY_WARNING_DAYS } from "@/lib/stock-flow/constants";
import type {
  CostCurrency,
  InventoryItem,
  InventoryLotItem,
  ProductImportType,
  Transaction,
  TransactionStatus,
  TransactionType,
  ProductMaster,
} from "@/types/stock-flow";
import type { FormState } from "@/app/(dashboard)/receive/types";

const productImportTypes = new Set<ProductImportType>(["resale", "stable"]);
const transactionTypes = new Set<TransactionType>(["in", "out"]);
const costCurrencies = new Set<CostCurrency>(["THB", "JPY", "CNY", "USD"]);
const transactionStatuses = new Set<TransactionStatus>([
  "pending",
  "approved",
  "issued",
  "received",
  "employee_confirmed",
  "completed",
  "cancelled",
]);

function toTransactionStatus(value: unknown): TransactionStatus | undefined {
  if (typeof value === "string" && transactionStatuses.has(value as TransactionStatus)) {
    return value as TransactionStatus;
  }
  return undefined;
}

export function createTransactionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `txn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toStringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumberValue(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toProductImportType(value: unknown): ProductImportType {
  return typeof value === "string" && productImportTypes.has(value as ProductImportType)
    ? (value as ProductImportType)
    : "resale";
}

function toTransactionType(value: unknown): TransactionType {
  return typeof value === "string" && transactionTypes.has(value as TransactionType)
    ? (value as TransactionType)
    : "in";
}

function toCostCurrency(value: unknown): CostCurrency {
  return typeof value === "string" && costCurrencies.has(value as CostCurrency)
    ? (value as CostCurrency)
    : "THB";
}

export function getProductImportTypeLabel(type?: ProductImportType) {
  return type === "stable" ? "สินค้าเข้าสต็อก" : "ซื้อมาขายไป";
}

export function getCostCurrencyLabel(currency?: CostCurrency) {
  switch (currency) {
    case "JPY":
      return "เยน";
    case "CNY":
      return "หยวน";
    case "USD":
      return "ดอลลาร์";
    default:
      return "บาท";
  }
}

export function createEmptyForm(): FormState {
  return {
    name: "",
    sku: "",
    category: "",
    imageDataUrl: "",
    productImportType: "",
    unit: "",
    type: "in",
    quantity: "",
    price: "0",
    costPrice: "0",
    costCurrency: "THB",
    date: getLocalDateValue(),
    expiryDate: "",
    issueKey: "",
    requester: "",
    note: "",
  };
}

export function normalizeTransactions(value: unknown): Transaction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => {
      const quantity = Math.max(0, Math.floor(toNumberValue(item.quantity)));
      const createdAt = toNumberValue(item.createdAt, Date.now());

      return {
        id: toStringValue(item.id) || createTransactionId(),
        name: toStringValue(item.name).trim(),
        sku: toStringValue(item.sku).trim(),
        category: toStringValue(item.category).trim() || "-",
        imageDataUrl: toStringValue(item.imageDataUrl).trim(),
        productImportType: toProductImportType(item.productImportType),
        unit: toStringValue(item.unit).trim(),
        type: toTransactionType(item.type),
        quantity,
        price: Math.max(0, toNumberValue(item.price)),
        costPrice: Math.max(0, toNumberValue(item.costPrice)),
        costCurrency: toCostCurrency(item.costCurrency),
        date: toStringValue(item.date) || getLocalDateValue(),
        expiryDate: toStringValue(item.expiryDate),
        issueKey: toStringValue(item.issueKey).trim(),
        requester: toStringValue(item.requester).trim(),
        createdBy: toStringValue(item.createdBy).trim(),
        approver: toStringValue(item.approver).trim(),
        approvedAt: Math.max(0, toNumberValue(item.approvedAt)),
        note: toStringValue(item.note).trim(),
        createdAt,
        status: toTransactionStatus(item.status),
      };
    })
    .filter((item) => item.name && item.unit && item.quantity > 0);
}

export function buildInventoryMap(transactions: Transaction[]) {
  return transactions.reduce((map, transaction) => {
    const itemKey = buildItemKey(transaction);
    const entry = map.get(itemKey) || {
      key: itemKey,
      name: transaction.name,
      sku: transaction.sku,
      category: transaction.category,
      imageDataUrl: transaction.imageDataUrl,
      productImportType: transaction.productImportType ?? "resale",
      unit: transaction.unit,
      totalIn: 0,
      totalOut: 0,
      balance: 0,
      price: transaction.price,
      costPrice: transaction.costPrice ?? 0,
      costCurrency: transaction.costCurrency ?? "THB",
      nearestExpiryDate: "",
    };

    if (transaction.type === "in") {
      entry.totalIn += transaction.quantity;
      entry.balance += transaction.quantity;
    } else {
      // Deduct from balance for all withdrawal (out) statuses except cancelled (reservation model)
      if (transaction.status !== "cancelled") {
        entry.totalOut += transaction.quantity;
        entry.balance -= transaction.quantity;
      }
    }

    if (transaction.price > 0) {
      entry.price = transaction.price;
    }

    if (transaction.imageDataUrl) {
      entry.imageDataUrl = transaction.imageDataUrl;
    }

    if ((transaction.costPrice ?? 0) > 0) {
      entry.costPrice = transaction.costPrice;
      entry.costCurrency = transaction.costCurrency ?? "THB";
    }

    if (
      transaction.expiryDate &&
      (!entry.nearestExpiryDate || transaction.expiryDate < entry.nearestExpiryDate)
    ) {
      entry.nearestExpiryDate = transaction.expiryDate;
    }

    map.set(itemKey, entry);
    return map;
  }, new Map<string, InventoryItem>());
}

export function buildInventoryLotMap(transactions: Transaction[]) {
  const lotMap = new Map<string, InventoryLotItem>();
  const sortedTransactions = transactions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const lotsByItemKey = new Map<string, InventoryLotItem[]>();

  sortedTransactions.forEach((transaction) => {
    const baseItemKey = buildItemKey(transaction);

    if (transaction.type === "in") {
      const expiryDate = transaction.expiryDate || "";
      const lotKey = buildInventoryLotKey(transaction);
      const entry = lotMap.get(lotKey) || {
        key: lotKey,
        baseItemKey,
        name: transaction.name,
        sku: transaction.sku,
        category: transaction.category,
        imageDataUrl: transaction.imageDataUrl,
        productImportType: transaction.productImportType ?? "resale",
        unit: transaction.unit,
        totalIn: 0,
        totalOut: 0,
        balance: 0,
        price: transaction.price,
        costPrice: transaction.costPrice ?? 0,
        costCurrency: transaction.costCurrency ?? "THB",
        nearestExpiryDate: expiryDate,
        expiryDate,
        createdAt: transaction.createdAt,
        receivedDate: transaction.date,
        storageLocation: transaction.requester?.trim() || "",
      };

      entry.totalIn += transaction.quantity;
      entry.balance += transaction.quantity;

      if (transaction.price > 0) {
        entry.price = transaction.price;
      }

      if ((transaction.costPrice ?? 0) > 0) {
        entry.costPrice = transaction.costPrice;
        entry.costCurrency = transaction.costCurrency ?? "THB";
      }

      if (transaction.imageDataUrl) {
        entry.imageDataUrl = transaction.imageDataUrl;
      }

      if (!entry.storageLocation && transaction.requester?.trim()) {
        entry.storageLocation = transaction.requester.trim();
      }

      if (!entry.receivedDate || transaction.date < entry.receivedDate) {
        entry.receivedDate = transaction.date;
      }

      if (transaction.createdAt < entry.createdAt) {
        entry.createdAt = transaction.createdAt;
      }

      lotMap.set(lotKey, entry);
      if (!lotsByItemKey.has(baseItemKey)) {
        lotsByItemKey.set(baseItemKey, []);
      }
      if (!lotsByItemKey.get(baseItemKey)?.includes(entry)) {
        lotsByItemKey.get(baseItemKey)?.push(entry);
      }
      return;
    }

    if (transaction.status === "cancelled") {
      return;
    }

    let remainingQuantity = transaction.quantity;
    const candidateLots = lotsByItemKey.get(baseItemKey) || [];

    const deductFromLot = (lot: InventoryLotItem) => {
      if (remainingQuantity <= 0 || lot.balance <= 0) {
        return;
      }

      const deducted = Math.min(lot.balance, remainingQuantity);
      lot.balance -= deducted;
      lot.totalOut += deducted;
      remainingQuantity -= deducted;
    };

    const exactLot = lotMap.get(buildInventoryLotKey(transaction));
    if (exactLot) {
      deductFromLot(exactLot);
    }

    if (remainingQuantity > 0) {
      candidateLots.forEach((lot) => {
        if (lot !== exactLot && lot.expiryDate === transaction.expiryDate) {
          deductFromLot(lot);
        }
      });
    }

    if (remainingQuantity > 0) {
      candidateLots.forEach((lot) => {
        if (lot !== exactLot && lot.expiryDate !== transaction.expiryDate) {
          deductFromLot(lot);
        }
      });
    }
  });

  return lotMap;
}

export function buildItemKey(
  item: Pick<Transaction, "name" | "sku" | "unit"> & Partial<Pick<Transaction, "productImportType">>
) {
  return `${item.productImportType ?? "resale"}::${item.name.toLowerCase()}::${item.sku.toLowerCase()}::${item.unit.toLowerCase()}`;
}

export function buildInventoryLotKey(
  item: Pick<Transaction, "name" | "sku" | "unit" | "expiryDate" | "costPrice" | "costCurrency"> &
    Partial<Pick<Transaction, "productImportType">>
) {
  const costPrice = Math.max(0, Number(item.costPrice || 0));
  return `${buildItemKey(item)}::${item.expiryDate || "no-expiry"}::${item.costCurrency || "THB"}::${costPrice}`;
}

export function matchesMasterProduct(
  item: Pick<Transaction, "name" | "sku" | "category" | "productImportType" | "unit">,
  product: Pick<ProductMaster, "name" | "sku" | "category" | "productImportType" | "unit">
) {
  const itemSku = item.sku.trim().toLowerCase();
  const productSku = product.sku.trim().toLowerCase();

  if (itemSku && productSku) {
    return itemSku === productSku;
  }

  return (
    item.name.trim().toLowerCase() === product.name.trim().toLowerCase() &&
    item.category.trim().toLowerCase() === product.category.trim().toLowerCase() &&
    item.productImportType === product.productImportType &&
    item.unit.trim().toLowerCase() === product.unit.trim().toLowerCase()
  );
}

export type StockTargetStatus = "missing" | "low" | "normal" | "high";

export function getStockTargetStatus(
  balance: number,
  minStock?: number,
  maxStock?: number
): StockTargetStatus {
  const safeMin = Math.max(0, Number(minStock || 0));
  const safeMax = Math.max(0, Number(maxStock || 0));

  if (safeMin <= 0 && safeMax <= 0) {
    return "missing";
  }

  if (safeMin > 0 && balance < safeMin) {
    return "low";
  }

  if (safeMax > 0 && balance > safeMax) {
    return "high";
  }

  return "normal";
}

export function sanitizeSku(value: string) {
  return value.replace(/[^A-Za-z0-9\-_.\/]/g, "");
}

export function getLocalDateValue() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

export function addDays(dateString: string, days: number) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getDaysUntil(dateString: string) {
  const today = new Date(getLocalDateValue());
  const target = new Date(dateString);
  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function isExpiringSoon(dateString: string, warningDays = EXPIRY_WARNING_DAYS) {
  if (!dateString) {
    return false;
  }

  const daysLeft = getDaysUntil(dateString);
  return daysLeft <= warningDays;
}

export function compareExpiryDate(dateA: string, dateB: string) {
  if (!dateA && !dateB) {
    return 0;
  }

  if (!dateA) {
    return 1;
  }

  if (!dateB) {
    return -1;
  }

  return dateA.localeCompare(dateB);
}

export function formatCurrency(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;

  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(safeValue);
}

export function formatCurrencyWithLabel(value: number, currency?: CostCurrency) {
  return `${formatNumber(value)} ${getCostCurrencyLabel(currency)}`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("th-TH").format(Number.isFinite(value) ? value : 0);
}

export function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDaysLeft(days: number) {
  if (days < 0) {
    return `หมดอายุแล้ว ${formatNumber(Math.abs(days))} วัน`;
  }

  if (days === 0) {
    return "หมดอายุวันนี้";
  }

  return `อีก ${formatNumber(days)} วัน`;
}
