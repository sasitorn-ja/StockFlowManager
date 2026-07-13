export type TransactionType = "in" | "out";
export type ProductImportType = "resale" | "stable";
export type CostCurrency = "THB" | "JPY" | "CNY" | "USD";
export type TransactionStatus =
  | "pending"
  | "approved"
  | "issued"
  | "received"
  | "employee_confirmed"
  | "completed"
  | "cancelled";

export type Transaction = {
  id: string;
  name: string;
  sku: string;
  category: string;
  imageDataUrl?: string;
  productImportType: ProductImportType;
  unit: string;
  type: TransactionType;
  quantity: number;
  price: number;
  costPrice: number;
  costCurrency: CostCurrency;
  date: string;
  expiryDate: string;
  issueKey: string;
  requester?: string;
  createdBy?: string;
  approver?: string;
  note: string;
  createdAt: number;
  status?: TransactionStatus;
};

export type InventoryItem = {
  key: string;
  name: string;
  sku: string;
  category: string;
  imageDataUrl?: string;
  productImportType: ProductImportType;
  unit: string;
  totalIn: number;
  totalOut: number;
  balance: number;
  price: number;
  costPrice: number;
  costCurrency: CostCurrency;
  nearestExpiryDate: string;
};

export type InventoryLotItem = InventoryItem & {
  baseItemKey: string;
  createdAt: number;
  receivedDate: string;
  expiryDate: string;
};

export type ProductMaster = {
  id: string;
  name: string;
  sku: string;
  category: string;
  productImportType: ProductImportType;
  imageDataUrl?: string;
  unit: string;
  price: number;
  costPrice: number;
  costCurrency: CostCurrency;
  minStock: number;
  maxStock: number;
  defaultStorageLocation?: string;
  defaultExpiryDate?: string;
  vendor?: string;
  note?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
};
