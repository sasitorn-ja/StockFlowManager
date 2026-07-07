"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, PackageMinus, X, Trash2, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComboboxInput } from "@/components/ui/combobox-input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  buildInventoryLotMap,
  createTransactionId,
  getLocalDateValue,
  getProductImportTypeLabel,
  normalizeTransactions,
  formatDate,
  formatNumber,
  matchesMasterProduct,
} from "@/lib/stock-flow/utils";
import type { Transaction, InventoryLotItem, ProductImportType, ProductMaster } from "@/types/stock-flow";

type OverviewFilter = "all" | ProductImportType;

type IssueTypeOption = {
  keywords?: string;
  triggerLabel?: string;
  value: string;
  label: string;
};

type IssueTypeComboboxProps = {
  disabled?: boolean;
  emptyText?: string;
  label: string;
  onValueChange: (value: string) => void;
  open: boolean;
  options: IssueTypeOption[];
  placeholder: string;
  searchPlaceholder: string;
  setOpen: (open: boolean) => void;
  value: string;
};

function IssueTypeCombobox({
  disabled = false,
  emptyText = "ไม่พบรายการที่ค้นหา",
  label,
  onValueChange,
  open,
  options,
  placeholder,
  searchPlaceholder,
  setOpen,
  value,
}: IssueTypeComboboxProps) {
  const activeOption = options.find((option) => option.value === value);

  return (
    <div className="issue-type-filter">
      <span>{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            role="combobox"
            aria-expanded={open}
            className="issue-type-filter-button"
          >
            <span className="truncate">{activeOption?.triggerLabel ?? activeOption?.label ?? placeholder}</span>
            <ChevronDown size={15} className="shrink-0 text-slate-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[264px] p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.keywords || option.label}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      size={16}
                      className={cn("shrink-0", value === option.value ? "opacity-100" : "opacity-0")}
                    />
                    <span>{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

const filterOptions: { value: OverviewFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "resale", label: "สินค้าซื้อมาขายไป" },
  { value: "stable", label: "สินค้าเข้าสต็อก" },
];

type IssueLotItem = InventoryLotItem & {
  lotLabel: string;
  lotSummary: string;
};

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

function sortLotsForAutoAllocation(a: IssueLotItem, b: IssueLotItem) {
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

function buildAutoAllocationPlan(item: IssueProductItem, quantity: number) {
  const plan: Array<{ lot: IssueLotItem; quantity: number }> = [];
  let remaining = quantity;

  for (const lot of item.lots.slice().sort(sortLotsForAutoAllocation)) {
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

  return { plan, remaining };
}

export default function IssuePage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [masterProducts, setMasterProducts] = useState<ProductMaster[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [issueImportTypeFilter, setIssueImportTypeFilter] = useState<OverviewFilter>("all");
  const [issueSelections, setIssueSelections] = useState<Record<string, IssueSelectionValue>>({});
  const [isIssuePanelOpen, setIsIssuePanelOpen] = useState(false);
  const [issueRequester, setIssueRequester] = useState("");
  const [issueApproverContact, setIssueApproverContact] = useState("");
  const [issueApprover, setIssueApprover] = useState("");
  const [issueApproverEmail, setIssueApproverEmail] = useState("");
  const [issueApproverContactSuggestions, setIssueApproverContactSuggestions] = useState<
    ApproverContactOption[]
  >([]);
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);
  const [issueNote, setIssueNote] = useState("");
  const [isSendingIssueEmail, setIsSendingIssueEmail] = useState(false);
  const [isIssueTypeFilterOpen, setIsIssueTypeFilterOpen] = useState(false);

  async function fetchTransactions() {
    try {
      const res = await fetch("/api/transactions");
      if (res.ok) {
        const data = await res.json();
        setTransactions(normalizeTransactions(data));
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    }
  }

  async function fetchMasterProducts() {
    try {
      const res = await fetch("/api/master-products");
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
      const res = await fetch("/api/user-directory", { cache: "no-store" });
      if (res.ok) {
        const users = (await res.json()) as DirectoryUser[];
        setDirectoryUsers(users);
        setIssueApproverContactSuggestions(
          users
            .filter((user) => user.role === "manager" && Boolean(user.email))
            .map((user) => ({
              name: user.name,
              email: user.email,
              label: formatApproverContactLabel(user.name, user.email),
            }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch SSO user directory", error);
    }
  }

  useEffect(() => {
    fetchTransactions();
    fetchMasterProducts();
    fetchUserDirectory();

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

    // Handle role changes reactively
    const handleRoleChange = () => {
      // Do not auto-prefill to allow a transparent placeholder state
    };
    window.addEventListener("simulated-role-changed", handleRoleChange);
    return () => {
      window.removeEventListener("simulated-role-changed", handleRoleChange);
    };
  }, []);

  const inventoryLots = useMemo(() => {
    const inactiveMasterProducts = masterProducts.filter((item) => !item.isActive);
    const lots = [...buildInventoryLotMap(transactions).values()]
      .filter(
        (item) =>
          item.balance > 0 &&
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
  }, [masterProducts, transactions]);

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
        if (item.totalBalance <= 0) {
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
  }, [inventory, issueImportTypeFilter, searchTerm]);

  const issueRequesterSuggestions = useMemo(() => {
    return Array.from(new Set(directoryUsers.map((user) => user.name.trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "th"));
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

    if (!directoryUsers.some((user) => user.name.trim() === issueRequester.trim())) {
      window.alert("กรุณาเลือกผู้ขอเบิกจากรายชื่อผู้ใช้งานในระบบ");
      return;
    }

    if (!issueApprover.trim()) {
      window.alert("กรอกชื่อผู้อนุมัติก่อนบันทึก");
      return;
    }

    const selectedManager = issueApproverContactSuggestions.find(
      (item) => item.name === issueApprover.trim() && item.email === issueApproverEmail.trim()
    );
    if (!selectedManager) {
      window.alert("กรุณาเลือกผู้อนุมัติที่มีสิทธิ์ผู้จัดการจากรายชื่อ");
      return;
    }

    if (!issueApproverEmail.trim()) {
      window.alert("กรอกผู้อนุมัติให้มีทั้งชื่อและอีเมลก่อนบันทึก");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(issueApproverEmail.trim())) {
      window.alert("กรอกผู้อนุมัติในรูปแบบ ชื่อ · อีเมล ให้ถูกต้อง");
      return;
    }

    const invalidEntry = selectedEntries.find(
      ({ quantity }) => !Number.isFinite(quantity) || quantity <= 0
    );

    if (invalidEntry) {
      window.alert("กรอกจำนวนที่ต้องการเบิกให้ถูกต้องทุกรายการ");
      return;
    }

    const overBalanceEntry = selectedEntries.find(({ item, quantity }) => quantity > item.totalBalance);

    if (overBalanceEntry) {
      window.alert(
        `เบิก ${overBalanceEntry.item.name} ไม่ได้ เพราะคงเหลือรวมเพียง ${overBalanceEntry.item.totalBalance} ${overBalanceEntry.item.unit}`
      );
      return;
    }

    const allocationPlans = selectedEntries.map(({ item, quantity }) => ({
      item,
      quantity,
      ...buildAutoAllocationPlan(item, quantity),
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
    const batchIssueKey = `ISS-${String(now).slice(-6)}`;
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
        approver: issueApprover.trim(),
        note: issueNote.trim(),
        createdAt: now + allocationSequence++,
        status: "pending",
      }))
    );

    setIsSendingIssueEmail(true);

    try {
      // 1. Persist directly to Supabase PostgreSQL (saves request as 'pending' reservation)
      const saveRes = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingTransactions),
      });

      if (!saveRes.ok) {
        throw new Error("Failed to save pending requisition in DB");
      }

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

      // 2. Dispatch email notification to manager
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
            sku: `${item.sku || "-"} · จัดล็อตอัตโนมัติ`,
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

    router.push("/approve");
  }

  return (
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
              placeholder="ค้นหาสินค้า, รหัส, หมวดหมู่..."
            />
          </label>
          <div className="issue-toolbar-actions">
            <IssueTypeCombobox
              label="ประเภทการขาย"
              open={isIssueTypeFilterOpen}
              setOpen={setIsIssueTypeFilterOpen}
              value={issueImportTypeFilter}
              options={filterOptions}
              placeholder="ประเภทสินค้า"
              searchPlaceholder="ค้นหาประเภทสินค้า..."
              onValueChange={(value) => {
                const nextValue = value as OverviewFilter;
                setIssueImportTypeFilter(nextValue);
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
                            next[item.key] = next[item.key] || {
                              quantity: "1",
                            };
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
                <th>การจัดสรร</th>
                <th>ประเภทสินค้า</th>
                <th>คงเหลือ</th>
                <th>หน่วย</th>
              </tr>
            </thead>
            <tbody>
              {issueListItems.length > 0 ? (
                issueListItems.map((item) => {
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
                        <span>
                          ระบบจะเลือกล็อตให้อัตโนมัติตามวันหมดอายุหรือวันรับเข้า
                        </span>
                      </td>
                      <td>
                        <strong>{item.lots.some((lot) => Boolean(lot.expiryDate)) ? "FEFO" : "FIFO"}</strong>
                        <span>
                          {item.lots.length > 1
                            ? `พร้อมจัดสรรจาก ${formatNumber(item.lots.length)} ล็อต`
                            : "ระบบตัดล็อตให้อัตโนมัติ"}
                        </span>
                      </td>
                      <td>{getProductImportTypeLabel(item.productImportType)}</td>
                      <td className="text-right font-semibold">{formatNumber(item.totalBalance)}</td>
                      <td>{item.unit}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">ยังไม่มีสินค้าพร้อมเบิกจ่าย</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="overview-pagination">
          <span>
            แสดง 1 - {Math.min(issueListItems.length, 8)} จาก {formatNumber(issueListItems.length)}{" "}
            รายการ
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
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div className="issue-quick-form issue-quick-form-panel">
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
              <span>ผู้อนุมัติ *</span>
              <ComboboxInput
                value={issueApproverContact}
                onValueChange={handleApproverContactChange}
                allowCustomValue={false}
                options={issueApproverInputSuggestions.map((item) => ({
                  value: item,
                  label: item,
                }))}
                placeholder="เลือกผู้จัดการ"
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
                  const requestedQuantity = Number(selection.quantity);
                  const allocationPreview =
                    Number.isFinite(requestedQuantity) && requestedQuantity > 0
                      ? buildAutoAllocationPlan(item, requestedQuantity)
                      : { plan: [], remaining: 0 };

                  return (
                  <article key={`selected-issue-${item.key}`} className="issue-selection-item">
                    <div className="issue-selection-item-header">
                      <div className="issue-selection-check">
                        <span>
                          <strong>{item.name}</strong>
                          <small>
                            {item.sku || "-"} · คงเหลือรวม {formatNumber(item.totalBalance)} {item.unit}
                          </small>
                        </span>
                      </div>
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
                    <div className="text-[12px] text-[var(--text-muted)]">
                      ระบบจะเลือกล็อตให้อัตโนมัติแบบ{" "}
                      {item.lots.some((lot) => Boolean(lot.expiryDate)) ? "FEFO (หมดอายุก่อน)" : "FIFO (เข้าก่อนออกก่อน)"}
                    </div>
                    <label className="issue-selection-quantity">
                      <span>จำนวน</span>
                      <input
                        type="number"
                        min="1"
                        max={item.totalBalance}
                        step="1"
                        value={selection.quantity}
                        onChange={(event) =>
                          updateIssueSelection(item.key, { quantity: event.target.value })
                        }
                      />
                    </label>
                    <div className="text-[12px] text-[var(--text-muted)]">
                      {allocationPreview.plan.length > 0 ? (
                        <>
                          ระบบจะจัดสรรจาก {formatNumber(allocationPreview.plan.length)} ล็อต รวม{" "}
                          {formatNumber(
                            allocationPreview.plan.reduce((sum, entry) => sum + entry.quantity, 0)
                          )}{" "}
                          {item.unit}
                        </>
                      ) : (
                        <>กรอกจำนวนที่ต้องการเบิก แล้วระบบจะคำนวณล็อตให้อัตโนมัติ</>
                      )}
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
  );
}
