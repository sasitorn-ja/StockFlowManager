import type { TransactionType, ProductImportType, CostCurrency } from "@/types/stock-flow";

export type FormState = {
  name: string;
  sku: string;
  category: string;
  imageDataUrl: string;
  productImportType: ProductImportType | "";
  unit: string;
  type: TransactionType;
  quantity: string;
  price: string;
  costPrice: string;
  costCurrency: CostCurrency;
  minStock: string;
  maxStock: string;
  date: string;
  expiryDate: string;
  issueKey: string;
  requester: string;
  note: string;
};
