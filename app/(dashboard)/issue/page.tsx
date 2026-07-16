"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import { getClientAppSettings, getClientSession } from "@/lib/dashboard-client-cache";
import { Button } from "@/components/ui/button";
import { ComboboxInput } from "@/components/ui/combobox-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTransactions } from "../TransactionContext";
import {
  buildInventoryLotMap,
  createTransactionId,
  getLocalDateValue,
  getProductImportTypeLabel,
  formatDate,
  formatNumber,
  matchesMasterProduct,
} from "@/lib/stock-flow/utils";
import type { Transaction, InventoryLotItem, ProductImportType, ProductMaster } from "@/types/stock-flow";
import { defaultAppSettings, type AppSettings } from "@/lib/app-settings-shared";

type OverviewFilter = "all" | ProductImportType;

const filterOptions: { value: OverviewFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "resale", label: "สินค้าซื้อมาขายไป" },
  { value: "stable", label: "สินค้าเข้าสต็อก" },
];

type IssueLotItem = InventoryLotItem & {
  lotLabel: string;
  lotSummary: string;
};

type AllocationLot = Pick<
  IssueLotItem,
  "price" | "costPrice" | "costCurrency" | "expiryDate" | "balance"
>;

type IssueProductItem = {
  key: string;
  name: string;
  sku: string;
  category: string;
  productImportType: ProductImportType;
  unit: string;
  totalBalance: number;
  lots: IssueLotItem[];
};

type IssueSelectionValue = {
  quantity: string;
};

type ApproverContactOption = {
  email: string;
  label: string;
  name: string;
};

type DirectoryUser = {
  email: string;
  name: string;
  role: "employee" | "manager" | "admin";
  userId: string;
};

function formatApproverContactLabel(name: string, email: string) {
  return [name.trim(), email.trim()].filter(Boolean).join(" · ");
}

function parseApproverContactValue(value: string) {
  const emailMatch = value.match(/([^\s<>@]+@[^\s<>]+\.[^\s<>]+)\s*>?$/);
  if (emailMatch) {
    const email = emailMatch[1].trim().toLowerCase();
    const name = value
      .replace(emailMatch[0], "")
      .replace(/[<·]/g, "")
      .trim();

    return { email, name };
  }

  return { email: "", name: value.trim() };
}

function sortLotsForAutoAllocation(a: IssueLotItem, b: IssueLotItem, allocationMode: AppSettings["allocationMode"]) {
  if (allocationMode === "fifo") {
    return a.receivedDate.localeCompare(b.receivedDate) || a.createdAt - b.createdAt || a.expiryDate.localeCompare(b.expiryDate);
  }

  if (a.expiryDate && b.expiryDate) {
    return a.expiryDate.localeCompare(b.expiryDate) || a.receivedDate.localeCompare(b.receivedDate) || a.createdAt - b.createdAt;
  }

  if (a.expiryDate && !b.expiryDate) {
    return -1;
  }

  if (!a.expiryDate && b.expiryDate) {
    return 1;
  }

  return a.receivedDate.localeCompare(b.receivedDate) || a.createdAt - b.createdAt;
}

function buildAutoAllocationPlan(item: IssueProductItem, quantity: number, allocationMode: AppSettings["allocationMode"], allowNegativeStock = false) {
  const plan: Array<{ lot: AllocationLot; quantity: number }> = [];
  let remaining = quantity;

  for (const lot of item.lots.slice().sort((a, b) => sortLotsForAutoAllocation(a, b, allocationMode))) {
    if (remaining <= 0) {
      break;
    }

    const allocatedQuantity = Math.min(lot.balance, remaining);
    if (allocatedQuantity <= 0) {
      continue;
    }

    plan.push({ lot, quantity: allocatedQuantity });
    remaining -= allocatedQuantity;
  }

  if (allowNegativeStock && remaining > 0) {
    const fallbackLot = item.lots[0];
    plan.push({
      lot: {
        price: fallbackLot?.price ?? 0,
        costPrice: fallbackLot?.costPrice ?? 0,
        costCurrency: fallbackLot?.costCurrency ?? "THB",
        expiryDate: fallbackLot?.expiryDate ?? "",
        balance: 0,
      },
      quantity: remaining,
    });
    remaining = 0;
  }

  return { plan, remaining };
}

export default function IssuePage() {
  const router = useRouter();
  const { transactions, refresh } = useTransactions();
  const [masterProducts, setMasterProducts] = useState<ProductMaster[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [issueImportTypeFilter, setIssueImportTypeFilter] = useState<OverviewFilter>("all");
  const [issueSelections, setIssueSelections] = useState<Record<string, IssueSelectionValue>>({});
  const [isIssuePanelOpen, setIsIssuePanelOpen] = useState(false);
  const [isIssueConfirmOpen, setIsIssueConfirmOpen] = useState(false);
  const [issueRequester, setIssueRequester] = useState("");
  const [issueCreatedBy, setIssueCreatedBy] = useState("ผู้ใช้งาน");
  const [issueApproverContact, setIssueApproverContact] = useState("");
  const [issueApprover, setIssueApprover] = useState("");
  const [issueApproverEmail, setIssueApproverEmail] = useState("");
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);
  const [currentUser, setCurrentUser] = useState<DirectoryUser | null>(null);
  const [issueNote, setIssueNote] = useState("");
  const [isSendingIssueEmail, setIsSendingIssueEmail] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);

  async function fetchMasterProducts() {
    try {
      const res = await fetch(withBasePath("/api/master-products"));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setMasterProducts(data as ProductMaster[]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch master products:", error);
    }
  }

  async function fetchUserDirectory() {
    try {
      const res = await fetch(withBasePath("/api/user-directory"), { cache: "no-store" });
      if (res.ok) {
        const users = (await res.json()) as DirectoryUser[];
        setDirectoryUsers(users);
      }
    } catch (error) {
      console.error("Failed to fetch SSO user directory", error);
    }
  }

  async function fetchAppSettings() {
    try {
      setAppSettings(await getClientAppSettings());
    } catch (error) {
      console.error("Failed to fetch app settings", error);
    }
  }

  async function fetchCurrentUser() {
    try {
      const data = await getClientSession();
      const user = data?.user;
      if (!user) {
        return;
      }
      const name = user?.name?.trim() || "ผู้ใช้งาน";
      const role = user?.role === "admin" || user?.role === "manager" ? user.role : "employee";
      const activeUser: DirectoryUser = { name, email: user?.email?.trim() || "", userId: user?.userId || "", role };
      setCurrentUser(activeUser);
      setIssueCreatedBy(name);
    } catch (error) {
      console.error("Failed to fetch current user", error);
    }
  }

  useEffect(() => {
    fetchMasterProducts();
    fetchUserDirectory();
    fetchAppSettings();
    fetchCurrentUser();

    const cachedDraft = localStorage.getItem("pending_draft");
    if (cachedDraft) {
      try {
        const draft = JSON.parse(cachedDraft);
        setIssueSelections(draft.selections || {});
        setIssueRequester(draft.requester || "");
        setIssueApproverContact(
          formatApproverContactLabel(draft.approver || "", draft.approverEmail || "")
        );
        setIssueApprover(draft.approver || "");
        setIssueApproverEmail(draft.approverEmail || "");
        setIssueNote(draft.note || "");
        setIsIssuePanelOpen(true);
      } catch (e) {
        console.error("Failed to parse cached draft", e);
      }
      localStorage.removeItem("pending_draft");
    }

    const handleUserChange = () => {
      const name = localStorage.getItem("current_username");
      if (name?.trim()) {
        setIssueCreatedBy(name.trim());
      } else {
        fetchCurrentUser();
      }
    };
    window.addEventListener("current-user-changed", handleUserChange);
    return () => {
      window.removeEventListener("current-user-changed", handleUserChange);
    };
  }, []);

  const inventoryLots = useMemo(() => {
    const inactiveMasterProducts = masterProducts.filter((item) => !item.isActive);
    const lots = [...buildInventoryLotMap(transactions).values()]
      .filter(
        (item) =>
          (appSettings.allowNegativeStock ? item.totalIn > 0 : item.balance > 0) &&
          !inactiveMasterProducts.some((product) => matchesMasterProduct(item, product))
      )
      .sort((a, b) => {
        const typeCompare = getProductImportTypeLabel(a.productImportType).localeCompare(
          getProductImportTypeLabel(b.productImportType),
          "th"
        );

        return (
          typeCompare ||
          a.name.localeCompare(b.name, "th") ||
          a.receivedDate.localeCompare(b.receivedDate) ||
          a.expiryDate.localeCompare(b.expiryDate) ||
          a.createdAt - b.createdAt
        );
      });

    const lotCounter = new Map<string, number>();

    return lots.map((item) => {
      const nextSequence = (lotCounter.get(item.baseItemKey) ?? 0) + 1;
      lotCounter.set(item.baseItemKey, nextSequence);

      return {
        ...item,
        lotLabel: `ล็อต ${nextSequence}`,
        lotSummary: `รับเข้า ${formatDate(item.receivedDate)}${
          item.expiryDate ? ` · หมดอายุ ${formatDate(item.expiryDate)}` : " · ไม่มีวันหมดอายุ"
        }`,
      };
    });
  }, [appSettings.allowNegativeStock, masterProducts, transactions]);

  const inventory = useMemo(() => {
    const grouped = new Map<string, IssueProductItem>();

    inventoryLots.forEach((lot) => {
      const entry = grouped.get(lot.baseItemKey) || {
        key: lot.baseItemKey,
        name: lot.name,
        sku: lot.sku,
        category: lot.category,
        productImportType: lot.productImportType,
        unit: lot.unit,
        totalBalance: 0,
        lots: [],
      };

      entry.totalBalance += lot.balance;
      entry.lots.push(lot);
      grouped.set(lot.baseItemKey, entry);
    });

    return Array.from(grouped.values()).map((item) => ({
      ...item,
      lots: item.lots.slice().sort(
        (a, b) =>
          a.receivedDate.localeCompare(b.receivedDate) ||
          a.expiryDate.localeCompare(b.expiryDate) ||
          a.createdAt - b.createdAt
      ),
    }));
  }, [inventoryLots]);

  const issueListItems = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return inventory
      .filter((item) => {
        if (!appSettings.allowNegativeStock && item.totalBalance <= 0) {
          return false;
        }

        if (issueImportTypeFilter !== "all" && item.productImportType !== issueImportTypeFilter) {
          return false;
        }

        const haystack = `${item.name} ${item.sku} ${item.category} ${item.lots
          .map((lot) => `${lot.lotLabel} ${lot.receivedDate} ${lot.expiryDate}`)
          .join(" ")}`.toLowerCase();
        return haystack.includes(normalizedSearchTerm);
      })
      .sort(
        (a, b) => a.name.localeCompare(b.name, "th") || a.sku.localeCompare(b.sku, "th")
      );
  }, [appSettings.allowNegativeStock, inventory, issueImportTypeFilter, searchTerm]);

  const issueRequesterSuggestions = useMemo(() => {
    return Array.from(new Set(directoryUsers.map((user) => user.name.trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "th"));
  }, [directoryUsers]);

  const issueApproverContactSuggestions = useMemo<ApproverContactOption[]>(() => {
    const users = directoryUsers.filter((user) => user.role === "manager");
    return users.filter((user) => Boolean(user.email)).map((user) => ({
      name: user.name,
      email: user.email,
      label: formatApproverContactLabel(user.name, user.email),
    }));
  }, [directoryUsers]);

  const issueApproverInputSuggestions = useMemo(() => {
    const prioritizedContacts = new Map<string, string>();

    issueApproverContactSuggestions.forEach((item) => {
      if (!item.email.trim()) {
        return;
      }

      prioritizedContacts.set(item.name.trim(), item.label);
    });

    return Array.from(prioritizedContacts.values()).sort((a, b) => a.localeCompare(b, "th"));
  }, [issueApproverContactSuggestions]);

  const selectedIssueEntries = useMemo(
    () =>
      Object.entries(issueSelections)
        .map(([itemKey, selection]) => {
          const item = inventory.find((candidate) => candidate.key === itemKey);
          return item ? { item, selection } : null;
        })
        .filter(
          (entry): entry is { item: IssueProductItem; selection: IssueSelectionValue } => Boolean(entry)
        ),
    [inventory, issueSelections]
  );

  function openIssuePanelForItem(item?: IssueProductItem) {
    if (item) {
      setIssueSelections((current) => ({
        ...current,
        [item.key]:
          current[item.key] || {
            quantity: "1",
          },
      }));
    }
    setIsIssuePanelOpen(true);
  }

  function updateIssueSelection(itemKey: string, nextValue: Partial<IssueSelectionValue>) {
    setIssueSelections((current) => ({
      ...current,
      [itemKey]: {
        quantity: current[itemKey]?.quantity ?? "1",
        ...nextValue,
      },
    }));
  }

  function toggleIssueSelection(itemKey: string, isSelected: boolean) {
    setIssueSelections((current) => {
      const next = { ...current };
      const item = inventory.find((candidate) => candidate.key === itemKey);

      if (isSelected && item) {
        next[itemKey] = next[itemKey] || {
          quantity: "1",
        };
      } else {
        delete next[itemKey];
      }

      return next;
    });
  }

  function handleApproverContactChange(value: string) {
    setIssueApproverContact(value);

    const matchedContact = issueApproverContactSuggestions.find((item) => item.label === value);
    if (matchedContact) {
      setIssueApprover(matchedContact.name);
      setIssueApproverEmail(matchedContact.email);
      return;
    }

    const parsedValue = parseApproverContactValue(value);
    setIssueApprover(parsedValue.name);
    setIssueApproverEmail(parsedValue.email);
  }

  function openIssueConfirmDialog() {
    const selectedEntries = Object.entries(issueSelections)
      .map(([itemKey, selection]) => {
        const item = inventory.find((candidate) => candidate.key === itemKey);
        return { item, quantity: Number(selection.quantity) };
      })
      .filter(
        (entry): entry is { item: IssueProductItem; quantity: number } => Boolean(entry.item)
      );

    if (selectedEntries.length === 0) {
      window.alert("เลือกสินค้าที่ต้องการเบิกก่อน");
      return;
    }

    if (!issueRequester.trim()) {
      window.alert("กรอกผู้ขอเบิกสินค้าก่อนบันทึก");
      return;
    }

    const selectedRequester = directoryUsers.find(
      (user) => user.name.trim() === issueRequester.trim()
    );
    if (!selectedRequester) {
      window.alert("กรุณาเลือกผู้ขอเบิกจากรายชื่อผู้ใช้งานในระบบ");
      return;
    }

    if (!selectedRequester.email.trim()) {
      window.alert("ผู้ขอเบิกรายนี้ยังไม่มีอีเมลในระบบ กรุณาให้ผู้ใช้งานเข้าสู่ระบบอย่างน้อย 1 ครั้งก่อนสร้างใบเบิก");
      return;
    }

    const approvalRequired = appSettings.approvalMode !== "off";

    if (approvalRequired && !issueApprover.trim()) {
      window.alert("กรอกชื่อผู้อนุมัติก่อนบันทึก");
      return;
    }

    const selectedManager = issueApproverContactSuggestions.find(
      (item) => item.name === issueApprover.trim() && item.email === issueApproverEmail.trim()
    );
    if (approvalRequired && !selectedManager) {
      window.alert("กรุณาเลือกผู้อนุมัติจากรายชื่อสำหรับบทบาทปัจจุบัน");
      return;
    }

    if (approvalRequired && !issueApproverEmail.trim()) {
      window.alert("กรอกผู้อนุมัติให้มีทั้งชื่อและอีเมลก่อนบันทึก");
      return;
    }

    if (approvalRequired && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(issueApproverEmail.trim())) {
      window.alert("กรอกผู้อนุมัติในรูปแบบ ชื่อ · อีเมล ให้ถูกต้อง");
      return;
    }

    const invalidEntry = selectedEntries.find(
      ({ quantity }) => !Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0
    );

    if (invalidEntry) {
      window.alert("จำนวนที่ต้องการเบิกต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไปทุกรายการ");
      return;
    }

    const overBalanceEntry = appSettings.allowNegativeStock
      ? null
      : selectedEntries.find(({ item, quantity }) => quantity > item.totalBalance);

    if (overBalanceEntry) {
      window.alert(
        `เบิก ${overBalanceEntry.item.name} ไม่ได้ เพราะคงเหลือรวมเพียง ${overBalanceEntry.item.totalBalance} ${overBalanceEntry.item.unit}`
      );
      return;
    }

    const failedAllocation = selectedEntries.find(({ item, quantity }) => {
      const allocationPreview = buildAutoAllocationPlan(
        item,
        quantity,
        appSettings.allocationMode,
        appSettings.allowNegativeStock
      );
      return allocationPreview.remaining > 0;
    });

    if (failedAllocation) {
      window.alert(
        `ไม่สามารถจัดสรรล็อตของ ${failedAllocation.item.name} ได้ครบตามจำนวนที่ขอ กรุณาตรวจสอบสต๊อกอีกครั้ง`
      );
      return;
    }

    setIsIssueConfirmOpen(true);
  }

  async function handleSelectedIssueBatch() {
    if (isSendingIssueEmail) {
      return;
    }

    const selectedEntries = Object.entries(issueSelections)
      .map(([itemKey, selection]) => {
        const item = inventory.find((candidate) => candidate.key === itemKey);
        return { item, quantity: Number(selection.quantity) };
      })
      .filter(
        (entry): entry is { item: IssueProductItem; quantity: number } => Boolean(entry.item)
      );

    if (selectedEntries.length === 0) {
      window.alert("เลือกสินค้าที่ต้องการเบิกก่อน");
      return;
    }

    if (!issueRequester.trim()) {
      window.alert("กรอกผู้ขอเบิกสินค้าก่อนบันทึก");
      return;
    }

    const selectedRequester = directoryUsers.find(
      (user) => user.name.trim() === issueRequester.trim()
    );
    if (!selectedRequester) {
      window.alert("กรุณาเลือกผู้ขอเบิกจากรายชื่อผู้ใช้งานในระบบ");
      return;
    }

    if (!selectedRequester.email.trim()) {
      window.alert("ผู้ขอเบิกรายนี้ยังไม่มีอีเมลในระบบ กรุณาให้ผู้ใช้งานเข้าสู่ระบบอย่างน้อย 1 ครั้งก่อนสร้างใบเบิก");
      return;
    }

    const approvalRequired = appSettings.approvalMode !== "off";

    if (approvalRequired && !issueApprover.trim()) {
      window.alert("กรอกชื่อผู้อนุมัติก่อนบันทึก");
      return;
    }

    const selectedManager = issueApproverContactSuggestions.find(
      (item) => item.name === issueApprover.trim() && item.email === issueApproverEmail.trim()
    );
    if (approvalRequired && !selectedManager) {
      window.alert("กรุณาเลือกผู้อนุมัติจากรายชื่อสำหรับบทบาทปัจจุบัน");
      return;
    }

    if (approvalRequired && !issueApproverEmail.trim()) {
      window.alert("กรอกผู้อนุมัติให้มีทั้งชื่อและอีเมลก่อนบันทึก");
      return;
    }

    if (approvalRequired && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(issueApproverEmail.trim())) {
      window.alert("กรอกผู้อนุมัติในรูปแบบ ชื่อ · อีเมล ให้ถูกต้อง");
      return;
    }

    const invalidEntry = selectedEntries.find(
      ({ quantity }) => !Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0
    );

    if (invalidEntry) {
      window.alert("จำนวนที่ต้องการเบิกต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไปทุกรายการ");
      return;
    }

    const overBalanceEntry = appSettings.allowNegativeStock
      ? null
      : selectedEntries.find(({ item, quantity }) => quantity > item.totalBalance);

    if (overBalanceEntry) {
      window.alert(
        `เบิก ${overBalanceEntry.item.name} ไม่ได้ เพราะคงเหลือรวมเพียง ${overBalanceEntry.item.totalBalance} ${overBalanceEntry.item.unit}`
      );
      return;
    }

    const allocationPlans = selectedEntries.map(({ item, quantity }) => ({
      item,
      quantity,
      ...buildAutoAllocationPlan(item, quantity, appSettings.allocationMode, appSettings.allowNegativeStock),
    }));

    const failedAllocation = allocationPlans.find((entry) => entry.remaining > 0);

    if (failedAllocation) {
      window.alert(
        `ไม่สามารถจัดสรรล็อตของ ${failedAllocation.item.name} ได้ครบตามจำนวนที่ขอ กรุณาตรวจสอบสต๊อกอีกครั้ง`
      );
      return;
    }

    const now = Date.now();
    const issueDate = getLocalDateValue();
    const batchIssueKey = `${appSettings.issuePrefix || "REQ"}-${String(now).slice(-6)}`;
    let allocationSequence = 0;
    const pendingTransactions: Transaction[] = allocationPlans.flatMap(({ item, plan }) =>
      plan.map(({ lot, quantity }) => ({
        id: createTransactionId(),
        name: item.name,
        sku: item.sku,
        category: item.category,
        productImportType: item.productImportType,
        unit: item.unit,
        type: "out",
        quantity,
        price: lot.price,
        costPrice: lot.costPrice ?? 0,
        costCurrency: lot.costCurrency ?? "THB",
        date: issueDate,
        expiryDate: lot.expiryDate,
        issueKey: batchIssueKey,
        requester: issueRequester.trim(),
        requesterEmail: selectedRequester.email.trim(),
        createdBy: issueCreatedBy.trim(),
        approver: approvalRequired ? issueApprover.trim() : "",
        note: issueNote.trim(),
        createdAt: now + allocationSequence++,
        status: approvalRequired ? "pending" : "approved",
      }))
    );

    setIsSendingIssueEmail(true);

    try {
      // 1. Persist directly to the database (saves request as 'pending' reservation)
      const saveRes = await fetch(withBasePath("/api/transactions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingTransactions),
      });

      if (!saveRes.ok) {
        throw new Error("Failed to save pending requisition in DB");
      }

      if (approvalRequired) {
        const emailRes = await fetch(withBasePath("/api/issue-request-email"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            approverEmail: issueApproverEmail.trim(),
            approverName: issueApprover.trim(),
            issueDate,
            issueKey: batchIssueKey,
            requester: issueRequester.trim(),
            createdBy: issueCreatedBy.trim(),
            note: issueNote.trim(),
            items: allocationPlans.flatMap(({ item, plan }) =>
              plan.map(({ lot, quantity }) => ({
                name: item.name,
                sku: item.sku,
                quantity,
                unit: item.unit,
                productImportTypeLabel: getProductImportTypeLabel(item.productImportType),
                costPrice: lot.costPrice ?? 0,
                costCurrency: lot.costCurrency ?? "THB",
              }))
            ),
          }),
        });

        if (!emailRes.ok) {
          const emailPayload = await emailRes.json().catch(() => null);
          console.error("Failed to send approval request email", emailPayload);
          window.alert("บันทึกใบเบิกแล้ว แต่ส่งอีเมลแจ้งอนุมัติไม่สำเร็จ");
        }
      }

      await refresh();

      // Add issueKey to local storage my_created_issue_keys to track ownership
      try {
        const storedKeys = localStorage.getItem("my_created_issue_keys");
        const keysList = storedKeys ? JSON.parse(storedKeys) : [];
        if (!keysList.includes(batchIssueKey)) {
          keysList.push(batchIssueKey);
          localStorage.setItem("my_created_issue_keys", JSON.stringify(keysList));
        }
      } catch (e) {
        console.error("Failed to save created issueKey", e);
      }

    } catch (error) {
      window.alert("ไม่สามารถบันทึกข้อมูลใบเบิกสินค้าลงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
      setIsSendingIssueEmail(false);
      return;
    } finally {
      setIsSendingIssueEmail(false);
    }

    // Reset local selection states and navigate to /approve
    setIssueSelections({});
    setIssueRequester("");
    setIssueApproverContact("");
    setIssueApprover("");
    setIssueApproverEmail("");
    setIssueNote("");
    setIsIssuePanelOpen(false);
    setIsIssueConfirmOpen(false);

    router.push("/approve");
  }

  return (
    <section
      id="issue"
      className={`issue-page ${isIssuePanelOpen ? "issue-page-panel-open" : ""}`}
    >
      <div className="issue-marketplace">
        <div className="issue-shop-hero">
          <div>
            <span className="issue-shop-kicker">STOCK FLOW SHOP</span>
            <h2>เลือกสินค้าเพื่อสร้างใบเบิก</h2>
          </div>
          <label className="inventory-shop-search issue-shop-search">
            <Search size={18} />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="ค้นหาชื่อสินค้า รหัส หรือหมวดหมู่..."
            />
          </label>
          <button type="button" className="issue-cart-button" onClick={() => setIsIssuePanelOpen(true)}>
            <ShoppingCart size={22} />
            <b>{selectedIssueEntries.length}</b>
            <small>ตะกร้าเบิก</small>
          </button>
        </div>

        <div className="issue-shop-controls">
          <div className="issue-category-chips">
            {filterOptions.map((option) => (
              <button key={option.value} type="button" className={issueImportTypeFilter === option.value ? "active" : ""}
                onClick={() => setIssueImportTypeFilter(option.value)}>{option.label}</button>
            ))}
          </div>
        </div>

        <div className="issue-product-grid">
          {issueListItems.map((item) => {
            const selected = issueSelections[item.key];
            return <article key={item.key} className={`issue-product-card ${selected ? "selected" : ""}`}>
              <div className="issue-product-image">
                {item.lots.find((lot) => lot.imageDataUrl)?.imageDataUrl ? <img src={item.lots.find((lot) => lot.imageDataUrl)?.imageDataUrl} alt={item.name} /> : <Package size={42} />}
                <span>{getProductImportTypeLabel(item.productImportType)}</span>
              </div>
              <div className="issue-product-body">
                <small>{item.sku || "ไม่มีรหัสสินค้า"}</small>
                <h3>{item.name}</h3>
                <p>พร้อมเบิก <b>{formatNumber(item.totalBalance)}</b> {item.unit}</p>
                {selected ? <div className="issue-card-stepper">
                  <button type="button" aria-label="ลดจำนวน" onClick={() => { const next = Math.max(1, Number(selected.quantity || 1) - 1); updateIssueSelection(item.key, { quantity: String(next) }); }}><Minus size={16} /></button>
                  <strong>{selected.quantity}</strong>
                  <button type="button" aria-label="เพิ่มจำนวน" onClick={() => { const next = appSettings.allowNegativeStock ? Number(selected.quantity || 1) + 1 : Math.min(item.totalBalance, Number(selected.quantity || 1) + 1); updateIssueSelection(item.key, { quantity: String(next) }); }}><Plus size={16} /></button>
                </div> : <button type="button" className="issue-add-cart" onClick={() => openIssuePanelForItem(item)}><ShoppingCart size={16} /> เพิ่มลงตะกร้า</button>}
              </div>
            </article>;
          })}
          {issueListItems.length === 0 ? <div className="issue-shop-empty"><Package size={44} /><h3>ไม่พบสินค้าที่พร้อมเบิก</h3><p>ลองเปลี่ยนคำค้นหาหรือประเภทสินค้า</p></div> : null}
        </div>
      </div>

      {isIssuePanelOpen ? (
        <>
        <button
          type="button"
          className="issue-panel-overlay"
          aria-label="ปิดฟอร์มเบิกสินค้า"
          onClick={() => setIsIssuePanelOpen(false)}
        />
        <aside className="receive-panel issue-requisition-panel" role="dialog" aria-modal="true" aria-label="ฟอร์มเบิกจ่ายสินค้า">
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
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div className="issue-quick-form issue-quick-form-panel">
            <div className="issue-quick-form-scroll">
            <label>
              <span>คนคีย์ข้อมูล</span>
              <input value={issueCreatedBy} readOnly />
            </label>
            <label>
              <span>ผู้ขอเบิกสินค้า *</span>
              <ComboboxInput
                value={issueRequester}
                onValueChange={setIssueRequester}
                allowCustomValue={false}
                options={issueRequesterSuggestions.map((item) => ({
                  value: item,
                  label: item,
                }))}
                placeholder="ระบุผู้ขอเบิกสินค้า"
                searchPlaceholder="ค้นหาผู้ใช้งาน..."
              />
            </label>
            <label>
              <span>ผู้อนุมัติ {appSettings.approvalMode === "off" ? "" : "*"}</span>
              <ComboboxInput
                value={issueApproverContact}
                onValueChange={handleApproverContactChange}
                allowCustomValue={false}
                disabled={appSettings.approvalMode === "off"}
                options={issueApproverInputSuggestions.map((item) => ({
                  value: item,
                  label: item,
                }))}
                placeholder={appSettings.approvalMode === "off" ? "ไม่ต้องอนุมัติตามการตั้งค่าระบบ" : "เลือกผู้จัดการ"}
                searchPlaceholder="ค้นหาผู้จัดการ..."
                emptyText="ยังไม่มีผู้ใช้งานที่ได้รับสิทธิ์ผู้จัดการ"
              />
            </label>
            <div className="issue-selection-list">
              <div className="issue-selection-list-header">
                <span>ตารางรายการเบิก</span>
                <strong>{formatNumber(selectedIssueEntries.length)} รายการ</strong>
              </div>
              {selectedIssueEntries.length > 0 ? (
                selectedIssueEntries.map(({ item, selection }) => {
                  const imageDataUrl = item.lots.find((lot) => lot.imageDataUrl)?.imageDataUrl;
                  const allocationMode = item.lots.some((lot) => Boolean(lot.expiryDate))
                    ? "FEFO (หมดอายุก่อน)"
                    : "FIFO (เข้าก่อนออกก่อน)";

                  return (
                  <article key={`selected-issue-${item.key}`} className="issue-selection-item">
                    <div className="issue-selection-image">
                      {imageDataUrl ? (
                        <img src={imageDataUrl} alt={item.name} />
                      ) : (
                        <Package size={38} />
                      )}
                    </div>
                    <div className="issue-selection-content">
                      <div className="issue-selection-item-header">
                        <span>
                          <strong>{item.name}</strong>
                          <small>
                            {item.sku || "-"} · คงเหลือรวม {formatNumber(item.totalBalance)} {item.unit}
                          </small>
                        </span>
                        <button
                          type="button"
                          className="issue-selection-delete"
                          onClick={() => toggleIssueSelection(item.key, false)}
                          aria-label={`ลบ ${item.name} ออกจากรายการเบิก`}
                          title="ลบรายการนี้"
                        >
                          <Trash2 size={17} />
                          <span>ลบ</span>
                        </button>
                      </div>

                      <div className="issue-selection-allocation-mode">
                        <RefreshCw size={15} />
                        <span>ระบบจะเลือกล็อตให้อัตโนมัติแบบ {allocationMode}</span>
                      </div>

                      <label className="issue-selection-quantity">
                        <span>จำนวน</span>
                        <div className="issue-selection-stepper">
                          <button
                            type="button"
                            aria-label={`ลดจำนวน ${item.name}`}
                            onClick={() => {
                              const next = Math.max(1, Number(selection.quantity || 1) - 1);
                              updateIssueSelection(item.key, { quantity: String(next) });
                            }}
                          >
                            <Minus size={18} />
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max={appSettings.allowNegativeStock ? undefined : item.totalBalance}
                            step="1"
                            value={selection.quantity}
                            aria-label={`จำนวนเบิก ${item.name}`}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (value === "" || /^\d+$/.test(value)) updateIssueSelection(item.key, { quantity: value });
                            }}
                          />
                          <button
                            type="button"
                            aria-label={`เพิ่มจำนวน ${item.name}`}
                            onClick={() => {
                              const current = Number(selection.quantity || 1);
                              const next = appSettings.allowNegativeStock
                                ? current + 1
                                : Math.min(item.totalBalance, current + 1);
                              updateIssueSelection(item.key, { quantity: String(next) });
                            }}
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </label>

                    </div>
                  </article>
                  );
                })
              ) : (
                <div className="empty-state">เลือกสินค้าได้จาก checkbox ในตาราง แล้วกรอกจำนวนที่ต้องการเบิก</div>
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
            </div>
            <div className="receive-panel-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsIssuePanelOpen(false);
                  setIssueSelections({});
                  setIssueRequester("");
                  setIssueApproverContact("");
                  setIssueApprover("");
                  setIssueApproverEmail("");
                  setIssueNote("");
                }}
              >
                ยกเลิก
              </Button>
              <Button
                type="button"
                onClick={openIssueConfirmDialog}
                disabled={isSendingIssueEmail}
              >
                {isSendingIssueEmail ? "กำลังส่งอีเมล..." : "บันทึกเบิกสินค้า"}
              </Button>
            </div>
          </div>
        </aside>
        <Dialog open={isIssueConfirmOpen} onOpenChange={setIsIssueConfirmOpen}>
          <DialogContent className="max-w-3xl overflow-hidden">
            <DialogHeader>
              <DialogTitle>ยืนยันบันทึกใบเบิกสินค้า</DialogTitle>
              <DialogDescription>
                ตรวจสอบรายการที่จะเบิกก่อนส่งคำขอ ระบบจะสร้างใบเบิกและส่งให้ผู้อนุมัติตาม flow ที่ตั้งไว้
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 px-5 py-4 text-sm text-slate-700">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 font-bold text-slate-700">
                  <span>รายการที่จะเบิก</span>
                  <span>{formatNumber(selectedIssueEntries.length)} รายการ</span>
                </div>
                <div className="max-h-[320px] overflow-auto">
                  <table className="w-full min-w-[620px] text-left text-xs">
                    <thead className="bg-white text-slate-500">
                      <tr>
                        <th className="px-4 py-2">สินค้า</th>
                        <th className="px-4 py-2">ประเภท</th>
                        <th className="px-4 py-2 text-right">จำนวนเบิก</th>
                        <th className="px-4 py-2">การจัดล็อต</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedIssueEntries.map(({ item, selection }) => {
                        const quantity = Number(selection.quantity);
                        const allocationPreview =
                          Number.isFinite(quantity) && quantity > 0
                            ? buildAutoAllocationPlan(item, quantity, appSettings.allocationMode, appSettings.allowNegativeStock)
                            : { plan: [], remaining: 0 };

                        return (
                          <tr key={`confirm-issue-${item.key}`} className="bg-white">
                            <td className="px-4 py-3">
                              <strong className="block text-slate-900">{item.name}</strong>
                              <span className="text-slate-400">
                                {item.sku || "-"} · คงเหลือ {formatNumber(item.totalBalance)} {item.unit}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {getProductImportTypeLabel(item.productImportType)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">
                              {formatNumber(quantity)} {item.unit}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {allocationPreview.plan.length > 0
                                ? `${formatNumber(allocationPreview.plan.length)} ล็อต · ${item.lots.some((lot) => Boolean(lot.expiryDate)) ? "FEFO" : "FIFO"}`
                                : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {issueNote.trim() ? (
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <span className="block text-xs font-semibold text-slate-500">หมายเหตุ</span>
                  <p className="mt-1 text-slate-800">{issueNote.trim()}</p>
                </div>
              ) : null}
            </div>
            <DialogFooter className="border-t border-slate-200 bg-slate-50/70 px-5 py-4">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto sm:min-w-[150px]"
                onClick={() => setIsIssueConfirmOpen(false)}
              >
                กลับไปแก้ไข
              </Button>
              <Button
                type="button"
                className="w-full sm:w-auto sm:min-w-[210px]"
                onClick={handleSelectedIssueBatch}
                disabled={isSendingIssueEmail}
              >
                {isSendingIssueEmail ? "กำลังบันทึก..." : "ยืนยันบันทึกใบเบิก"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </>
      ) : null}
    </section>
  );
}
