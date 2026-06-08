import { EXPIRY_WARNING_DAYS } from "@/lib/stock-flow/constants";
import type { FormState, InventoryItem, Transaction } from "@/types/stock-flow";

export function createEmptyForm(): FormState {
  return {
    name: "",
    sku: "",
    category: "",
    unit: "",
    type: "in",
    quantity: "",
    price: "0",
    date: getLocalDateValue(),
    expiryDate: "",
    note: "",
  };
}

export function buildInventoryMap(transactions: Transaction[]) {
  return transactions.reduce((map, transaction) => {
    const itemKey = buildItemKey(transaction);
    const entry = map.get(itemKey) || {
      key: itemKey,
      name: transaction.name,
      sku: transaction.sku,
      category: transaction.category,
      unit: transaction.unit,
      totalIn: 0,
      totalOut: 0,
      balance: 0,
      price: transaction.price,
      nearestExpiryDate: "",
    };

    if (transaction.type === "in") {
      entry.totalIn += transaction.quantity;
      entry.balance += transaction.quantity;
    } else {
      entry.totalOut += transaction.quantity;
      entry.balance -= transaction.quantity;
    }

    if (transaction.price > 0) {
      entry.price = transaction.price;
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

export function buildItemKey(item: Pick<Transaction, "name" | "sku" | "unit">) {
  return `${item.name.toLowerCase()}::${item.sku.toLowerCase()}::${item.unit.toLowerCase()}`;
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

export function isExpiringSoon(dateString: string) {
  if (!dateString) {
    return false;
  }

  const daysLeft = getDaysUntil(dateString);
  return daysLeft <= EXPIRY_WARNING_DAYS;
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
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("th-TH").format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
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
