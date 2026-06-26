"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, PackageMinus, X, Trash2, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { LOW_STOCK_THRESHOLD } from "@/lib/stock-flow/constants";
import {
  buildInventoryMap,
  createTransactionId,
  getLocalDateValue,
  getProductImportTypeLabel,
  normalizeTransactions,
  formatDate,
  formatNumber,
} from "@/lib/stock-flow/utils";
import type { Transaction, InventoryItem, ProductImportType } from "@/types/stock-flow";

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
  { value: "stable", label: "สินค้า stable" },
];

export default function IssuePage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [issueImportTypeFilter, setIssueImportTypeFilter] = useState<OverviewFilter>("all");
  const [issueSelections, setIssueSelections] = useState<Record<string, string>>({});
  const [isIssuePanelOpen, setIsIssuePanelOpen] = useState(false);
  const [issuePanelImportType, setIssuePanelImportType] = useState<ProductImportType | "">("");
  const [issueRequester, setIssueRequester] = useState("");
  const [issueApprover, setIssueApprover] = useState("");
  const [issueApproverEmail, setIssueApproverEmail] = useState("");
  const [issueNote, setIssueNote] = useState("");
  const [isSendingIssueEmail, setIsSendingIssueEmail] = useState(false);
  const [isIssueTypeFilterOpen, setIsIssueTypeFilterOpen] = useState(false);
  const [isIssuePanelTypeOpen, setIsIssuePanelTypeOpen] = useState(false);

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

  useEffect(() => {
    fetchTransactions();

    const currentSimulatedUser = localStorage.getItem("simulated_username") || "พนักงาน";

    const cachedDraft = localStorage.getItem("pending_draft");
    if (cachedDraft) {
      try {
        const draft = JSON.parse(cachedDraft);
        setIssueSelections(draft.selections || {});
        setIssuePanelImportType(draft.panelImportType || "");
        setIssueRequester(draft.requester || "");
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

  const inventory = useMemo(() => [...buildInventoryMap(transactions).values()], [transactions]);

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

  const issueRequesterSuggestions = useMemo(() => {
    return Array.from(
      new Set(
        transactions
          .filter((item) => item.type === "out")
          .map((item) => item.requester?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b, "th"));
  }, [transactions]);

  const issueApproverSuggestions = useMemo(() => {
    return Array.from(
      new Set(
        transactions
          .filter((item) => item.type === "out")
          .map((item) => item.approver?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b, "th"));
  }, [transactions]);

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

  function openIssuePanelForItem(item?: InventoryItem) {
    if (item) {
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
    setIssueSelections((current) => ({
      ...current,
      [itemKey]: quantity,
    }));
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
    if (isSendingIssueEmail) {
      return;
    }

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
    const pendingTransactions: Transaction[] = selectedEntries.map(({ item, quantity }, index) => ({
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
      status: "pending",
    }));

    setIsSendingIssueEmail(true);

    try {
      // 1. Persist directly to Neon Database (saves request as 'pending' reservation)
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
    } catch (error) {
      window.alert("ไม่สามารถบันทึกข้อมูลใบเบิกสินค้าลงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
      setIsSendingIssueEmail(false);
      return;
    } finally {
      setIsSendingIssueEmail(false);
    }

    // Reset local selection states and navigate to /approve
    setIssueSelections({});
    setIssuePanelImportType("");
    setIssueRequester("");
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
              placeholder="ค้นหารายการสินค้า, รหัส, หมายเหตุ..."
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
                setIssuePanelImportType(nextValue === "all" ? "" : nextValue);
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
                <th>สถานะ</th>
                <th aria-label="จัดการ" />
              </tr>
            </thead>
            <tbody>
              {issueListItems.length > 0 ? (
                issueListItems.map((item) => {
                  const isWaiting = item.balance <= LOW_STOCK_THRESHOLD * 3;

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
                          {item.nearestExpiryDate
                            ? `หมดอายุ ${formatDate(item.nearestExpiryDate)}`
                            : "ไม่มีวันหมดอายุ"}
                        </span>
                      </td>
                      <td>{getProductImportTypeLabel(item.productImportType)}</td>
                      <td className="text-right font-semibold">{formatNumber(item.balance)}</td>
                      <td>{item.unit}</td>
                      <td>
                        <span
                          className={`stock-pill ${isWaiting ? "stock-pill-warn" : "stock-pill-ok"}`}
                        >
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
                setIssuePanelImportType("");
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div className="issue-quick-form issue-quick-form-panel">
            <IssueTypeCombobox
              label="ประเภทสินค้า *"
              open={isIssuePanelTypeOpen}
              setOpen={setIsIssuePanelTypeOpen}
              value={issuePanelImportType}
              options={[
                { value: "resale", label: "ซื้อมาขายไป" },
                { value: "stable", label: "สินค้า stable" },
              ]}
              placeholder="เลือกประเภทสินค้า"
              searchPlaceholder="ค้นหาประเภทสินค้า..."
              emptyText="ไม่พบประเภทสินค้าที่ค้นหา"
              onValueChange={(value) => {
                const nextValue = value as ProductImportType;
                setIssuePanelImportType(nextValue);
                setIssueImportTypeFilter(nextValue);
                setIssueSelections({});
              }}
            />
            <label>
              <span>ผู้ขอเบิกสินค้า *</span>
              <input
                value={issueRequester}
                onChange={(event) => setIssueRequester(event.target.value)}
                placeholder="ระบุผู้ขอเบิกสินค้า"
                list="issue-requester-suggestions"
              />
              <datalist id="issue-requester-suggestions">
                {issueRequesterSuggestions.map((item) => (
                  <option key={`issue-requester-${item}`} value={item} />
                ))}
              </datalist>
            </label>
            <label>
              <span>ชื่อผู้อนุมัติ *</span>
              <input
                value={issueApprover}
                onChange={(event) => setIssueApprover(event.target.value)}
                placeholder="ระบุชื่อผู้อนุมัติ"
                list="issue-approver-suggestions"
              />
              <datalist id="issue-approver-suggestions">
                {issueApproverSuggestions.map((item) => (
                  <option key={`issue-approver-${item}`} value={item} />
                ))}
              </datalist>
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
                      <div className="issue-selection-check">
                        <span>
                          <strong>{item.name}</strong>
                          <small>
                            {item.sku || "-"} · คงเหลือ {formatNumber(item.balance)} {item.unit}
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
                    <label className="issue-selection-quantity">
                      <span>จำนวน</span>
                      <input
                        type="number"
                        min="1"
                        max={item.balance}
                        step="1"
                        value={quantity}
                        onChange={(event) => updateIssueSelection(item.key, event.target.value)}
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
  );
}

