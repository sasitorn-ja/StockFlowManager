export type TransactionType = "in" | "out";

export type Transaction = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  type: TransactionType;
  quantity: number;
  price: number;
  date: string;
  expiryDate: string;
  note: string;
  createdAt: number;
};

export type InventoryItem = {
  key: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  totalIn: number;
  totalOut: number;
  balance: number;
  price: number;
  nearestExpiryDate: string;
};

export type FormState = {
  name: string;
  sku: string;
  category: string;
  unit: string;
  type: TransactionType;
  quantity: string;
  price: string;
  date: string;
  expiryDate: string;
  note: string;
};

export type StatCard = {
  label: string;
  value: string;
  unit?: string;
  helper?: string;
  tone?: "sky" | "emerald" | "amber" | "violet";
};
