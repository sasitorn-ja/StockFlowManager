"use client";

import type { FormEvent, MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ChevronRight,
  Clock3,
  ClipboardPlus,
  Database,
  Filter,
  FileText,
  History,
  Home,
  Layers3,
  Menu,
  PackageCheck,
  PackageMinus,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";

import { DataPanel } from "@/components/stock-flow/DataPanel";
import { IssueTypeCombobox } from "@/components/stock-flow/IssueTypeCombobox";
import { StatusBadge } from "@/components/stock-flow/StatusBadge";
import { StockForm } from "@/components/stock-flow/StockForm";
import { StatsGrid } from "@/components/stock-flow/StatsGrid";
import { Table } from "@/components/stock-flow/Table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LOW_STOCK_THRESHOLD, STORAGE_KEY } from "@/lib/stock-flow/constants";
import {
  buildInventoryMap,
  buildItemKey,
  compareExpiryDate,
  createEmptyForm,
  createTransactionId,
  addDays,
  formatCurrency,
  formatCurrencyWithLabel,
  formatDate,
  formatDaysLeft,
  formatNumber,
  getProductImportTypeLabel,
  getDaysUntil,
  getLocalDateValue,
  isExpiringSoon,
  normalizeTransactions,
} from "@/lib/stock-flow/utils";
import type {
  CostCurrency,
  FormState,
  InventoryItem,
  ProductImportType,
  StatCard,
  Transaction,
} from "@/types/stock-flow";

const inputClassName = "control-input";
const productImportTypes: { type: ProductImportType; label: string }[] = [
  { type: "resale", label: "ซื้อมาขายไป" },
  { type: "stable", label: "สินค้า stable" },
];
const overviewFilterOptions: { value: OverviewFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "resale", label: "สินค้าซื้อมาขายไป" },
  { value: "stable", label: "สินค้า stable" },
];
const issueFilterOptions: { value: OverviewFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "resale", label: "ซื้อมาขายไป" },
  { value: "stable", label: "สินค้า stable" },
];
const costCurrencyOptions: { value: CostCurrency; label: string }[] = [
  { value: "THB", label: "บาท" },
  { value: "JPY", label: "เยน" },
  { value: "CNY", label: "หยวน" },
  { value: "USD", label: "ดอลลาร์" },
];

type ProductEditForm = {
  name: string;
  sku: string;
  category: string;
  productImportType: ProductImportType;
  unit: string;
  price: string;
  costPrice: string;
  expiryDate: string;
};

type IssueDeliveryDocument = {
  transaction: Transaction;
  transactions: Transaction[];
  rows: {
    transaction: Transaction;
    beforeBalance: number;
    afterBalance: number;
    costValue: number;
  }[];
  beforeBalance: number;
  afterBalance: number;
  costValue: number;
  documentNo: string;
  approvedDate: string;
};

type OverviewFilter = "all" | ProductImportType;

const navigationItems = [
  { label: "รับเข้าสินค้า", href: "#receive", icon: ClipboardPlus, type: "section" as const },
  { label: "เบิกจ่ายสินค้า", href: "#issue", icon: PackageMinus, type: "section" as const },
  { label: "รายการสินค้า", href: "#settings", icon: Database, type: "section" as const },
  { label: "ประวัติรายการ", href: "#history", icon: History, type: "section" as const },
  { label: "ใกล้หมดสต๊อก / โครงการ", href: "#expiring", icon: Clock3, type: "section" as const },
  { label: "ตั้งค่า", href: "#settings", icon: Settings, type: "section" as const },
];

const sectionItems = navigationItems.filter((item) => item.type === "section");
const sectionIds = ["import", "delivery-note", ...sectionItems.map((item) => item.href.slice(1))];

function buildStats(inventory: InventoryItem[], transactions: Transaction[]): StatCard[] {
  const today = getLocalDateValue();
  const receivedToday = transactions
    .filter((item) => item.type === "in" && item.date === today)
    .reduce((sum, item) => sum + item.quantity, 0);
  const issuedToday = transactions
    .filter((item) => item.type === "out" && item.date === today)
    .reduce((sum, item) => sum + item.quantity, 0);
  const totalBalance = inventory.reduce((sum, item) => sum + item.balance, 0);
  const totalCostValue = inventory.reduce(
    (sum, item) => sum + item.balance * (item.costPrice ?? 0),
    0
  );
  const expiringSoonCount = inventory.filter((item) => isExpiringSoon(item.nearestExpiryDate)).length;

  return [
    {
      label: "จำนวนสินค้า",
      value: formatNumber(inventory.length),
      unit: "รายการ",
      helper: "นับเฉพาะกลุ่มนี้",
      tone: "sky",
    },
    {
      label: "คงเหลือรวม",
      value: formatNumber(totalBalance),
      unit: "หน่วย",
      helper: "ยอดคงเหลือของกลุ่มนี้",
      tone: "emerald",
    },
    {
      label: "ใกล้หมดอายุ",
      value: formatNumber(expiringSoonCount),
      unit: "รายการ",
      helper: "ภายใน 90 วันจากวันนี้",
      tone: "amber",
    },
    {
      label: "รับเข้าวันนี้",
      value: formatNumber(receivedToday),
      unit: "หน่วย",
      helper: "อ้างอิงจากวันที่รายการ",
      tone: "sky",
    },
    {
      label: "มูลค่าต้นทุน",
      value: formatCurrency(totalCostValue),
      helper: "คงเหลือ x ราคาต้นทุนของกลุ่มนี้",
      tone: "violet",
    },
    {
      label: "จ่ายออกวันนี้",
      value: formatNumber(issuedToday),
      unit: "หน่วย",
      helper: "อ้างอิงจากวันที่รายการ",
      tone: "amber",
    },
  ];
}

export default function HomePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [isReady, setIsReady] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isReceivePanelOpen, setIsReceivePanelOpen] = useState(false);
  const [isIssuePanelOpen, setIsIssuePanelOpen] = useState(false);
  const [isEditProductDialogOpen, setIsEditProductDialogOpen] = useState(false);
  const [pendingIssueTransaction, setPendingIssueTransaction] = useState<Transaction | null>(null);
  const [pendingIssueBatch, setPendingIssueBatch] = useState<Transaction[]>([]);
  const [isPendingIssueApproved, setIsPendingIssueApproved] = useState(false);
  const [approvedDate, setApprovedDate] = useState("");
  const [isApprovalDetailOpen, setIsApprovalDetailOpen] = useState(false);
  const [deliveryDocument, setDeliveryDocument] = useState<IssueDeliveryDocument | null>(null);
  const [selectedImportType, setSelectedImportType] = useState<ProductImportType>("resale");
  const [overviewFilter, setOverviewFilter] = useState<OverviewFilter>("all");
  const [receiveFilter, setReceiveFilter] = useState<OverviewFilter>("all");
  const [issueImportTypeFilter, setIssueImportTypeFilter] = useState<OverviewFilter>("all");
  const [issuePanelImportType, setIssuePanelImportType] = useState<ProductImportType | "">("");
  const [issueSelections, setIssueSelections] = useState<Record<string, string>>({});
  const [issueRequester, setIssueRequester] = useState("");
  const [issueApprover, setIssueApprover] = useState("");
  const [issueApproverEmail, setIssueApproverEmail] = useState("");
  const [issueNote, setIssueNote] = useState("");
  const [isSendingIssueEmail, setIsSendingIssueEmail] = useState(false);
  const [isIssueTypeFilterOpen, setIsIssueTypeFilterOpen] = useState(false);
  const [overviewDateFrom, setOverviewDateFrom] = useState(() => addDays(getLocalDateValue(), -6));
  const [overviewDateTo, setOverviewDateTo] = useState(getLocalDateValue);
  const [activeSection, setActiveSection] = useState(sectionIds[0]);
  const [editingItemKey, setEditingItemKey] = useState("");
  const [productEditForm, setProductEditForm] = useState<ProductEditForm>({
    name: "",
    sku: "",
    category: "",
    productImportType: "resale",
    unit: "",
    price: "0",
    costPrice: "0",
    expiryDate: "",
  });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setTransactions(normalizeTransactions(JSON.parse(saved)));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }, [isReady, transactions]);

  useEffect(() => {
    function syncActiveSection() {
      const currentHash = window.location.hash.slice(1);

      if (sectionIds.includes(currentHash)) {
        setActiveSection(currentHash);
      }
    }

    syncActiveSection();
    window.addEventListener("hashchange", syncActiveSection);

    return () => {
      window.removeEventListener("hashchange", syncActiveSection);
    };
  }, []);

  const inventory = useMemo(() => [...buildInventoryMap(transactions).values()], [transactions]);

  const productImportGroups = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return productImportTypes.map((group) => {
      const groupInventory = inventory.filter(
        (item) => (item.productImportType ?? "resale") === group.type
      );
      const groupTransactions = transactions.filter(
        (item) => (item.productImportType ?? "resale") === group.type
      );
      const filteredInventory = groupInventory.filter((item) => {
        const haystack = `${item.name} ${item.sku}`.toLowerCase();
        return haystack.includes(normalizedSearchTerm);
      });
      const priorityItems = groupInventory
        .filter((item) => item.balance > 0 && isExpiringSoon(item.nearestExpiryDate))
        .sort((a, b) => compareExpiryDate(a.nearestExpiryDate, b.nearestExpiryDate));

      return {
        ...group,
        inventory: groupInventory,
        transactions: groupTransactions,
        filteredInventory,
        priorityItems,
        stats: buildStats(groupInventory, groupTransactions),
      };
    });
  }, [inventory, searchTerm, transactions]);

  const selectedProductImportGroup =
    productImportGroups.find((group) => group.type === selectedImportType) ?? productImportGroups[0];

  const latestTransactionByItemKey = useMemo(() => {
    return transactions.reduce((map, transaction) => {
      const itemKey = buildItemKey(transaction);
      const current = map.get(itemKey);

      if (!current || transaction.createdAt > current.createdAt) {
        map.set(itemKey, transaction);
      }

      return map;
    }, new Map<string, Transaction>());
  }, [transactions]);

  const filteredTransactionsByDate = useMemo(() => {
    return transactions.filter((item) => item.date >= overviewDateFrom && item.date <= overviewDateTo);
  }, [overviewDateFrom, overviewDateTo, transactions]);

  const filteredOverviewInventory = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const baseInventory =
      overviewFilter === "resale" || overviewFilter === "stable"
        ? inventory.filter((item) => item.productImportType === overviewFilter)
        : inventory;

    return baseInventory.filter((item) => {
      const haystack = `${item.name} ${item.sku} ${item.category}`.toLowerCase();
      const latestTransaction = latestTransactionByItemKey.get(item.key);
      const matchesSearch = haystack.includes(normalizedSearchTerm);
      const matchesDate = latestTransaction
        ? latestTransaction.date >= overviewDateFrom && latestTransaction.date <= overviewDateTo
        : true;

      return matchesSearch && matchesDate;
    });
  }, [inventory, latestTransactionByItemKey, overviewDateFrom, overviewDateTo, overviewFilter, searchTerm]);

  const overviewStats = useMemo(() => {
    const totalBalance = filteredOverviewInventory.reduce((sum, item) => sum + item.balance, 0);
    const totalStockValue = filteredOverviewInventory.reduce(
      (sum, item) => sum + item.balance * item.price,
      0
    );
    const lowStockCount = filteredOverviewInventory.filter(
      (item) => item.balance <= LOW_STOCK_THRESHOLD
    ).length;
    const receivedInRange = filteredTransactionsByDate
      .filter((item) => item.type === "in")
      .reduce((sum, item) => sum + item.quantity, 0);
    const issuedInRange = filteredTransactionsByDate
      .filter((item) => item.type === "out")
      .reduce((sum, item) => sum + item.quantity, 0);

    return [
      {
        label: "จำนวนสินค้า",
        value: formatNumber(filteredOverviewInventory.length),
        unit: "รายการ",
        helper: "ตามช่วงวันที่ที่เลือก",
        icon: Layers3,
        tone: "sky" as const,
      },
      {
        label: "คงเหลือรวม",
        value: formatNumber(totalBalance),
        unit: "หน่วย",
        helper: `มูลค่ารวม ${formatCurrency(totalStockValue)}`,
        icon: PackageCheck,
        tone: "emerald" as const,
      },
      {
        label: "รายการใกล้หมด",
        value: formatNumber(lowStockCount),
        unit: "รายการ",
        helper: "ต่ำกว่าจุดสั่งซื้อ",
        icon: AlertTriangle,
        tone: "amber" as const,
      },
      {
        label: "รับเข้าในช่วงนี้",
        value: formatNumber(receivedInRange),
        unit: "หน่วย",
        helper: `${filteredTransactionsByDate.filter((item) => item.type === "in").length} รายการ`,
        icon: ArrowDownToLine,
        tone: "sky" as const,
      },
      {
        label: "เบิกจ่ายในช่วงนี้",
        value: formatNumber(issuedInRange),
        unit: "หน่วย",
        helper: `${filteredTransactionsByDate.filter((item) => item.type === "out").length} รายการ`,
        icon: ArrowUpFromLine,
        tone: "violet" as const,
      },
      {
        label: "มูลค่าสต๊อก",
        value: formatCurrency(totalStockValue),
        helper: "อ้างอิงราคาขายคงเหลือ",
        icon: Database,
        tone: "sky" as const,
      },
    ];
  }, [filteredOverviewInventory, filteredTransactionsByDate]);

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

  const receiveSummary = useMemo(() => {
    const quantity = Number(form.quantity);
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
    const currentItem = inventory.find(
      (item) =>
        item.productImportType === form.productImportType &&
        item.name.trim().toLowerCase() === form.name.trim().toLowerCase() &&
        item.sku.trim().toLowerCase() === form.sku.trim().toLowerCase() &&
        item.unit.trim().toLowerCase() === form.unit.trim().toLowerCase()
    );
    const beforeBalance = currentItem?.balance ?? 0;

    return {
      beforeBalance,
      receiveQuantity: safeQuantity,
      afterBalance: beforeBalance + safeQuantity,
    };
  }, [form.name, form.productImportType, form.quantity, form.sku, form.unit, inventory]);

  const issueListItems = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return inventory
      .filter((item) => {
        if (item.balance <= 0) {
          return false;
        }

        if (issueImportTypeFilter !== "all" && item.productImportType !== issueImportTypeFilter) {
          return false;
        }

        const haystack = `${item.name} ${item.sku} ${item.category}`.toLowerCase();
        return haystack.includes(normalizedSearchTerm);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [inventory, issueImportTypeFilter, searchTerm]);

  const issueInventoryOptions = useMemo(() => {
    return inventory
      .filter(
        (item) =>
          (item.productImportType ?? "resale") === form.productImportType && item.balance > 0
      )
      .sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [form.productImportType, inventory]);

  const issuePanelInventoryItems = useMemo(() => {
    return inventory
      .filter((item) => {
        if (item.balance <= 0) {
          return false;
        }

        if (!issuePanelImportType) {
          return false;
        }

        return item.productImportType === issuePanelImportType;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [inventory, issuePanelImportType]);

  const selectedIssueEntries = useMemo(
    () =>
      Object.entries(issueSelections)
        .map(([itemKey, quantity]) => {
          const item = inventory.find((candidate) => candidate.key === itemKey);
          return item ? { item, quantity } : null;
        })
        .filter((entry): entry is { item: InventoryItem; quantity: string } => Boolean(entry)),
    [inventory, issueSelections]
  );

  const issueOverview = useMemo(() => {
    const today = getLocalDateValue();
    const issueTransactions = transactions
      .filter((item) => item.type === "out")
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);

    return {
      transactions: issueTransactions,
      totalRequests: issueTransactions.length,
      totalQuantity: issueTransactions.reduce((sum, item) => sum + item.quantity, 0),
      totalCostValue: issueTransactions.reduce(
        (sum, item) => sum + item.quantity * (item.costPrice ?? 0),
        0
      ),
      todayRequests: issueTransactions.filter((item) => item.date === today).length,
      latest: issueTransactions.slice(0, 4),
    };
  }, [transactions]);

  const issueHistoryStats: StatCard[] = useMemo(
    () => [
      {
        label: "ใบเบิกทั้งหมด",
        value: formatNumber(issueOverview.totalRequests),
        unit: "รายการ",
        helper: "นับจากรายการจ่ายออกทั้งหมด",
        tone: "amber",
      },
      {
        label: "ใบเบิกวันนี้",
        value: formatNumber(issueOverview.todayRequests),
        unit: "รายการ",
        helper: "อ้างอิงจากวันที่รายการ",
        tone: "sky",
      },
      {
        label: "จำนวนที่เบิกรวม",
        value: formatNumber(issueOverview.totalQuantity),
        unit: "หน่วย",
        helper: "รวมจำนวนสินค้าที่จ่ายออก",
        tone: "emerald",
      },
      {
        label: "มูลค่าต้นทุนเบิก",
        value: formatCurrency(issueOverview.totalCostValue),
        helper: "จำนวนเบิก x ราคาต้นทุน",
        tone: "violet",
      },
    ],
    [issueOverview]
  );

  const pendingIssueStatus = useMemo(() => {
    if (!pendingIssueTransaction) {
      return null;
    }

    const currentItem = inventory.find(
      (item) => item.key === buildItemKey(pendingIssueTransaction)
    );
    const beforeBalance = currentItem?.balance ?? 0;
    const issueQuantity = pendingIssueTransaction.quantity;
    const afterBalance = beforeBalance - issueQuantity;
    const costValue = issueQuantity * (pendingIssueTransaction.costPrice ?? 0);

    return {
      beforeBalance,
      issueQuantity,
      afterBalance,
      costValue,
      stats: [
        {
          label: "คงเหลือก่อนนำออก",
          value: formatNumber(beforeBalance),
          unit: pendingIssueTransaction.unit,
          helper: "ยอดในสต๊อกปัจจุบัน",
          tone: "sky" as const,
        },
        {
          label: "จำนวนที่ขอเบิก",
          value: formatNumber(issueQuantity),
          unit: pendingIssueTransaction.unit,
          helper: pendingIssueTransaction.issueKey || "ไม่มี Key เบิกสินค้า",
          tone: "amber" as const,
        },
        {
          label: "คงเหลือหลังนำออก",
          value: formatNumber(afterBalance),
          unit: pendingIssueTransaction.unit,
          helper: afterBalance < 0 ? "ยอดไม่พอสำหรับเบิก" : "ยอดหลังยืนยันใบเบิก",
          tone: afterBalance <= LOW_STOCK_THRESHOLD ? "amber" as const : "emerald" as const,
        },
        {
          label: "มูลค่าต้นทุนรวม",
          value: formatCurrency(costValue),
          helper: "จำนวนเบิก x ราคาต้นทุน",
          tone: "violet" as const,
        },
      ],
    };
  }, [inventory, pendingIssueTransaction]);

  const pendingIssueBatchStatus = useMemo(() => {
    if (pendingIssueBatch.length === 0) {
      return null;
    }

    const rows = pendingIssueBatch.map((transaction) => {
      const currentItem = inventory.find((item) => item.key === buildItemKey(transaction));
      const beforeBalance = currentItem?.balance ?? 0;
      const afterBalance = beforeBalance - transaction.quantity;
      const costValue = transaction.quantity * (transaction.costPrice ?? 0);

      return {
        transaction,
        beforeBalance,
        afterBalance,
        costValue,
      };
    });
    const totalQuantity = rows.reduce((sum, row) => sum + row.transaction.quantity, 0);
    const totalCostValue = rows.reduce((sum, row) => sum + row.costValue, 0);
    const hasInsufficientStock = rows.some((row) => row.afterBalance < 0);

    return {
      rows,
      totalQuantity,
      totalCostValue,
      hasInsufficientStock,
      stats: [
        {
          label: "รายการขอเบิก",
          value: formatNumber(rows.length),
          unit: "รายการ",
          helper: "รอตรวจสอบก่อนตัดสต๊อก",
          tone: "sky" as const,
        },
        {
          label: "จำนวนที่ขอเบิกรวม",
          value: formatNumber(totalQuantity),
          unit: "หน่วย",
          helper: pendingIssueBatch[0]?.issueKey || "รอบเบิกสินค้า",
          tone: "amber" as const,
        },
        {
          label: "สถานะสต๊อก",
          value: hasInsufficientStock ? "ยอดไม่พอ" : "พร้อมเบิก",
          helper: hasInsufficientStock ? "มีบางรายการคงเหลือไม่พอ" : "ทุกสินค้ามียอดพอ",
          tone: hasInsufficientStock ? "amber" as const : "emerald" as const,
        },
        {
          label: "มูลค่าต้นทุนรวม",
          value: formatCurrency(totalCostValue),
          helper: "รวมทุกสกุลแบบตัวเลขอ้างอิง",
          tone: "violet" as const,
        },
      ],
    };
  }, [inventory, pendingIssueBatch]);

  const pendingIssueCanConfirm =
    (Boolean(pendingIssueTransaction) || pendingIssueBatch.length > 0) &&
    Boolean(isPendingIssueApproved) &&
    (pendingIssueBatchStatus
      ? !pendingIssueBatchStatus.hasInsufficientStock
      : (pendingIssueStatus?.afterBalance ?? -1) >= 0);

  const pendingApprovalDetails = useMemo(() => {
    if (pendingIssueBatchStatus) {
      return pendingIssueBatchStatus.rows.map((row) => ({
        issueKey: row.transaction.issueKey || "-",
        requester: row.transaction.requester || "-",
        approver: row.transaction.approver || "-",
        approvedDate: approvedDate || getLocalDateValue(),
      }));
    }

    if (pendingIssueTransaction) {
      return [
        {
          issueKey: pendingIssueTransaction.issueKey || "-",
          requester: pendingIssueTransaction.requester || "-",
          approver: pendingIssueTransaction.approver || "-",
          approvedDate: approvedDate || getLocalDateValue(),
        },
      ];
    }

    return [];
  }, [approvedDate, pendingIssueBatchStatus, pendingIssueTransaction]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateProductEditForm<K extends keyof ProductEditForm>(
    key: K,
    value: ProductEditForm[K]
  ) {
    setProductEditForm((current) => ({ ...current, [key]: value }));
  }

  function approvePendingIssue() {
    setIsPendingIssueApproved(true);
    setApprovedDate(getLocalDateValue());
    setIsApprovalDetailOpen(false);
  }

  function openEditProductDialog(item: InventoryItem) {
    setEditingItemKey(item.key);
    setProductEditForm({
      name: item.name,
      sku: item.sku,
      category: item.category,
      productImportType: item.productImportType,
      unit: item.unit,
      price: String(item.price),
      costPrice: String(item.costPrice ?? 0),
      expiryDate: item.nearestExpiryDate,
    });
    setIsEditProductDialogOpen(true);
  }

  function handleProductEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextName = productEditForm.name.trim();
    const nextUnit = productEditForm.unit.trim();
    const nextPrice = Number(productEditForm.price || 0);
    const nextCostPrice = Number(productEditForm.costPrice || 0);

    if (!nextName || !nextUnit) {
      window.alert("กรอกชื่อสินค้าและหน่วยนับให้ครบก่อนบันทึก");
      return;
    }

    if (!Number.isFinite(nextPrice) || !Number.isFinite(nextCostPrice)) {
      window.alert("กรอกราคาและราคาต้นทุนเป็นตัวเลขที่ถูกต้องก่อนบันทึก");
      return;
    }

    setTransactions((current) =>
      current.map((transaction) => {
        if (buildItemKey(transaction) !== editingItemKey) {
          return transaction;
        }

        return {
          ...transaction,
          name: nextName,
          sku: productEditForm.sku.trim(),
          category: productEditForm.category.trim() || "-",
          productImportType: productEditForm.productImportType,
          unit: nextUnit,
          price: Math.max(0, nextPrice),
          costPrice: Math.max(0, nextCostPrice),
          expiryDate: productEditForm.expiryDate,
        };
      })
    );
    setIsEditProductDialogOpen(false);
    setEditingItemKey("");
  }

  function handleIssueInventorySelect(itemKey: string) {
    const selectedItem = inventory.find((item) => item.key === itemKey);

    if (!selectedItem) {
      return;
    }

    setForm((current) => ({
      ...current,
      name: selectedItem.name,
      sku: selectedItem.sku,
      category: selectedItem.category,
      productImportType: selectedItem.productImportType,
      unit: selectedItem.unit,
      price: String(selectedItem.price),
      costPrice: String(selectedItem.costPrice ?? 0),
      costCurrency: selectedItem.costCurrency ?? "THB",
      expiryDate: selectedItem.nearestExpiryDate,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const quantity = Number(form.quantity);
    const price = Number(form.price || 0);
    const costPrice = Number(form.costPrice || 0);

    if (!Number.isFinite(quantity) || !Number.isFinite(price) || !Number.isFinite(costPrice)) {
      window.alert("กรอกจำนวน ราคา และราคาต้นทุนเป็นตัวเลขที่ถูกต้องก่อนบันทึก");
      return;
    }

    const transaction: Transaction = {
      id: createTransactionId(),
      name: form.name.trim(),
      sku: form.sku.trim(),
      category: form.category.trim() || "-",
      productImportType: form.productImportType,
      unit: form.unit.trim(),
      type: form.type,
      quantity,
      price: Math.max(0, price),
      costPrice: Math.max(0, costPrice),
      costCurrency: form.costCurrency,
      date: form.date,
      expiryDate: form.expiryDate,
      issueKey: form.type === "out" ? form.issueKey.trim() : "",
      requester: form.type === "out" ? form.requester.trim() : "",
      note: form.note.trim(),
      createdAt: Date.now(),
    };

    if (!transaction.name || !transaction.unit || quantity <= 0) {
      window.alert("กรอกข้อมูลสินค้า หน่วยนับ และจำนวนให้ครบก่อนบันทึก");
      return;
    }

    if (transaction.type === "out" && !transaction.requester) {
      window.alert("กรอกชื่อผู้ขอเบิกสินค้าก่อนบันทึก");
      return;
    }

    if (transaction.type === "out") {
      const currentItem = buildInventoryMap(transactions).get(buildItemKey(transaction));
      const available = currentItem?.balance ?? 0;

      if (quantity > available) {
        window.alert(
          `จ่ายออกไม่ได้ เพราะคงเหลือเพียง ${available} ${transaction.unit}\n\nถ้าสินค้ายังมีคงเหลือ ให้เลือกจากช่อง "เลือกสินค้าที่จะนำออก" เพื่อให้ชื่อ รหัส หน่วย และประเภทสินค้าตรงกับสต๊อกเดิม`
        );
        return;
      }

      setPendingIssueTransaction(transaction);
      setIsPendingIssueApproved(false);
      setApprovedDate("");
      setIsApprovalDetailOpen(false);
      setIsCreateDialogOpen(false);
      return;
    }

    setTransactions((current) => [transaction, ...current]);
    setForm(createEmptyForm());
    setIsCreateDialogOpen(false);
    setIsReceivePanelOpen(false);
  }

  function confirmIssueTransaction() {
    if (!pendingIssueTransaction && pendingIssueBatch.length === 0) {
      return;
    }

    if (!isPendingIssueApproved) {
      window.alert("ต้อง Approved ใบเบิกก่อน จึงจะยืนยันนำออกสินค้าได้");
      return;
    }

    if (pendingIssueBatch.length > 0) {
      const firstTransaction = pendingIssueBatch[0];
      const firstRow = pendingIssueBatchStatus?.rows[0];
      const documentNo =
        firstTransaction.issueKey || `ISS-${String(firstTransaction.createdAt).slice(-6)}`;

      setTransactions((current) => [...pendingIssueBatch, ...current]);
      setDeliveryDocument({
        transaction: firstTransaction,
        transactions: pendingIssueBatch,
        rows: pendingIssueBatchStatus?.rows ?? [],
        beforeBalance: firstRow?.beforeBalance ?? 0,
        afterBalance: firstRow?.afterBalance ?? 0,
        costValue: pendingIssueBatchStatus?.totalCostValue ?? 0,
        documentNo,
        approvedDate: getLocalDateValue(),
      });
      setPendingIssueBatch([]);
      setPendingIssueTransaction(null);
      setIsPendingIssueApproved(false);
      setApprovedDate("");
      setIsApprovalDetailOpen(false);
      setForm(createEmptyForm());
      setActiveSection("delivery-note");
      window.history.pushState(null, "", "#delivery-note");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!pendingIssueTransaction) {
      return;
    }

    const documentNo =
      pendingIssueTransaction.issueKey ||
      `ISS-${String(pendingIssueTransaction.createdAt).slice(-6)}`;

    setTransactions((current) => [pendingIssueTransaction, ...current]);
    setDeliveryDocument({
      transaction: pendingIssueTransaction,
      transactions: [pendingIssueTransaction],
      rows: pendingIssueStatus
        ? [
            {
              transaction: pendingIssueTransaction,
              beforeBalance: pendingIssueStatus.beforeBalance,
              afterBalance: pendingIssueStatus.afterBalance,
              costValue: pendingIssueStatus.costValue,
            },
          ]
        : [],
      beforeBalance: pendingIssueStatus?.beforeBalance ?? 0,
      afterBalance: pendingIssueStatus?.afterBalance ?? 0,
      costValue: pendingIssueStatus?.costValue ?? 0,
      documentNo,
      approvedDate: getLocalDateValue(),
    });
    setPendingIssueTransaction(null);
    setIsPendingIssueApproved(false);
    setApprovedDate("");
    setIsApprovalDetailOpen(false);
    setForm(createEmptyForm());
    setActiveSection("delivery-note");
    window.history.pushState(null, "", "#delivery-note");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openDeliveryDocumentFromHistory(issueKey: string) {
    const documentTransactions = issueOverview.transactions.filter(
      (item) => (item.issueKey || "-") === issueKey
    );
    const firstTransaction = documentTransactions[0];

    if (!firstTransaction) {
      return;
    }

    const currentInventory = buildInventoryMap(transactions);
    const rows = documentTransactions.map((transaction) => {
      const currentItem = currentInventory.get(buildItemKey(transaction));
      const afterBalance = currentItem?.balance ?? 0;
      const beforeBalance = afterBalance + transaction.quantity;

      return {
        transaction,
        beforeBalance,
        afterBalance,
        costValue: transaction.quantity * (transaction.costPrice ?? 0),
      };
    });

    setDeliveryDocument({
      transaction: firstTransaction,
      transactions: documentTransactions,
      rows,
      beforeBalance: rows[0]?.beforeBalance ?? 0,
      afterBalance: rows[0]?.afterBalance ?? 0,
      costValue: rows.reduce((sum, row) => sum + row.costValue, 0),
      documentNo: issueKey,
      approvedDate: firstTransaction.date,
    });
    setActiveSection("delivery-note");
    window.history.pushState(null, "", "#delivery-note");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editPendingIssueTransaction() {
    if (!pendingIssueTransaction) {
      return;
    }

    setForm({
      name: pendingIssueTransaction.name,
      sku: pendingIssueTransaction.sku,
      category: pendingIssueTransaction.category,
      productImportType: pendingIssueTransaction.productImportType,
      unit: pendingIssueTransaction.unit,
      type: pendingIssueTransaction.type,
      quantity: String(pendingIssueTransaction.quantity),
      price: String(pendingIssueTransaction.price),
      costPrice: String(pendingIssueTransaction.costPrice ?? 0),
      costCurrency: pendingIssueTransaction.costCurrency ?? "THB",
      date: pendingIssueTransaction.date,
      expiryDate: pendingIssueTransaction.expiryDate,
      issueKey: pendingIssueTransaction.issueKey,
      requester: pendingIssueTransaction.requester ?? "",
      note: pendingIssueTransaction.note,
    });
    setPendingIssueTransaction(null);
    setIsPendingIssueApproved(false);
    setApprovedDate("");
    setIsApprovalDetailOpen(false);
    setIsCreateDialogOpen(true);
  }

  function handleReset() {
    if (!window.confirm("ต้องการล้างข้อมูลทั้งหมดใช่หรือไม่")) {
      return;
    }

    setTransactions([]);
    setForm(createEmptyForm());
  }

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
  }

  function openReceiveDialog() {
    setForm({
      ...createEmptyForm(),
      productImportType: selectedImportType,
      type: "in",
      date: getLocalDateValue(),
    });
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
      "เวลา": new Date(item.createdAt).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      "ผู้จำหน่าย": item.note || "CPAC Precast",
      "รายการสินค้า": item.name,
      "รหัสสินค้า": item.sku || "-",
      "จำนวน": item.quantity,
      "หน่วย": item.unit,
      "มูลค่ารวม": item.quantity * (item.costPrice || item.price || 0),
      "สถานะ": "เสร็จสิ้น",
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

  function openCreateDialog(productImportType?: ProductImportType) {
    closeMobileMenu();
    setForm({
      ...createEmptyForm(),
      productImportType: productImportType ?? selectedImportType,
      type: "in",
      date: getLocalDateValue(),
    });
    setIsCreateDialogOpen(true);
  }

  function openIssueDialog(productImportType = selectedImportType) {
    closeMobileMenu();
    setSelectedImportType(productImportType);
    setForm({
      ...createEmptyForm(),
      productImportType,
      type: "out",
      date: getLocalDateValue(),
    });
    setIsCreateDialogOpen(true);
  }

  function openIssueDialogForItem(item: InventoryItem, quantity = "") {
    closeMobileMenu();
    setSelectedImportType(item.productImportType);
    setForm({
      ...createEmptyForm(),
      name: item.name,
      sku: item.sku,
      category: item.category,
      productImportType: item.productImportType,
      unit: item.unit,
      type: "out",
      quantity,
      price: String(item.price),
      costPrice: String(item.costPrice ?? 0),
      costCurrency: item.costCurrency ?? "THB",
      date: getLocalDateValue(),
      expiryDate: item.nearestExpiryDate,
    });
    setIsCreateDialogOpen(true);
  }

  function openIssuePanelForItem(item?: InventoryItem) {
    closeMobileMenu();
    if (item) {
      setSelectedImportType(item.productImportType);
      setIssuePanelImportType(item.productImportType);
      setIssueSelections((current) => ({
        ...current,
        [item.key]: current[item.key] || "1",
      }));
    } else {
      setIssuePanelImportType("");
    }
    setIsIssuePanelOpen(true);
  }

  function updateIssueSelection(itemKey: string, quantity: string) {
    setIssueSelections((current) => {
      if (!quantity) {
        const next = { ...current };
        delete next[itemKey];
        return next;
      }

      return { ...current, [itemKey]: quantity };
    });
  }

  function toggleIssueSelection(itemKey: string, isSelected: boolean) {
    setIssueSelections((current) => {
      const next = { ...current };

      if (isSelected) {
        next[itemKey] = next[itemKey] || "1";
      } else {
        delete next[itemKey];
      }

      return next;
    });
  }

  async function handleSelectedIssueBatch() {
    const selectedEntries = Object.entries(issueSelections)
      .map(([itemKey, quantityValue]) => {
        const item = inventory.find((candidate) => candidate.key === itemKey);
        return { item, quantity: Number(quantityValue) };
      })
      .filter((entry): entry is { item: InventoryItem; quantity: number } => Boolean(entry.item));

    if (selectedEntries.length === 0) {
      window.alert("เลือกสินค้าที่ต้องการเบิกก่อน");
      return;
    }

    if (!issueRequester.trim()) {
      window.alert("กรอกผู้ขอเบิกสินค้าก่อนบันทึก");
      return;
    }

    if (!issueApprover.trim()) {
      window.alert("กรอกชื่อผู้อนุมัติก่อนบันทึก");
      return;
    }

    if (!issueApproverEmail.trim()) {
      window.alert("กรอกอีเมลผู้อนุมัติก่อนบันทึก");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(issueApproverEmail.trim())) {
      window.alert("กรอกอีเมลผู้อนุมัติให้ถูกต้อง");
      return;
    }

    const invalidEntry = selectedEntries.find(
      ({ quantity }) => !Number.isFinite(quantity) || quantity <= 0
    );

    if (invalidEntry) {
      window.alert("กรอกจำนวนที่ต้องการเบิกให้ถูกต้องทุกรายการ");
      return;
    }

    const overBalanceEntry = selectedEntries.find(({ item, quantity }) => quantity > item.balance);

    if (overBalanceEntry) {
      window.alert(
        `เบิก ${overBalanceEntry.item.name} ไม่ได้ เพราะคงเหลือเพียง ${overBalanceEntry.item.balance} ${overBalanceEntry.item.unit}`
      );
      return;
    }

    const now = Date.now();
    const issueDate = getLocalDateValue();
    const batchIssueKey = `ISS-${String(now).slice(-6)}`;
    const nextTransactions: Transaction[] = selectedEntries.map(({ item, quantity }, index) => ({
      id: createTransactionId(),
      name: item.name,
      sku: item.sku,
      category: item.category,
      productImportType: item.productImportType,
      unit: item.unit,
      type: "out",
      quantity,
      price: item.price,
      costPrice: item.costPrice ?? 0,
      costCurrency: item.costCurrency ?? "THB",
      date: issueDate,
      expiryDate: item.nearestExpiryDate,
      issueKey: batchIssueKey,
      requester: issueRequester.trim(),
      approver: issueApprover.trim(),
      note: issueNote.trim(),
      createdAt: now + index,
    }));

    setIsSendingIssueEmail(true);

    try {
      const response = await fetch("/api/issue-request-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approverEmail: issueApproverEmail.trim(),
          approverName: issueApprover.trim(),
          issueDate,
          issueKey: batchIssueKey,
          items: selectedEntries.map(({ item, quantity }) => ({
            name: item.name,
            productImportTypeLabel: getProductImportTypeLabel(item.productImportType),
            quantity,
            sku: item.sku,
            unit: item.unit,
          })),
          note: issueNote.trim(),
          requester: issueRequester.trim(),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        window.alert(
          `บันทึกคำขอเบิกแล้ว แต่ส่งอีเมลไม่สำเร็จ${data?.error ? `: ${data.error}` : ""}`
        );
      }
    } catch {
      window.alert("บันทึกคำขอเบิกแล้ว แต่เชื่อมต่อระบบส่งอีเมลไม่สำเร็จ");
    } finally {
      setIsSendingIssueEmail(false);
    }

    setPendingIssueBatch(nextTransactions);
    setPendingIssueTransaction(null);
    setIsPendingIssueApproved(false);
    setApprovedDate("");
    setIsApprovalDetailOpen(false);
    setIssueSelections({});
    setIssuePanelImportType("");
    setIssueRequester("");
    setIssueApprover("");
    setIssueApproverEmail("");
    setIssueNote("");
    setIsIssuePanelOpen(false);
  }

  function handleNavigationClick(
    event: MouseEvent<HTMLAnchorElement>,
    sectionId: string,
    productImportType?: ProductImportType
  ) {
    event.preventDefault();
    if (productImportType) {
      setSelectedImportType(productImportType);
    }
    if (sectionId === "receive") {
      setForm({
        ...createEmptyForm(),
        productImportType: selectedImportType,
        type: "in",
        date: getLocalDateValue(),
      });
      setIsReceivePanelOpen(false);
    }
    if (sectionId === "issue") {
      setIsIssuePanelOpen(false);
      setIssueSelections({});
      setIssuePanelImportType("");
      setIssueRequester("");
      setIssueApprover("");
      setIssueApproverEmail("");
      setIssueNote("");
    }
    setActiveSection(sectionId);
    closeMobileMenu();

    window.history.pushState(null, "", `#${sectionId}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleImportTypeSwitch(productImportType: ProductImportType) {
    setSelectedImportType(productImportType);
    setActiveSection("import");

    window.history.pushState(null, "", "#import");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const currentOverviewFilterLabel =
    overviewFilterOptions.find((item) => item.value === overviewFilter)?.label ?? "ทั้งหมด";
  const currentReceiveFilterLabel =
    overviewFilterOptions.find((item) => item.value === receiveFilter)?.label ?? "ทั้งหมด";

  const sidebarContent = (
    <>
      <div className="dashboard-sidebar-brand">
        <div className="brand-mark">
          <PackageCheck aria-hidden="true" size={28} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="brand-title">SB&M</p>
          <p className="brand-subtitle">PRECAST SOLUTIONS</p>
        </div>
        <button
          type="button"
          onClick={closeMobileMenu}
          className="icon-button ml-auto lg:hidden"
          aria-label="ปิดเมนู"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <nav className="dashboard-nav" aria-label="เมนูหลัก">
        <button
          type="button"
          className={`dashboard-nav-item dashboard-nav-group-trigger w-full text-left ${
            activeSection === "import" ? "dashboard-nav-item-active" : ""
          }`}
          onClick={() => {
            setActiveSection("import");
            window.history.pushState(null, "", "#import");
            closeMobileMenu();
          }}
        >
          <Home
            aria-hidden="true"
            className="dashboard-nav-icon"
            size={17}
            strokeWidth={2.1}
          />
          <span>ภาพรวมสต๊อก</span>
        </button>

        {navigationItems.map((item) => {
          const Icon = item.icon;
          const sectionId = item.href.slice(1);
          const isActive = activeSection === sectionId;

          return (
            <a
              key={`${item.label}-${item.href}`}
              className={`dashboard-nav-item ${
                isActive ? "dashboard-nav-item-active" : ""
              }`}
              href={item.href}
              onClick={(event) => handleNavigationClick(event, sectionId)}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                aria-hidden="true"
                className="dashboard-nav-icon"
                size={17}
                strokeWidth={2.1}
              />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

    </>
  );

  return (
    <main className="dashboard-shell">
      {isMobileMenuOpen ? (
        <button
          type="button"
          className="dashboard-overlay"
          onClick={closeMobileMenu}
          aria-label="ปิดเมนู"
        />
      ) : null}

      <aside
        className={`dashboard-sidebar-mobile ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      <aside className="dashboard-sidebar">{sidebarContent}</aside>

      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="icon-button lg:hidden"
              aria-label="เปิดเมนู"
            >
              <Menu aria-hidden="true" size={19} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-[var(--text-strong)] md:text-lg">
                SB&M lnventory Management
              </h1>
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          <>
            {activeSection === "import" ? (
	              <section id="import" className="overview-page">
	                <div className="overview-header">
	                  <div>
	                    <h2>ภาพรวมสต๊อกสินค้า</h2>
	                    <p>ภาพรวมสินค้าแยกตามหมวดหมู่และสถานะสต๊อก</p>
	                  </div>
                    <div className="overview-actions">
                      <label className="overview-date-input">
                        <input
                          type="date"
                          value={overviewDateFrom}
                          max={overviewDateTo}
                          onChange={(event) => setOverviewDateFrom(event.target.value)}
                        />
                      </label>
                      <span className="overview-date-separator">-</span>
                      <label className="overview-date-input">
                        <input
                          type="date"
                          value={overviewDateTo}
                          min={overviewDateFrom}
                          onChange={(event) => setOverviewDateTo(event.target.value)}
                        />
                      </label>
                    </div>
	                </div>

                <section className="overview-kpi-grid">
                  {overviewStats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <article key={stat.label} className="overview-kpi-card">
                        <div className={`overview-kpi-icon overview-kpi-icon-${stat.tone}`}>
                          <Icon size={22} />
                        </div>
                        <div>
                          <p>{stat.label}</p>
                          <strong>{stat.value}</strong>
                          {stat.unit ? <span>{stat.unit}</span> : null}
                        </div>
                        <small>{stat.helper}</small>
                      </article>
                    );
                  })}
                </section>

                <div className="overview-grid">
                  <section className="overview-table-card">
                    <div className="overview-table-toolbar">
                      <label className="overview-search">
                        <Search size={17} />
                        <input
                          type="search"
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder="ค้นหารหัสสินค้า หรือ รายการสินค้า..."
                        />
                      </label>
	                      <div className="overview-table-actions">
	                        <details className="overview-filter-menu">
                          <summary>
                            <Filter size={15} />
                            <span>ตัวกรอง: {currentOverviewFilterLabel}</span>
                            <ChevronDown size={14} />
                          </summary>
                          <div className="overview-filter-dropdown">
                            {overviewFilterOptions.map((item) => (
                              <button
                                key={item.value}
                                type="button"
                                className={overviewFilter === item.value ? "active" : ""}
                                onClick={(event) => {
                                  setOverviewFilter(item.value);
                                  event.currentTarget.closest("details")?.removeAttribute("open");
                                }}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
	                        </details>
	                      </div>
	                    </div>

                    <div className="overview-table-wrap">
                      <table className="overview-table">
                        <thead>
                          <tr>
                            <th>รหัสสินค้า</th>
                            <th>รายการสินค้า</th>
                            <th>หมวดหลัก</th>
                            <th>ประเภทย่อย</th>
                            <th>คงเหลือ</th>
                            <th>หน่วย</th>
                            <th>จุดเตือน</th>
                            <th>สถานะ</th>
                            <th>อัปเดตล่าสุด</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOverviewInventory.length > 0 ? (
                            filteredOverviewInventory
                              .slice()
                              .sort((a, b) => a.name.localeCompare(b.name, "th"))
                              .map((item) => {
                                const latestTransaction = transactions
                                  .filter((transaction) => buildItemKey(transaction) === item.key)
                                  .sort((a, b) => b.createdAt - a.createdAt)[0];
                                const status =
                                  item.balance <= LOW_STOCK_THRESHOLD
                                    ? "ต้องสั่งเพิ่ม"
                                    : item.balance <= LOW_STOCK_THRESHOLD * 3
                                      ? "ใกล้หมด"
                                      : "ปกติ";

                                return (
                                  <tr key={item.key}>
                                    <td className="sku-cell">{item.sku || "-"}</td>
                                    <td>
                                      <strong>{item.name}</strong>
                                      <span>{item.nearestExpiryDate ? `หมดอายุ ${formatDate(item.nearestExpiryDate)}` : "ไม่มีวันหมดอายุ"}</span>
                                    </td>
                                    <td>{getProductImportTypeLabel(item.productImportType)}</td>
                                    <td>{item.category}</td>
                                    <td className="text-right font-semibold">{formatNumber(item.balance)}</td>
                                    <td>{item.unit}</td>
                                    <td>{LOW_STOCK_THRESHOLD}</td>
                                    <td>
                                      <span className={`stock-pill stock-pill-${status === "ปกติ" ? "ok" : status === "ใกล้หมด" ? "warn" : "danger"}`}>
                                        {status}
                                      </span>
                                    </td>
                                    <td>
                                      {latestTransaction ? (
                                        <>
                                          <strong>{formatDate(latestTransaction.date)}</strong>
                                          <span>{new Date(latestTransaction.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</span>
                                        </>
                                      ) : (
                                        "-"
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                          ) : (
                            <tr>
                              <td colSpan={9}>
                                <div className="empty-state">ยังไม่มีข้อมูลสินค้าในภาพรวม</div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="overview-pagination">
                      <span>แสดง 1 - {Math.min(filteredOverviewInventory.length, 8)} จาก {formatNumber(filteredOverviewInventory.length)} รายการ</span>
                      <div>
                        <button type="button">‹</button>
                        <button type="button" className="active">1</button>
                        <button type="button">2</button>
                        <button type="button">3</button>
                        <button type="button">›</button>
                      </div>
                    </div>
                  </section>

	                </div>
	              </section>
            ) : null}

            {activeSection === "expiring" && selectedProductImportGroup ? (
              <section id="expiring" className="grid gap-3">
                <DataPanel
                  title={`${selectedProductImportGroup.label}: สินค้าที่ควรเร่งขายก่อน`}
                  description="แสดงสินค้าคงเหลือที่ใกล้หมดอายุภายใน 90 วัน เฉพาะกลุ่มนี้"
                >
                  <Table
                    headers={["สินค้า", "วันหมดอายุ", "เหลืออีก", "คงเหลือ", "คำแนะนำ"]}
                    emptyMessage={`ยังไม่มีสินค้า ${selectedProductImportGroup.label} ที่ใกล้หมดอายุภายใน 90 วัน`}
                    columnCount={5}
                  >
                    {selectedProductImportGroup.priorityItems.map((item) => {
                      const daysLeft = getDaysUntil(item.nearestExpiryDate);

                      return (
                        <tr key={`${item.key}-priority`}>
                          <td>
                            <strong className="font-semibold text-[var(--text-strong)]">{item.name}</strong>
                            <div className="text-[12px] text-[var(--text-muted)]">{item.sku || "-"}</div>
                          </td>
                          <td>{formatDate(item.nearestExpiryDate)}</td>
                          <td>
                            <StatusBadge tone={daysLeft <= 30 ? "urgent" : "warn"}>
                              {formatDaysLeft(daysLeft)}
                            </StatusBadge>
                          </td>
                          <td className="text-right">{formatNumber(item.balance)} {item.unit}</td>
                          <td>{daysLeft <= 30 ? "เร่งจัดโปรหรือวางหน้าร้าน" : "นำล็อตนี้ออกขายก่อน"}</td>
                        </tr>
                      );
                    })}
                  </Table>
                </DataPanel>
              </section>
            ) : null}

            {activeSection === "receive" ? (
              <section id="receive" className="receive-page">
                <div className="receive-main">
                  <div className="receive-header">
                    <div>
                      <h2>รับเข้าสินค้า</h2>
                      <p>บันทึกรายการรับเข้าและอัปเดตสต๊อกคงเหลือ</p>
                    </div>
                    <div className="receive-header-actions">
                      <Button
                        type="button"
                        onClick={openReceiveDialog}
                      >
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
                            {overviewFilterOptions.map((item) => (
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
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleReceiveExport}
                        >
                          <FileText size={15} />
                          ส่งออก
                          <ChevronDown size={14} />
                        </Button>
                      </div>
                    </div>

                    <div className="overview-table-wrap">
                      <table className="overview-table receive-table">
                        <thead>
                          <tr>
                            <th>เลขที่รับเข้า</th>
                            <th>วันที่รับเข้า</th>
                            <th>ผู้จำหน่าย</th>
                            <th>รายการสินค้า</th>
                            <th>จำนวนรายการ</th>
                            <th>มูลค่ารวม</th>
                            <th>สถานะ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receiveTransactions.length > 0 ? (
                            receiveTransactions.map((item, index) => {
                              const receiveNo = `IN-${item.date.replaceAll("-", "")}-${String(index + 1).padStart(3, "0")}`;
                              const totalValue = item.quantity * (item.costPrice || item.price || 0);

                              return (
                                <tr key={`receive-${item.id}`}>
                                  <td className="sku-cell">{receiveNo}</td>
                                  <td>
                                    <strong>{formatDate(item.date)}</strong>
                                    <span>
                                      {new Date(item.createdAt).toLocaleTimeString("th-TH", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </td>
                                  <td>{item.note || "CPAC Precast"}</td>
                                  <td>
                                    <strong>{item.name}</strong>
                                    <span>{item.sku || "-"}</span>
                                  </td>
                                  <td>{formatNumber(item.quantity)}</td>
                                  <td>{formatCurrency(totalValue)}</td>
                                  <td>
                                    <span className="stock-pill stock-pill-ok">เสร็จสิ้น</span>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={7}>
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
                        <button type="button" className="active">1</button>
                        <button type="button">2</button>
                        <button type="button">3</button>
                        <button type="button">›</button>
                      </div>
                    </div>
                  </section>
                </div>

              </section>
            ) : null}

            <Dialog
              open={isReceivePanelOpen}
              onOpenChange={(open) => {
                if (!open) {
                  closeReceiveDialog();
                  return;
                }

                setIsReceivePanelOpen(true);
              }}
            >
              <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[720px]">
                <DialogHeader>
                  <DialogTitle>บันทึกรับเข้า</DialogTitle>
                  <DialogDescription>เพิ่มรายการรับเข้าโดยไม่บังพื้นที่ตารางหลัก</DialogDescription>
                </DialogHeader>

                <form className="receive-form" onSubmit={handleSubmit}>
                    <label>
                      <span>หมวดหลัก *</span>
                      <select
                        value={form.productImportType}
                        onChange={(event) =>
                          updateForm("productImportType", event.target.value as ProductImportType)
                        }
                      >
                        <option value="resale">ซื้อมาขายไป</option>
                        <option value="stable">สินค้า stable</option>
                      </select>
                    </label>

                    <label>
                      <span>ประเภทย่อย *</span>
                      <input
                        value={form.category}
                        onChange={(event) => updateForm("category", event.target.value)}
                        placeholder="เช่น แผ่นพื้นกลวง"
                      />
                    </label>

                    <label>
                      <span>รายการสินค้า *</span>
                      <input
                        value={form.name}
                        onChange={(event) => updateForm("name", event.target.value)}
                        placeholder="ชื่อรายการสินค้า"
                        required
                      />
                    </label>

                    <label>
                      <span>รหัสสินค้า</span>
                      <input
                        value={form.sku}
                        onChange={(event) => updateForm("sku", event.target.value)}
                        placeholder="PC-HLD350-300"
                      />
                    </label>

                    <div className="receive-form-grid">
                      <label>
                        <span>จำนวน *</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={form.quantity}
                          onChange={(event) => updateForm("quantity", event.target.value)}
                          required
                        />
                      </label>
                      <label>
                        <span>หน่วย *</span>
                        <input
                          value={form.unit}
                          onChange={(event) => updateForm("unit", event.target.value)}
                          placeholder="แผ่น"
                          required
                        />
                      </label>
                    </div>

                    <div className="receive-form-grid">
                      <label>
                        <span>ล็อตผลิต / วันที่ผลิต</span>
                        <input
                          type="date"
                          value={form.issueKey}
                          onChange={(event) => updateForm("issueKey", event.target.value)}
                        />
                      </label>
                      <label>
                        <span>วันหมดอายุ</span>
                        <input
                          type="date"
                          value={form.expiryDate}
                          onChange={(event) => updateForm("expiryDate", event.target.value)}
                        />
                      </label>
                    </div>

                    <label>
                      <span>วันที่รับเข้า *</span>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(event) => updateForm("date", event.target.value)}
                        required
                      />
                    </label>

                    <label>
                      <span>จุดเก็บ / คลังย่อย</span>
                      <input
                        value={form.requester}
                        onChange={(event) => updateForm("requester", event.target.value)}
                        placeholder="A01 - ลานวางแผ่นพื้น"
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
                        />
                        <select
                          value={form.costCurrency}
                          onChange={(event) =>
                            updateForm("costCurrency", event.target.value as CostCurrency)
                          }
                        >
                          {costCurrencyOptions.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <label>
                      <span>ผู้รับผิดชอบ *</span>
                      <input
                        value={form.note}
                        onChange={(event) => updateForm("note", event.target.value)}
                        placeholder="ณัฐวุฒิ พ."
                      />
                    </label>

                    <section className="receive-balance-summary">
                      <h4>สรุปคงเหลือหลังบันทึก</h4>
                      <div>
                        <article>
                          <span>คงเหลือเดิม</span>
                          <strong>{formatNumber(receiveSummary.beforeBalance)}</strong>
                          <small>{form.unit || "หน่วย"}</small>
                        </article>
                        <article>
                          <span>รับเข้า</span>
                          <strong>+ {formatNumber(receiveSummary.receiveQuantity)}</strong>
                          <small>{form.unit || "หน่วย"}</small>
                        </article>
                        <article>
                          <span>คงเหลือหลังบันทึก</span>
                          <strong>{formatNumber(receiveSummary.afterBalance)}</strong>
                          <small>{form.unit || "หน่วย"}</small>
                        </article>
                      </div>
                    </section>

                    <div className="receive-panel-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={closeReceiveDialog}
                      >
                        ยกเลิก
                      </Button>
                      <Button type="submit">บันทึกรายการ</Button>
                    </div>
                </form>
              </DialogContent>
            </Dialog>

            {activeSection === "issue" ? (
              <section
                id="issue"
                className={`issue-page ${isIssuePanelOpen ? "issue-page-panel-open" : ""}`}
              >
                <div className="issue-table-card">
                  <div className="issue-toolbar">
                    <label className="overview-search">
                      <Search size={17} />
                      <input
                        type="search"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="ค้นหารายการสินค้า, รหัส, หมายเหตุ..."
                      />
                    </label>
                    <div className="issue-toolbar-actions">
                      <IssueTypeCombobox
                        open={isIssueTypeFilterOpen}
                        setOpen={setIsIssueTypeFilterOpen}
                        value={issueImportTypeFilter}
                        options={issueFilterOptions}
                        onValueChange={(value) => {
                          setIssueImportTypeFilter(value as OverviewFilter);
                          setIssueSelections({});
                        }}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setIssueImportTypeFilter("all");
                          setSearchTerm("");
                          setIssueSelections({});
                          setIssuePanelImportType("");
                        }}
                      >
                        <Filter size={15} />
                        ล้างตัวกรอง
                      </Button>
                      <Button type="button" size="sm" onClick={() => openIssuePanelForItem()}>
                        <PackageMinus size={16} />
                        เบิกจ่ายสินค้า
                      </Button>
                    </div>
                  </div>

                  <div className="overview-table-wrap">
                    <table className="overview-table issue-table">
                      <thead>
                        <tr>
                          <th>
                            <input
                              type="checkbox"
                              aria-label="เลือกทั้งหมด"
                              checked={
                                issueListItems.length > 0 &&
                                issueListItems.every((item) => issueSelections[item.key])
                              }
                              onChange={(event) => {
                                if (event.target.checked) {
                                  setIssueSelections((current) => {
                                    const next = { ...current };
                                    issueListItems.forEach((item) => {
                                      next[item.key] = next[item.key] || "1";
                                    });
                                    return next;
                                  });
                                  setIsIssuePanelOpen(true);
                                } else {
                                  setIssueSelections({});
                                }
                              }}
                            />
                          </th>
                          <th>รหัสสินค้า</th>
                          <th>รายการสินค้า</th>
                          <th>หมวดหลัก</th>
                          <th>คงเหลือ</th>
                          <th>หน่วย</th>
                          <th>โครงการ / ลูกค้า</th>
                          <th>สถานะ</th>
                          <th aria-label="จัดการ" />
                        </tr>
                      </thead>
                      <tbody>
                        {issueListItems.length > 0 ? (
                          issueListItems.map((item, index) => {
                            const isWaiting = item.balance <= LOW_STOCK_THRESHOLD * 3;
                            const projectNames = [
                              "โครงการก่อสร้างอาคาร",
                              "โครงการทางหลวง 345",
                              "โครงการอาคารสำนักงานใหญ่",
                              "โครงการหมู่บ้านจัดสรร",
                              "โครงการเชื่อมคลองซอย",
                            ];
                            const customerNames = [
                              "บจก. สร้างดี",
                              "กรมทางหลวง",
                              "บจก. พัฒนาไทย",
                              "บจก. บ้านสุขใจ",
                              "อบต. ชีวาคอนสตรัคชั่น",
                            ];

                            return (
                              <tr key={`issue-list-${item.key}`}>
                                <td>
                                  <input
                                    type="checkbox"
                                    aria-label={`เลือก ${item.name}`}
                                    checked={Boolean(issueSelections[item.key])}
                                    onChange={(event) => {
                                      toggleIssueSelection(item.key, event.target.checked);
                                      if (event.target.checked) {
                                        setIsIssuePanelOpen(true);
                                      }
                                    }}
                                  />
                                </td>
                                <td className="sku-cell">{item.sku || "-"}</td>
                                <td>
                                  <strong>{item.name}</strong>
                                  <span>{item.nearestExpiryDate ? `หมดอายุ ${formatDate(item.nearestExpiryDate)}` : "ไม่มีวันหมดอายุ"}</span>
                                </td>
                                <td>{getProductImportTypeLabel(item.productImportType)}</td>
                                <td className="text-right font-semibold">{formatNumber(item.balance)}</td>
                                <td>{item.unit}</td>
                                <td>
                                  <strong>{projectNames[index % projectNames.length]}</strong>
                                  <span>{customerNames[index % customerNames.length]}</span>
                                </td>
                                <td>
                                  <span className={`stock-pill ${isWaiting ? "stock-pill-warn" : "stock-pill-ok"}`}>
                                    {isWaiting ? "รอจัดสรร" : "พร้อมเบิก"}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="issue-row-action"
                                    onClick={() => openIssuePanelForItem(item)}
                                    aria-label={`เบิก ${item.name}`}
                                  >
                                    ⋮
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={9}>
                              <div className="empty-state">ยังไม่มีสินค้าพร้อมเบิกจ่าย</div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="overview-pagination">
                    <span>
                      แสดง 1 - {Math.min(issueListItems.length, 8)} จาก{" "}
                      {formatNumber(issueListItems.length)} รายการ
                    </span>
                    <div>
                      <button type="button">‹</button>
                      <button type="button" className="active">1</button>
                      <button type="button">2</button>
                      <button type="button">3</button>
                      <button type="button">›</button>
                    </div>
                  </div>
                </div>

                {isIssuePanelOpen ? (
                  <aside className="receive-panel">
                    <div className="receive-panel-header">
                      <div>
                        <h3>เบิกจ่ายสินค้า</h3>
                        <p>เลือกสินค้าและจำนวนที่ต้องการเบิก</p>
                      </div>
                      <button
                        type="button"
                        aria-label="ปิดฟอร์ม"
                        onClick={() => {
                          setIsIssuePanelOpen(false);
                          setIssuePanelImportType("");
                        }}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="issue-quick-form issue-quick-form-panel">
                      <label>
                        <span>ประเภทสินค้า *</span>
                        <select
                          value={issuePanelImportType}
                          onChange={(event) => {
                            setIssuePanelImportType(event.target.value as ProductImportType | "");
                            setIssueSelections({});
                          }}
                        >
                          <option value="">เลือกประเภทสินค้า</option>
                          <option value="resale">ซื้อมาขายไป</option>
                          <option value="stable">สินค้า stable</option>
                        </select>
                      </label>
                      <label>
                        <span>เลือกสินค้าเข้ารายการ</span>
                        <select
                          value=""
                          disabled={!issuePanelImportType}
                          onChange={(event) => {
                            if (!event.target.value) {
                              return;
                            }

                            toggleIssueSelection(event.target.value, true);
                          }}
                        >
                          <option value="">
                            {issuePanelImportType
                              ? "เลือกรายการสินค้า"
                              : "เลือกประเภทสินค้าก่อน"}
                          </option>
                          {issuePanelInventoryItems.map((item) => (
                            <option key={`issue-panel-option-${item.key}`} value={item.key}>
                              {item.name} {item.sku ? `(${item.sku})` : ""} - คงเหลือ{" "}
                              {formatNumber(item.balance)} {item.unit}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>ผู้ขอเบิกสินค้า *</span>
                        <input
                          value={issueRequester}
                          onChange={(event) => setIssueRequester(event.target.value)}
                          placeholder="เช่น โครงการ / ลูกค้า / ผู้รับผิดชอบ"
                        />
                      </label>
                      <label>
                        <span>ชื่อผู้อนุมัติ *</span>
                        <input
                          value={issueApprover}
                          onChange={(event) => setIssueApprover(event.target.value)}
                          placeholder="ระบุชื่อผู้อนุมัติ"
                        />
                      </label>
                      <label>
                        <span>อีเมลผู้อนุมัติ *</span>
                        <input
                          type="email"
                          value={issueApproverEmail}
                          onChange={(event) => setIssueApproverEmail(event.target.value)}
                          placeholder="เช่น approver@company.com"
                        />
                      </label>
                      <div className="issue-selection-list">
                        <div className="issue-selection-list-header">
                          <span>ตารางรายการเบิก</span>
                          <strong>{formatNumber(selectedIssueEntries.length)} รายการ</strong>
                        </div>
                        {selectedIssueEntries.length > 0 ? (
                          selectedIssueEntries.map(({ item, quantity }) => (
                            <article key={`selected-issue-${item.key}`} className="issue-selection-item">
                              <div className="issue-selection-item-header">
                                <label className="issue-selection-check">
                                  <input
                                    type="checkbox"
                                    checked
                                    onChange={(event) =>
                                      toggleIssueSelection(item.key, event.target.checked)
                                    }
                                  />
                                  <span>
                                    <strong>{item.name}</strong>
                                    <small>
                                      {item.sku || "-"} · คงเหลือ {formatNumber(item.balance)}{" "}
                                      {item.unit}
                                    </small>
                                  </span>
                                </label>
                                <button
                                  type="button"
                                  className="issue-selection-delete"
                                  onClick={() => toggleIssueSelection(item.key, false)}
                                  aria-label={`ลบ ${item.name} ออกจากรายการเบิก`}
                                  title="ลบรายการนี้"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                              <label className="issue-selection-quantity">
                                <span>จำนวน</span>
                                <input
                                  type="number"
                                  min="1"
                                  max={item.balance}
                                  step="1"
                                  value={quantity}
                                  onChange={(event) =>
                                    updateIssueSelection(item.key, event.target.value)
                                  }
                                />
                              </label>
                            </article>
                          ))
                        ) : (
                          <div className="empty-state">เลือกสินค้าได้จาก checkbox ในตาราง</div>
                        )}
                      </div>
                      <label>
                        <span>หมายเหตุ</span>
                        <input
                          value={issueNote}
                          onChange={(event) => setIssueNote(event.target.value)}
                          placeholder="ระบุหมายเหตุ ถ้ามี"
                        />
                      </label>
                      <div className="receive-panel-actions">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setIsIssuePanelOpen(false);
                            setIssueSelections({});
                            setIssuePanelImportType("");
                            setIssueRequester("");
                            setIssueApprover("");
                            setIssueApproverEmail("");
                            setIssueNote("");
                          }}
                        >
                          ยกเลิก
                        </Button>
                        <Button
                          type="button"
                          onClick={handleSelectedIssueBatch}
                          disabled={isSendingIssueEmail}
                        >
                          {isSendingIssueEmail ? "กำลังส่งอีเมล..." : "บันทึกเบิกสินค้า"}
                        </Button>
                      </div>
                    </div>
                  </aside>
                ) : null}
              </section>
            ) : null}

            {activeSection === "delivery-note" ? (
              <section id="delivery-note" className="grid gap-3">
                {deliveryDocument ? (() => {
                  const documentTransactions =
                    deliveryDocument.transactions?.length > 0
                      ? deliveryDocument.transactions
                      : [deliveryDocument.transaction];
                  const documentRows =
                    deliveryDocument.rows?.length > 0
                      ? deliveryDocument.rows
                      : [
                          {
                            transaction: deliveryDocument.transaction,
                            beforeBalance: deliveryDocument.beforeBalance,
                            afterBalance: deliveryDocument.afterBalance,
                            costValue: deliveryDocument.costValue,
                          },
                        ];

                  return (
                  <>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-sky-600">
                          Delivery Note
                        </p>
                        <h3 className="dashboard-section-title">ใบกำกับเบิกสินค้า</h3>
                      </div>
                      <Button type="button" variant="secondary" onClick={() => setActiveSection("history")}>
                        กลับไปประวัติภาพรวม
                      </Button>
                    </div>

                    <article className="delivery-document">
                      <header className="delivery-document-header">
                        <h2>ใบกำกับเบิกสินค้า</h2>
                      </header>

                      <div className="delivery-document-meta">
                        <div>
                          <p>จาก คลังสินค้า</p>
                          <p>ถึง {deliveryDocument.transaction.requester || "-"}</p>
                        </div>
                        <div className="text-right">
                          <p>
                            หมายเลข <strong>{deliveryDocument.documentNo}</strong>
                          </p>
                          <p>วันที่ {formatDate(deliveryDocument.approvedDate)}</p>
                        </div>
                      </div>

                      <div className="delivery-table-wrap">
                        <table className="delivery-table">
                          <thead>
                            <tr>
                              <th>ลำดับ</th>
                              <th>GI/GT/PO</th>
                              <th>เลข GI/GT/PO</th>
                              <th>ชื่อสินค้า</th>
                              <th>หน่วยงาน</th>
                              <th>จำนวน</th>
                              <th>หน่วย</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: 30 }, (_, index) => {
                              const transaction = documentTransactions[index];
                              const isIssueRow = Boolean(transaction);

                              return (
                                <tr key={`delivery-row-${index + 1}`}>
                                  <td>{index + 1}</td>
                                  <td>{isIssueRow ? "ISSUE" : ""}</td>
                                  <td>{isIssueRow ? deliveryDocument.documentNo : ""}</td>
                                  <td>{isIssueRow ? transaction.name : ""}</td>
                                  <td>{isIssueRow ? transaction.requester || "-" : ""}</td>
                                  <td className="text-right">
                                    {isIssueRow ? formatNumber(transaction.quantity) : "0.0"}
                                  </td>
                                  <td>{isIssueRow ? transaction.unit : ""}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <section className="delivery-summary-grid">
                        <div>
                          <p>ผู้ออกเอกสาร ................................</p>
                          <p>ผู้อนุมัตินำส่ง {deliveryDocument.transaction.approver || ".............................."}</p>
                        </div>
                        <div>
                          <p>ผู้รับจ้างขนส่ง ..............................</p>
                          <p>เลขทะเบียนรถ .................................</p>
                        </div>
                        <div>
                          <p>รถออกวันที่ ....../....../...... เวลา ............</p>
                          <p>ยามผู้ตรวจนำของออก ...........................</p>
                        </div>
                      </section>

                      <section className="delivery-detail-footer">
                        <div className="delivery-footer-box">
                          <p>ชื่อผู้รับของ {deliveryDocument.transaction.requester || "................................"}</p>
                          <p>วันที่ถึง ....../....../...... เวลา ............ น.</p>
                          <p>ผู้รับโปรดเซ็นชื่อพร้อมประทับตรา</p>
                        </div>
                        <div className="delivery-footer-box">
                          <p>รายการตรวจรับของไม่ครบ</p>
                          <p>รายการที่ ........................ จำนวน ............</p>
                          <p>ผู้รับของ ........................................</p>
                          <p>ผู้รับจ้างขนส่ง ..................................</p>
                        </div>
                        <div>
                          <p>ต้นฉบับสีขาว - ผู้รับของ</p>
                          <p>สำเนาสีเขียว - ผู้รับจ้างขนส่ง</p>
                          <p>สำเนาสีฟ้า - พัสดุ</p>
                          <p className="mt-3">CPAC : F-15-004 XLS REV. 01/DEC/01</p>
                          <p>ผู้ปรับปรุง ชาตรี ว.</p>
                        </div>
                      </section>

                      <section className="delivery-issue-detail">
                        <h4>รายละเอียดสินค้าที่เบิกออก</h4>
                        <dl>
                          <div>
                            <dt>จำนวนรายการ</dt>
                            <dd>{formatNumber(documentTransactions.length)} รายการ</dd>
                          </div>
                          <div>
                            <dt>ประเภทสินค้า</dt>
                            <dd>
                              {Array.from(
                                new Set(
                                  documentTransactions.map((item) =>
                                    getProductImportTypeLabel(item.productImportType)
                                  )
                                )
                              ).join(", ")}
                            </dd>
                          </div>
                          <div>
                            <dt>ผู้ขอเบิกสินค้า</dt>
                            <dd>{deliveryDocument.transaction.requester || "-"}</dd>
                          </div>
                          <div>
                            <dt>ชื่อผู้อนุมัติ</dt>
                            <dd>{deliveryDocument.transaction.approver || "-"}</dd>
                          </div>
                          <div>
                            <dt>จำนวนที่เบิก</dt>
                            <dd>
                              {documentTransactions
                                .map((item) => `${formatNumber(item.quantity)} ${item.unit}`)
                                .join(", ")}
                            </dd>
                          </div>
                          <div>
                            <dt>คงเหลือหลังเบิก</dt>
                            <dd>
                              {documentRows
                                .map(
                                  (row) =>
                                    `${row.transaction.name}: ${formatNumber(row.afterBalance)} ${row.transaction.unit}`
                                )
                                .join(", ")}
                            </dd>
                          </div>
                          <div>
                            <dt>มูลค่าต้นทุน</dt>
                            <dd>
                              {documentRows
                                .map((row) =>
                                  `${row.transaction.name}: ${formatCurrencyWithLabel(
                                    row.costValue,
                                    row.transaction.costCurrency
                                  )}`
                                )
                                .join(", ")}
                            </dd>
                          </div>
                        </dl>
                      </section>
                    </article>
                  </>
                  );
                })() : (
                  <DataPanel
                    title="ยังไม่มีใบกำกับเบิกสินค้า"
                    description="เมื่อ Approved และยืนยันเบิกสินค้าแล้ว ระบบจะแสดงเอกสารใบกำกับเบิกสินค้าในหน้านี้"
                  >
                    <Button type="button" onClick={() => setActiveSection("issue")}>
                      ไปหน้านำออกสินค้า
                    </Button>
                  </DataPanel>
                )}
              </section>
            ) : null}

            {activeSection === "history" ? (
            <section id="history" className="grid gap-3">
              <div className="dashboard-category-header">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-amber-600">
                    Issue History
                  </p>
                  <h3 className="dashboard-section-title">ประวัติภาพรวมการขอเบิกสินค้า</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                    รวมข้อมูลใบเบิกทั้งหมด จำนวนที่เบิก มูลค่าต้นทุน และรายละเอียดรายการจ่ายออก
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={() => openIssueDialog()}>
                  <PackageMinus size={16} />
                  สร้างใบเบิกใหม่
                </Button>
              </div>

              <StatsGrid stats={issueHistoryStats} />

              <DataPanel
                title="รายการขอเบิกทั้งหมด"
                description="เรียงจากใบเบิกล่าสุดไปเก่าสุด พร้อมประเภทสินค้า Key เบิก และมูลค่าต้นทุน"
              >
                <Table
                  headers={[
                    "วันที่เบิก",
                    "Key เบิกสินค้า",
                    "สินค้า",
                    "ประเภทสินค้า",
                    "หมวดหมู่",
                    "จำนวน",
                    "วันหมดอายุ",
                    "ราคาต้นทุน",
                    "มูลค่าต้นทุน",
                    "หมายเหตุ",
                    "ใบเบิกสินค้า",
                  ]}
                  emptyMessage="ยังไม่มีประวัติการขอเบิกสินค้า"
                  columnCount={11}
                >
                  {issueOverview.transactions.map((item, index, items) => {
                    const issueKey = item.issueKey || "-";
                    const previousIssueKey = items[index - 1]?.issueKey || "-";
                    const nextIssueKey = items[index + 1]?.issueKey || "-";
                    const isGroupStart = issueKey !== previousIssueKey;
                    const isGroupEnd = issueKey !== nextIssueKey;
                    const groupCount = items.filter(
                      (candidate) => (candidate.issueKey || "-") === issueKey
                    ).length;

                    return (
                    <tr
                      key={`history-${item.id}`}
                      className={`history-group-row ${
                        isGroupStart ? "history-group-start" : ""
                      } ${isGroupEnd ? "history-group-end" : ""}`}
                    >
                      <td>{formatDate(item.date)}</td>
                      <td>
                        <strong className="font-semibold text-[var(--text-strong)]">
                          {item.issueKey || "-"}
                        </strong>
                        {groupCount > 1 && isGroupStart ? (
                          <div className="history-group-label">
                            ใบเดียวกัน {formatNumber(groupCount)} รายการ
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <strong className="font-semibold text-[var(--text-strong)]">
                          {item.name}
                        </strong>
                        <div className="text-[12px] text-[var(--text-muted)]">
                          {item.sku || "-"}
                        </div>
                      </td>
                      <td>{getProductImportTypeLabel(item.productImportType)}</td>
                      <td>{item.category}</td>
                      <td className="text-right">
                        {formatNumber(item.quantity)}{" "}
                        <span className="text-[12px] text-[var(--text-subtle)]">
                          {item.unit}
                        </span>
                      </td>
                      <td>{item.expiryDate ? formatDate(item.expiryDate) : "-"}</td>
                      <td className="text-right">
                        {formatCurrencyWithLabel(item.costPrice ?? 0, item.costCurrency)}
                      </td>
                      <td className="text-right">
                        {formatCurrencyWithLabel(
                          item.quantity * (item.costPrice ?? 0),
                          item.costCurrency
                        )}
                      </td>
                      <td className="text-[12px] text-[var(--text-muted)]">
                        {item.note || "-"}
                      </td>
                      <td>
                        {isGroupStart ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => openDeliveryDocumentFromHistory(issueKey)}
                          >
                            <FileText size={14} />
                            ดูใบเบิก
                          </Button>
                        ) : (
                          <span className="text-[12px] text-[var(--text-muted)]">ใบเดียวกัน</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </Table>
              </DataPanel>
            </section>
            ) : null}

            {activeSection === "settings" ? (
            <section id="settings" className="grid gap-3">
              <section className="dashboard-card">
                <div className="dashboard-panel-header">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-sky-600">
                      Product Settings
                    </p>
                    <h3 className="dashboard-section-title">ตั้งค่ารายการสินค้า</h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                      จัดการข้อมูลตัวอย่างและล้างข้อมูลที่บันทึกไว้ในเครื่องนี้
                    </p>
                  </div>
                  <div className="dashboard-header-actions">
                    <button type="button" onClick={handleReset} className="danger-button">
                      ล้างข้อมูลทั้งหมด
                    </button>
                  </div>
                </div>
              </section>

              <DataPanel
                title="รายการสินค้าทั้งหมด"
                description="รวมสินค้าทั้งซื้อมาขายไปและสินค้า stable ในหน้าเดียว"
              >
                <Table
                  headers={[
                    "สินค้า",
                    "ประเภทสินค้า",
                    "หมวดหมู่",
                    "หมดอายุใกล้สุด",
                    "คงเหลือ",
                    "รับเข้า",
                    "จ่ายออก",
                    "ราคาต้นทุน",
                    "มูลค่าคงเหลือ",
                    "มูลค่าต้นทุน",
                    "จัดการ",
                  ]}
                  emptyMessage="ยังไม่มีรายการสินค้า"
                  columnCount={11}
                >
                  {inventory
                    .slice()
                    .sort((a, b) => {
                      const typeCompare = getProductImportTypeLabel(
                        a.productImportType
                      ).localeCompare(getProductImportTypeLabel(b.productImportType), "th");

                      return typeCompare || a.name.localeCompare(b.name, "th");
                    })
                    .map((item) => (
                      <tr key={`${item.key}-settings`}>
                        <td>
                          <strong className="font-semibold text-[var(--text-strong)]">
                            {item.name}
                          </strong>
                          <div className="text-[12px] text-[var(--text-muted)]">
                            {item.sku || "-"}
                          </div>
                        </td>
                        <td>{getProductImportTypeLabel(item.productImportType)}</td>
                        <td>{item.category}</td>
                        <td>{item.nearestExpiryDate ? formatDate(item.nearestExpiryDate) : "-"}</td>
                        <td
                          className={`text-right ${
                            item.balance <= LOW_STOCK_THRESHOLD
                              ? "font-semibold text-amber-700"
                              : ""
                          }`}
                        >
                          {formatNumber(item.balance)}{" "}
                          <span className="text-[12px] text-[var(--text-subtle)]">
                            {item.unit}
                          </span>
                        </td>
                        <td className="text-right">
                          {formatNumber(item.totalIn)}{" "}
                          <span className="text-[12px] text-[var(--text-subtle)]">
                            {item.unit}
                          </span>
                        </td>
                        <td className="text-right">
                          {formatNumber(item.totalOut)}{" "}
                          <span className="text-[12px] text-[var(--text-subtle)]">
                            {item.unit}
                          </span>
                        </td>
                        <td className="text-right">{formatCurrency(item.costPrice ?? 0)}</td>
                        <td className="text-right">{formatCurrency(item.balance * item.price)}</td>
                        <td className="text-right">
                          {formatCurrency(item.balance * (item.costPrice ?? 0))}
                        </td>
                        <td>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => openEditProductDialog(item)}
                          >
                            <Pencil size={14} />
                            แก้ไข
                          </Button>
                        </td>
                      </tr>
                    ))}
                </Table>
              </DataPanel>
            </section>
            ) : null}
          </>
        </div>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[880px]">
          <DialogHeader>
            <DialogTitle>{form.type === "out" ? "นำออกสินค้า" : "เพิ่มรายการสต๊อก"}</DialogTitle>
            <DialogDescription>
              {form.type === "out"
                ? "บันทึกจำนวนที่จ่ายออก พร้อมวันที่จ่ายออกเพื่ออัปเดตสต๊อกคงเหลือ"
                : "กรอกข้อมูลรับเข้าและจ่ายออกในหน้าต่างเดียว แล้วกลับมาดู dashboard ต่อได้ทันที"}
            </DialogDescription>
          </DialogHeader>

          <StockForm
            form={form}
            inputClassName={inputClassName}
            onSubmit={handleSubmit}
            onChange={updateForm}
            issueInventoryOptions={issueInventoryOptions}
            onIssueInventorySelect={handleIssueInventorySelect}
            mode="plain"
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingIssueTransaction) || pendingIssueBatch.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setPendingIssueTransaction(null);
            setPendingIssueBatch([]);
            setIsPendingIssueApproved(false);
            setApprovedDate("");
            setIsApprovalDetailOpen(false);
            setIssueApprover("");
          }
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[1040px]">
          <DialogHeader>
            <DialogTitle>ตรวจสอบใบเบิกสินค้า</DialogTitle>
            <DialogDescription>
              ตรวจสอบรายการเบิกก่อนยืนยัน ระบบจะตัดสต๊อกหลังจากกดยืนยันเบิกสินค้า
            </DialogDescription>
          </DialogHeader>

          {pendingIssueBatchStatus ? (
            <div className="grid gap-4 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-sky-600">
                    Issue Confirmation
                  </p>
                  <h3 className="dashboard-section-title">สรุปรายการเบิกก่อน Approved</h3>
                </div>
                <StatusBadge
                  tone={
                    pendingIssueBatchStatus.hasInsufficientStock
                      ? "urgent"
                      : isPendingIssueApproved
                        ? "in"
                        : "out"
                  }
                >
                  {pendingIssueBatchStatus.hasInsufficientStock
                    ? "ยอดไม่พอ"
                    : isPendingIssueApproved
                      ? "Approved แล้ว"
                      : "รอ Approved"}
                </StatusBadge>
              </div>

              <StatsGrid stats={pendingIssueBatchStatus.stats} />

              <DataPanel
                title="ตารางตรวจสอบใบเบิก"
                description="ตรวจสอบหลายรายการก่อน Approved และยืนยันตัดสต๊อก"
              >
                <Table
                  headers={[
                    "วันที่เบิก",
                    "เลขใบเบิก",
                    "ประเภทสินค้า",
                    "ชื่อผู้ขอเบิก",
                    "ชื่อผู้อนุมัติ",
                    "สถานะ Approved",
                  ]}
                  emptyMessage="ไม่มีรายการรอยืนยัน"
                  columnCount={6}
                >
                  {pendingIssueBatchStatus.rows.map((row) => (
                    <tr key={`pending-batch-${row.transaction.id}`}>
                      <td>{formatDate(row.transaction.date)}</td>
                      <td>
                        <strong className="font-semibold text-[var(--text-strong)]">
                          {row.transaction.issueKey || "-"}
                        </strong>
                      </td>
                      <td>{getProductImportTypeLabel(row.transaction.productImportType)}</td>
                      <td>
                        <strong className="font-semibold text-[var(--text-strong)]">
                          {row.transaction.requester || "-"}
                        </strong>
                      </td>
                      <td>
                        <strong className="font-semibold text-[var(--text-strong)]">
                          {row.transaction.approver || "-"}
                        </strong>
                      </td>
                      <td>
                        <div className="approval-status-cell">
                          <StatusBadge
                            tone={
                              row.afterBalance < 0
                                ? "urgent"
                                : isPendingIssueApproved
                                  ? "in"
                                  : "warn"
                            }
                          >
                            {row.afterBalance < 0
                              ? "ยอดไม่พอ"
                              : isPendingIssueApproved
                                ? "Approved แล้ว"
                                : "ยังไม่ Approved"}
                          </StatusBadge>
                          {isPendingIssueApproved ? (
                            <button
                              type="button"
                              className={`approval-circle-button approval-circle-button-compact ${
                                isApprovalDetailOpen ? "approval-circle-button-open" : ""
                              }`}
                              onClick={() => setIsApprovalDetailOpen((current) => !current)}
                              aria-label="ดูรายละเอียดผู้อนุมัติ"
                              title="ดูรายละเอียดผู้อนุมัติ"
                            >
                              {isApprovalDetailOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </Table>
              </DataPanel>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setPendingIssueBatch([]);
                    setIsPendingIssueApproved(false);
                    setApprovedDate("");
                    setIsApprovalDetailOpen(false);
                    setIsIssuePanelOpen(true);
                  }}
                >
                  กลับไปแก้ไข
                </Button>
                {!pendingIssueBatchStatus.hasInsufficientStock ? (
                  <div className="approval-action-group">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={approvePendingIssue}
                      disabled={isPendingIssueApproved}
                    >
                      {isPendingIssueApproved ? "Approved แล้ว" : "Approved"}
                    </Button>
                    {isPendingIssueApproved ? (
                      <button
                        type="button"
                        className={`approval-circle-button ${
                          isApprovalDetailOpen ? "approval-circle-button-open" : ""
                        }`}
                        onClick={() => setIsApprovalDetailOpen((current) => !current)}
                        aria-label="ดูรายละเอียดผู้อนุมัติ"
                        title="ดูรายละเอียดผู้อนุมัติ"
                      >
                        {isApprovalDetailOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <Button type="button" onClick={confirmIssueTransaction} disabled={!pendingIssueCanConfirm}>
                  ยืนยันเบิกสินค้า
                </Button>
              </div>
              {isPendingIssueApproved && isApprovalDetailOpen ? (
                <section className="approval-detail-panel">
                  <div className="approval-detail-header">
                    <strong>รายละเอียดผู้อนุมัติ</strong>
                    <span>{formatDate(approvedDate || getLocalDateValue())}</span>
                  </div>
                  <div className="approval-detail-list">
                    {pendingApprovalDetails.map((item, index) => (
                      <article key={`approval-detail-${item.issueKey}-${index}`}>
                        <span>เลขใบเบิก {item.issueKey}</span>
                        <strong>{item.approver}</strong>
                        <small>ผู้ขอเบิก: {item.requester}</small>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : pendingIssueTransaction && pendingIssueStatus ? (
            <div className="grid gap-4 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-sky-600">
                    Issue Confirmation
                  </p>
                  <h3 className="dashboard-section-title">สถานะรวมก่อนนำออกสินค้า</h3>
                </div>
                <StatusBadge
                  tone={
                    pendingIssueStatus.afterBalance < 0
                      ? "urgent"
                      : isPendingIssueApproved
                        ? "in"
                        : "out"
                  }
                >
                  {pendingIssueStatus.afterBalance < 0
                    ? "ยอดไม่พอ"
                    : isPendingIssueApproved
                      ? "สำเร็จ สามารถนำออกได้"
                      : "รอ Approved"}
                </StatusBadge>
              </div>

              <StatsGrid stats={pendingIssueStatus.stats} />

              <DataPanel
                title="ตารางตรวจสอบใบเบิก"
                description="ตรวจสอบยอดคงเหลือก่อนนำออก จำนวนที่ขอเบิก และยอดคงเหลือหลังยืนยัน"
              >
                <Table
                  headers={[
                    "วันที่เบิก",
                    "เลขใบเบิก",
                    "ประเภทสินค้า",
                    "ชื่อผู้ขอเบิก",
                    "ชื่อผู้อนุมัติ",
                    "สถานะ Approved",
                  ]}
                  emptyMessage="ไม่มีรายการรอยืนยัน"
                  columnCount={6}
                >
                  <tr>
                    <td>{formatDate(pendingIssueTransaction.date)}</td>
                    <td>
                      <strong className="font-semibold text-[var(--text-strong)]">
                        {pendingIssueTransaction.issueKey || "-"}
                      </strong>
                    </td>
                    <td>{getProductImportTypeLabel(pendingIssueTransaction.productImportType)}</td>
                    <td>
                      <strong className="font-semibold text-[var(--text-strong)]">
                        {pendingIssueTransaction.requester || "-"}
                      </strong>
                    </td>
                    <td>
                      <strong className="font-semibold text-[var(--text-strong)]">
                        {pendingIssueTransaction.approver || "-"}
                      </strong>
                    </td>
                    <td>
                      <div className="approval-status-cell">
                        <StatusBadge
                          tone={
                            pendingIssueStatus.afterBalance < 0
                              ? "urgent"
                              : isPendingIssueApproved
                                ? "in"
                                : "warn"
                          }
                        >
                          {pendingIssueStatus.afterBalance < 0
                            ? "ยอดไม่พอ"
                            : isPendingIssueApproved
                              ? "Approved แล้ว"
                              : "ยังไม่ Approved"}
                        </StatusBadge>
                        {isPendingIssueApproved ? (
                          <button
                            type="button"
                            className={`approval-circle-button approval-circle-button-compact ${
                              isApprovalDetailOpen ? "approval-circle-button-open" : ""
                            }`}
                            onClick={() => setIsApprovalDetailOpen((current) => !current)}
                            aria-label="ดูรายละเอียดผู้อนุมัติ"
                            title="ดูรายละเอียดผู้อนุมัติ"
                          >
                            {isApprovalDetailOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                </Table>
              </DataPanel>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={editPendingIssueTransaction}>
                  กลับไปแก้ไข
                </Button>
                {pendingIssueStatus.afterBalance >= 0 ? (
                  <div className="approval-action-group">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={approvePendingIssue}
                      disabled={isPendingIssueApproved}
                    >
                      {isPendingIssueApproved ? "Approved แล้ว" : "Approved"}
                    </Button>
                    {isPendingIssueApproved ? (
                      <button
                        type="button"
                        className={`approval-circle-button ${
                          isApprovalDetailOpen ? "approval-circle-button-open" : ""
                        }`}
                        onClick={() => setIsApprovalDetailOpen((current) => !current)}
                        aria-label="ดูรายละเอียดผู้อนุมัติ"
                        title="ดูรายละเอียดผู้อนุมัติ"
                      >
                        {isApprovalDetailOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <Button
                  type="button"
                  onClick={confirmIssueTransaction}
                  disabled={!pendingIssueCanConfirm}
                >
                  ยืนยันเบิกสินค้า
                </Button>
              </div>
              {isPendingIssueApproved && isApprovalDetailOpen ? (
                <section className="approval-detail-panel">
                  <div className="approval-detail-header">
                    <strong>รายละเอียดผู้อนุมัติ</strong>
                    <span>{formatDate(approvedDate || getLocalDateValue())}</span>
                  </div>
                  <div className="approval-detail-list">
                    {pendingApprovalDetails.map((item, index) => (
                      <article key={`approval-detail-single-${item.issueKey}-${index}`}>
                        <span>เลขใบเบิก {item.issueKey}</span>
                        <strong>{item.approver}</strong>
                        <small>ผู้ขอเบิก: {item.requester}</small>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditProductDialogOpen} onOpenChange={setIsEditProductDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[880px]">
          <DialogHeader>
            <DialogTitle>แก้ไขรายการสินค้า</DialogTitle>
            <DialogDescription>
              ปรับรายละเอียดสินค้า ราคาต่อหน่วย และราคาต้นทุนของรายการนี้
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4 p-4" onSubmit={handleProductEditSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
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
                  onChange={(event) => updateProductEditForm("sku", event.target.value)}
                  className={inputClassName}
                />
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
                ประเภทสินค้า
                <select
                  value={productEditForm.productImportType}
                  onChange={(event) =>
                    updateProductEditForm(
                      "productImportType",
                      event.target.value as ProductImportType
                    )
                  }
                  className={inputClassName}
                >
                  <option value="resale">ซื้อมาขายไป</option>
                  <option value="stable">สินค้า stable</option>
                </select>
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
                วันหมดอายุ
                <input
                  type="date"
                  value={productEditForm.expiryDate}
                  onChange={(event) => updateProductEditForm("expiryDate", event.target.value)}
                  className={inputClassName}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                ราคาต่อหน่วย
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productEditForm.price}
                  onChange={(event) => updateProductEditForm("price", event.target.value)}
                  className={inputClassName}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-strong)]">
                ราคาต้นทุน
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productEditForm.costPrice}
                  onChange={(event) => updateProductEditForm("costPrice", event.target.value)}
                  className={inputClassName}
                />
              </label>
            </div>

            <Button type="submit" className="w-full sm:w-auto">
              บันทึกการแก้ไข
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
