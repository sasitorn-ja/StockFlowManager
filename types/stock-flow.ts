export type TransactionType = "in" | "out";
export type ProductImportType = "resale" | "stable";

export type Transaction = {
  id: string;
  name: string;
  sku: string;
  category: string;
  productImportType: ProductImportType;
  unit: string;
  type: TransactionType;
  quantity: number;
  price: number;
  costPrice: number;
  date: string;
  expiryDate: string;
  issueKey: string;
  requester?: string;
  note: string;
  createdAt: number;
};

export type InventoryItem = {
  key: string;
  name: string;
  sku: string;
  category: string;
  productImportType: ProductImportType;
  unit: string;
  totalIn: number;
  totalOut: number;
  balance: number;
  price: number;
  costPrice: number;
  nearestExpiryDate: string;
};

export type FormState = {
  name: string;
  sku: string;
  category: string;
  productImportType: ProductImportType;
  unit: string;
  type: TransactionType;
  quantity: string;
  price: string;
  costPrice: string;
  date: string;
  expiryDate: string;
  issueKey: string;
  requester: string;
  note: string;
};

export type StatCard = {
  label: string;
  value: string;
  unit?: string;
  helper?: string;
  tone?: "sky" | "emerald" | "amber" | "violet";
};
