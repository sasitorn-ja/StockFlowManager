"use client";

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Eye, CheckCircle2, XCircle, Clock, CheckSquare, Layers, FileCheck, PackageCheck, Search } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatsGrid } from "@/components/stock-flow/StatsGrid";
import { DataPanel } from "@/components/stock-flow/DataPanel";
import { Table } from "@/components/stock-flow/Table";
import { StatusBadge } from "@/components/stock-flow/StatusBadge";
import {
  formatDate,
  formatNumber,
  formatCurrency,
  buildInventoryLotMap,
  buildItemKey,
  getProductImportTypeLabel,
} from "@/lib/stock-flow/utils";
import type { Transaction, TransactionStatus } from "@/types/stock-flow";
import { getRequisitionStatusLabel } from "@/lib/stock-flow/status";
import { useTransactions } from "../TransactionContext";

type GroupedRequisition = {
  issueKey: string;
  requester: string;
  createdBy: string;
  approver?: string;
  note?: string;
  date: string;
  createdAt: number;
  status: TransactionStatus;
  items: Transaction[];
  totalQuantity: number;
  totalCost: number;
};

type TabType = "all" | TransactionStatus;

type ConfirmActionType = "approve" | "issue" | "receive" | "close" | "cancel";

type ConfirmDialogState = {
  action: ConfirmActionType;
  confirmLabel: string;
  description: string;
  issueKey: string;
  requisition?: GroupedRequisition;
  title: string;
};

export default function RequisitionTrackerPage() {
  return (
    <Suspense fallback={null}>
      <RequisitionTrackerContent />
    </Suspense>
  );
}

function RequisitionTrackerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { transactions, loading: isLoading, refresh } = useTransactions();
  const [currentRole, setCurrentRole] = useState("employee");
  const [currentUsername, setCurrentUsername] = useState("ผู้ใช้งาน");
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [myCreatedIssueKeys, setMyCreatedIssueKeys] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const deepLinkedIssueKey = searchParams.get("issueKey")?.trim() || "";

  // Load and listen to the current role from the dashboard layout.
  useEffect(() => {
    // Load created issue keys
    try {
      const stored = localStorage.getItem("my_created_issue_keys");
      if (stored) {
        setMyCreatedIssueKeys(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to parse created issue keys", e);
    }

    const loadCurrentRole = () => {
      const role = localStorage.getItem("current_role") || "employee";
      const name = localStorage.getItem("current_username") || "ผู้ใช้งาน";
      setCurrentRole(role);
      setCurrentUsername(name);
      
      // Auto-toggle "show only mine" if employee
      if (role === "employee") {
        setShowOnlyMine(true);
      } else {
        setShowOnlyMine(false);
      }
    };

    loadCurrentRole();

    window.addEventListener("current-user-changed", loadCurrentRole);
    return () => {
      window.removeEventListener("current-user-changed", loadCurrentRole);
    };
  }, []);

  useEffect(() => {
    if (!deepLinkedIssueKey) return;
    setActiveTab("all");
    setSearchQuery(deepLinkedIssueKey);
    setExpandedKeys((current) => ({ ...current, [deepLinkedIssueKey]: true }));
  }, [deepLinkedIssueKey]);

  // Group transactions by issueKey
  const groupedRequisitions = useMemo(() => {
    const map = new Map<string, GroupedRequisition>();
    
    // Filter out transactions that are issues (type === "out") and have an issueKey
    const outs = transactions.filter((t) => t.type === "out" && t.issueKey);
    
    outs.forEach((t) => {
      const key = t.issueKey;
      const current = map.get(key) || {
        issueKey: key,
        requester: t.requester || "-",
        createdBy: t.createdBy || "",
        approver: t.approver || "",
        note: t.note || "-",
        date: t.date,
        createdAt: t.createdAt,
        status: (t.status || "completed") as TransactionStatus, // Default legacy to completed
        items: [],
        totalQuantity: 0,
        totalCost: 0,
      };

      current.items.push(t);
      current.totalQuantity += t.quantity;
      current.totalCost += t.quantity * (t.costPrice || t.price || 0);
      
      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [transactions]);

  const lotLabels = useMemo(() => {
    const lots = Array.from(buildInventoryLotMap(transactions).values()).sort(
      (a, b) =>
        getProductImportTypeLabel(a.productImportType).localeCompare(
          getProductImportTypeLabel(b.productImportType),
          "th"
        ) ||
        a.name.localeCompare(b.name, "th") ||
        a.receivedDate.localeCompare(b.receivedDate) ||
        a.expiryDate.localeCompare(b.expiryDate) ||
        a.createdAt - b.createdAt
    );
    const counters = new Map<string, number>();
    const labels = new Map<string, string>();

    lots.forEach((lot) => {
      const sequence = (counters.get(lot.baseItemKey) ?? 0) + 1;
      counters.set(lot.baseItemKey, sequence);
      labels.set(lot.key, `ล็อต ${sequence}`);
    });

    return labels;
  }, [transactions]);

  // Filter based on active role and "Show Only Mine" toggle
  const ownedRequisitions = useMemo(() => {
    return groupedRequisitions.filter((req) => {
      if (showOnlyMine) {
        const isOwnName = req.createdBy === currentUsername || req.requester === currentUsername;
        const isLegacyOwnKey = (!req.requester || req.requester === "-" || req.requester === "พนักงาน") && myCreatedIssueKeys.includes(req.issueKey);
        if (!isOwnName && !isLegacyOwnKey) {
          return false;
        }
      }
      return true;
    });
  }, [groupedRequisitions, showOnlyMine, currentUsername, myCreatedIssueKeys]);

  // Filter based on active tab status and search query
  const filteredRequisitions = useMemo(() => {
    return ownedRequisitions.filter((req) => {
      // 1. Tab status filter
      const matchesApprovedStage = activeTab === "approved" && (req.status === "issued" || req.status === "received" || req.status === "employee_confirmed");
      if (activeTab !== "all" && req.status !== activeTab && !matchesApprovedStage) {
        return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesRequester = req.requester.toLowerCase().includes(query);
        const matchesCreatedBy = req.createdBy.toLowerCase().includes(query);
        const matchesIssueKey = req.issueKey.toLowerCase().includes(query);
        const matchesApprover = (req.approver || "").toLowerCase().includes(query);
        const matchesNote = (req.note || "").toLowerCase().includes(query);
        const matchesItem = req.items.some((item) =>
          `${item.name} ${item.sku} ${item.category}`.toLowerCase().includes(query)
        );

        if (!matchesRequester && !matchesCreatedBy && !matchesIssueKey && !matchesApprover && !matchesNote && !matchesItem) {
          return false;
        }
      }

      return true;
    });
  }, [ownedRequisitions, activeTab, searchQuery]);

  // Calculations for stats summary cards based on ownership visibility
  const stats = useMemo(() => {
    const total = ownedRequisitions.length;
    const pending = ownedRequisitions.filter((r) => r.status === "pending").length;
    const reserved = ownedRequisitions.filter((r) => 
      r.status === "pending" || r.status === "approved" || r.status === "issued" || r.status === "received" || r.status === "employee_confirmed"
    ).length;
    const completed = ownedRequisitions.filter((r) => r.status === "completed").length;

    return [
      {
        label: "คำขอเบิกทั้งหมด",
        value: formatNumber(total),
        unit: "ใบงาน",
        tone: "sky" as const,
      },
      {
        label: "รอผู้จัดการอนุมัติ",
        value: formatNumber(pending),
        unit: "ใบงาน",
        tone: "amber" as const,
      },
      {
        label: "สต๊อกที่จองไว้",
        value: formatNumber(reserved),
        unit: "ใบงาน",
        tone: "violet" as const,
      },
      {
        label: "จ่ายสินค้าแล้ว",
        value: formatNumber(completed),
        unit: "ใบงาน",
        tone: "emerald" as const,
      },
    ];
  }, [ownedRequisitions]);

  // Expand / collapse single row
  function toggleRowExpand(issueKey: string) {
    setExpandedKeys((prev) => ({
      ...prev,
      [issueKey]: !prev[issueKey],
    }));
  }

  // Common status update handler
  async function updateRequisitionStatus(issueKey: string, newStatus: TransactionStatus, extraBody: Record<string, any> = {}) {
    setIsUpdating(issueKey);
    try {
      const res = await fetch(withBasePath("/api/transactions"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_status",
          issueKey,
          status: newStatus,
          ...extraBody,
        }),
      });

      if (res.ok) {
        await refresh();
      } else {
        const data = await res.json().catch(() => null);
        window.alert(data?.error || "เกิดข้อผิดพลาดในการอัปเดตสถานะใบเบิกสินค้า");
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      window.alert("ไม่สามารถติดต่อเซิร์ฟเวอร์เพื่ออัปเดตข้อมูลได้");
    } finally {
      setIsUpdating(null);
    }
  }

  // Role Action Controls
  const isAdmin = currentRole === "admin";
  const isManager = currentRole === "manager";
  const isManagerOrAdmin = currentRole === "admin" || currentRole === "manager";
  const pendingApprovalCount = useMemo(() => {
    if (!isManagerOrAdmin) {
      return 0;
    }

    return ownedRequisitions.filter((requisition) => requisition.status === "pending").length;
  }, [isManagerOrAdmin, ownedRequisitions]);

  function handleConfirmAction() {
    if (!confirmDialog) {
      return;
    }

    if (confirmDialog.action === "approve") {
      updateRequisitionStatus(confirmDialog.issueKey, "approved", {
        approver: currentUsername,
      });
      setConfirmDialog(null);
      return;
    }

    if (confirmDialog.action === "issue") {
      updateRequisitionStatus(confirmDialog.issueKey, "issued");
      setConfirmDialog(null);
      return;
    }

    if (confirmDialog.action === "receive") {
      updateRequisitionStatus(confirmDialog.issueKey, "received");
      setConfirmDialog(null);
      return;
    }

    if (confirmDialog.action === "close") {
      updateRequisitionStatus(confirmDialog.issueKey, "completed");
      setConfirmDialog(null);
      return;
    }

    updateRequisitionStatus(confirmDialog.issueKey, "cancelled");
    setConfirmDialog(null);
  }

  return (
    <>
      <Dialog
        open={Boolean(confirmDialog)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog(null);
          }
        }}
      >
        <DialogContent className="approve-confirm-dialog sm:max-w-[560px]">
          <DialogHeader className="approve-confirm-dialog-header">
            <DialogTitle>{confirmDialog?.title}</DialogTitle>
            <DialogDescription>{confirmDialog?.description}</DialogDescription>
          </DialogHeader>
          {confirmDialog?.action === "approve" && confirmDialog.requisition ? (
            <div className="approve-review-summary">
              <dl className="approve-review-meta">
                <div>
                  <dt>ผู้ขอเบิก</dt>
                  <dd>{confirmDialog.requisition.requester}</dd>
                </div>
                <div>
                  <dt>คนคีย์ข้อมูล</dt>
                  <dd>{confirmDialog.requisition.createdBy || "-"}</dd>
                </div>
                <div>
                  <dt>วันที่ขอเบิก</dt>
                  <dd>{formatDate(confirmDialog.requisition.date)}</dd>
                </div>
                <div>
                  <dt>เลขใบเบิก</dt>
                  <dd>{confirmDialog.requisition.issueKey}</dd>
                </div>
                <div>
                  <dt>หมายเหตุ / วัตถุประสงค์</dt>
                  <dd>{confirmDialog.requisition.note || "-"}</dd>
                </div>
              </dl>
              <div className="approve-review-items">
                {confirmDialog.requisition.items.map((item) => (
                  <div key={`approve-review-${item.id}`}>
                    <span>
                      <strong>{item.name}</strong>
                      {item.sku ? <small>SKU: {item.sku}</small> : null}
                    </span>
                    <b>{formatNumber(item.quantity)} {item.unit}</b>
                  </div>
                ))}
              </div>
              <div className="approve-review-total">
                <span>รวม {formatNumber(confirmDialog.requisition.totalQuantity)} หน่วย</span>
                <strong>{formatCurrency(confirmDialog.requisition.totalCost)}</strong>
              </div>
            </div>
          ) : null}
          <DialogFooter className="approve-confirm-dialog-footer">
            <Button type="button" variant="secondary" onClick={() => setConfirmDialog(null)}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={handleConfirmAction}>
              {confirmDialog?.confirmLabel || "ยืนยัน"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section id="requisition-tracker" className="grid gap-4">
      {/* Page Header */}
      <section className="dashboard-card">
        <div className="dashboard-panel-header">
          <div>
            <h3 className="dashboard-section-title">
              {isAdmin ? "จัดการใบเบิกสินค้า" : isManager ? "อนุมัติใบเบิกสินค้า" : "ใบเบิกของฉัน"}
            </h3>
            <p className="dashboard-subtitle">
              {isAdmin
                ? "ใช้กับใบเบิกที่ยังต้องดำเนินงาน เช่น จ่ายสินค้า ติดตามการรับ และปิดใบเบิก"
                : isManager
                  ? "ใช้ตรวจคำขอที่รออนุมัติ และติดตามใบเบิกที่เกี่ยวข้องกับคุณ"
                  : "ใช้ติดตามสถานะใบเบิกของคุณ ตั้งแต่ส่งคำขอจนปิดใบเบิก"}
            </p>
          </div>
          <div className="dashboard-header-actions flex flex-wrap items-center gap-3">
            {isManagerOrAdmin && (
              <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-strong)] border border-[var(--border)] px-3 py-1.5 rounded-lg bg-[var(--bg-muted)] hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyMine}
                  onChange={(e) => setShowOnlyMine(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>แสดงเฉพาะใบเบิกของฉัน ({currentUsername})</span>
              </label>
            )}
            <Button
              type="button"
              onClick={() => router.push("/issue")}
            >
              สร้างใบเบิกสินค้า
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Summary */}
      <StatsGrid stats={stats} />

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[var(--border-soft)]">
        <div className="bg-slate-100/60 p-1.5 rounded-2xl border border-slate-200/60 flex flex-wrap gap-1.5">
          {(
            [
              { value: "all", label: "ทั้งหมด", icon: Layers, activeClass: "bg-slate-800 text-white shadow-md shadow-slate-200" },
              { value: "pending", label: "รอผู้จัดการอนุมัติ", icon: Clock, activeClass: "bg-amber-500 text-white shadow-md shadow-amber-100" },
              { value: "approved", label: "อนุมัติแล้ว · รอจ่ายสินค้า", icon: FileCheck, activeClass: "bg-sky-500 text-white shadow-md shadow-sky-100" },
              { value: "completed", label: "ปิดใบเบิกแล้ว", icon: PackageCheck, activeClass: "bg-emerald-500 text-white shadow-md shadow-emerald-100" },
              { value: "cancelled", label: "ยกเลิกแล้ว", icon: XCircle, activeClass: "bg-rose-500 text-white shadow-md shadow-rose-100" },
            ] as { value: TabType; label: string; icon: any; activeClass: string }[]
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;
            return (
              <button
                key={`tab-${tab.value}`}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-200 outline-none ${
                  isActive
                    ? `${tab.activeClass} scale-[1.02]`
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <Icon size={14} className={isActive ? "animate-pulse" : "text-slate-400"} />
                <span>{tab.label}</span>
                {tab.value === "pending" && pendingApprovalCount > 0 ? (
                  <span
                    className={`inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                      isActive ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"
                    }`}
                    aria-label={`รอผู้จัดการอนุมัติ ${pendingApprovalCount} รายการ`}
                  >
                    {pendingApprovalCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Filter */}
          <div className="relative flex h-10 w-[240px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-500 shadow-sm focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100 transition">
            <Search size={15} />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาผู้ขอ คนคีย์ เลขใบเบิก หรือสินค้า..."
              className="h-full w-full bg-transparent text-[12px] font-semibold text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="text-[11px] text-[var(--text-subtle)] font-semibold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/40 shadow-sm flex items-center gap-1.5 h-10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
            <span><strong>{filteredRequisitions.length} ใบงาน</strong></span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <DataPanel
        title="รายการใบเบิก"
        description="คลิกไอคอนลูกศรเพื่อขยายดูรายการสินค้าในแต่ละใบขอเบิก"
      >
        {isLoading ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">
            กำลังโหลดข้อมูลจากฐานข้อมูล...
          </div>
        ) : (
          <Table
            headers={[
              "", // Expand arrow
              "เลขใบเบิก",
              "วันที่ขอเบิก",
              "ผู้ขอเบิก",
              "คนคีย์ข้อมูล",
              "สินค้า / จำนวน",
              "ผู้อนุมัติ",
              "สถานะ",
              "ดำเนินการ",
              "เอกสาร",
            ]}
            emptyMessage="ไม่มีรายการที่สอดคล้องกับแท็บที่เลือก"
            columnCount={10}
            className="requisition-table"
          >
            {filteredRequisitions.map((req) => {
              const isExpanded = expandedKeys[req.issueKey];
              const isOwnRequisition = req.createdBy === currentUsername || req.requester === currentUsername;

              // Render human-friendly status badging
              let badgeTone: "warn" | "out" | "in" | "urgent" = "warn";
              let badgeText = getRequisitionStatusLabel(req.status);
              if (req.status === "approved") {
                badgeTone = "out";
              } else if (req.status === "issued" || req.status === "received" || req.status === "employee_confirmed") {
                badgeTone = "out";
              } else if (req.status === "completed") {
                badgeTone = "in";
              } else if (req.status === "cancelled") {
                badgeTone = "urgent";
              }

              return (
                <Fragment key={`group-${req.issueKey}`}>
                  <tr className="hover:bg-slate-50/50">
                    <td className="w-10 text-center">
                      <button
                        type="button"
                        onClick={() => toggleRowExpand(req.issueKey)}
                        className="p-1 rounded hover:bg-slate-200 transition-colors"
                        aria-label="ขยายรายละเอียด"
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </td>
                    <td className="w-[12%] min-w-[110px] font-semibold text-slate-800">
                      {req.issueKey}
                    </td>
                    <td className="w-[12%] min-w-[110px] text-slate-500">{formatDate(req.date)}</td>
                    <td className="w-[15%] min-w-[120px]">
                      <span className="font-medium text-slate-700">{req.requester}</span>
                    </td>
                    <td className="w-[15%] min-w-[120px]">
                      <span className="font-medium text-slate-700">{req.createdBy || "-"}</span>
                      {isOwnRequisition && (
                        <span className="ml-1 text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">คุณ</span>
                      )}
                    </td>
                    <td className="w-[16%] min-w-[150px] text-slate-600">
                      <strong className="block truncate text-slate-700">{req.items[0]?.name || "-"}</strong>
                      <span className="text-[11px]">
                        {req.items.length > 1 ? `และอีก ${req.items.length - 1} รายการ · ` : ""}
                        รวม {formatNumber(req.totalQuantity)} หน่วย
                      </span>
                    </td>
                    <td className="w-[12%] min-w-[100px] text-slate-500">{req.approver || "-"}</td>
                    <td className="w-[18%] min-w-[170px]">
                      <div className="flex items-center">
                        <StatusBadge tone={badgeTone}>{badgeText}</StatusBadge>
                      </div>
                    </td>
                    <td className="w-[22%] min-w-[220px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* ผู้จัดการอนุมัติใบเบิก */}
                        {req.status === "pending" && isManager && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={isUpdating === req.issueKey}
                            onClick={() => {
                              setConfirmDialog({
                                action: "approve",
                                confirmLabel: "ยืนยันอนุมัติคำขอ",
                                description: "ตรวจสอบผู้ขอ รายการสินค้า และจำนวนให้ครบก่อนอนุมัติ",
                                issueKey: req.issueKey,
                                requisition: req,
                                title: "ตรวจสอบก่อนอนุมัติ",
                              });
                            }}
                            className="bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs px-2.5 h-8 py-1 rounded"
                          >
                            ตรวจสอบและอนุมัติ
                          </Button>
                        )}

                        {/* ผู้ดูแลระบบยืนยันจ่ายสินค้า */}
                        {req.status === "approved" && isAdmin && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={isUpdating === req.issueKey}
                            onClick={() => {
                              setConfirmDialog({
                                action: "issue",
                                confirmLabel: "ยืนยันจ่ายสินค้า",
                                description: `ยืนยันว่าแอดมินได้จ่ายสินค้าสำหรับใบเบิก ${req.issueKey} แล้ว`,
                                issueKey: req.issueKey,
                                title: "ยืนยันการจ่ายสินค้า",
                              });
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-2.5 h-8 py-1 rounded"
                          >
                            จ่ายสินค้า
                          </Button>
                        )}

                        {req.status === "issued" && req.requester === currentUsername && (
                          <Button type="button" size="sm" disabled={isUpdating === req.issueKey}
                            onClick={() => setConfirmDialog({ action: "receive", confirmLabel: "ยืนยันรับสินค้า", description: `ยืนยันว่าได้รับสินค้าตามใบเบิก ${req.issueKey} ครบถ้วนแล้ว`, issueKey: req.issueKey, title: "ยืนยันการรับสินค้า" })}
                            className="bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs px-2.5 h-8 py-1 rounded">
                            ยืนยันรับสินค้า
                          </Button>
                        )}

                        {(req.status === "received" || req.status === "employee_confirmed") && isAdmin && (
                          <Button type="button" size="sm" disabled={isUpdating === req.issueKey}
                            onClick={() => setConfirmDialog({ action: "close", confirmLabel: "ยืนยันปิดใบเบิก", description: `ตรวจสอบการรับสินค้าแล้วและปิดใบเบิก ${req.issueKey}`, issueKey: req.issueKey, title: "ปิดใบเบิกขั้นสุดท้าย" })}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-2.5 h-8 py-1 rounded">
                            ปิดใบเบิก
                          </Button>
                        )}

                        {/* 4. BUTTON: Cancel at any stage before completed */}
                        {req.status === "pending" && (isOwnRequisition || isAdmin) && (
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            disabled={isUpdating === req.issueKey}
                            onClick={() => {
                              setConfirmDialog({
                                action: "cancel",
                                confirmLabel: "ยืนยันการยกเลิก",
                                description: `ยืนยันการยกเลิกคำขอ ${req.issueKey}? สต๊อกที่จองไว้จะเด้งกลับคืนคลังทันที`,
                                issueKey: req.issueKey,
                                title: "ยืนยันยกเลิกคำขอ",
                              });
                            }}
                            className="text-xs px-2.5 h-8 py-1 rounded"
                          >
                            ยกเลิก
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      {req.status !== "pending" && req.status !== "cancelled" && isAdmin ? (
                        <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/delivery-note?issueKey=${encodeURIComponent(req.issueKey)}`)} className="text-xs px-2.5 h-8 py-1 rounded flex items-center gap-1.5">
                          <Eye size={12} /> ดูใบเบิก
                        </Button>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </td>
                  </tr>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={10} className="p-4 border-l-4 border-sky-400">
                        <div className="grid gap-3">
                          <div className="flex flex-col gap-1">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                              รายละเอียดคำขอเบิกในใบงาน ({req.issueKey})
                            </h4>
                            <p className="text-xs text-[var(--text-muted)]">
                              <strong>หมายเหตุ:</strong> {req.note || "-"}
                            </p>
                          </div>

                          <div className="overflow-x-auto rounded-lg border bg-white">
                            <table className="min-w-full text-xs text-left divide-y divide-slate-100">
                              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                                <tr>
                                  <th className="px-3 py-2">ชื่อสินค้า</th>
                                  <th className="px-3 py-2">ล็อต</th>
                                  <th className="px-3 py-2 text-right">จำนวนเบิก</th>
                                  <th className="px-3 py-2 text-right">ต้นทุนต่อหน่วย</th>
                                  <th className="px-3 py-2 text-right">ต้นทุนรวม</th>
                                  <th className="px-3 py-2">ประเภทสินค้า</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {req.items.map((item) => {
                                  const costVal = item.quantity * (item.costPrice || item.price || 0);
                                  const lotKey = `${buildItemKey(item)}::${item.expiryDate || "no-expiry"}`;
                                  const lotLabel = lotLabels.get(lotKey) || "-";
                                  return (
                                    <tr key={item.id} className="hover:bg-slate-50/20">
                                      <td className="px-3 py-2.5 font-medium text-slate-800">
                                        {item.name}
                                        {item.sku && <span className="block text-[10px] text-slate-400 font-mono">SKU: {item.sku}</span>}
                                      </td>
                                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                                        <span className="font-semibold text-slate-700">{lotLabel}</span>
                                        <span className="block text-[10px] text-slate-400">
                                          {item.expiryDate ? `หมดอายุ ${formatDate(item.expiryDate)}` : "ไม่มีวันหมดอายุ"}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-semibold">
                                        {formatNumber(item.quantity)} {item.unit}
                                      </td>
                                      <td className="px-3 py-2.5 text-right text-slate-500">
                                        {formatCurrency(item.costPrice || item.price || 0)}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-semibold text-slate-700">
                                        {formatCurrency(costVal)}
                                      </td>
                                      <td className="px-3 py-2.5 text-slate-500">
                                        {item.productImportType === "stable" ? "สินค้าเข้าสต็อก" : "ซื้อมาขายไป"}
                                      </td>
                                    </tr>
                                  );
                                })}
                                <tr className="bg-slate-50/35 font-bold">
                                  <td className="px-3 py-2 text-slate-700">รวมทั้งหมด</td>
                                  <td className="px-3 py-2" />
                                  <td className="px-3 py-2 text-right text-slate-800">
                                    {formatNumber(req.totalQuantity)} หน่วย
                                  </td>
                                  <td className="px-3 py-2" />
                                  <td className="px-3 py-2 text-right text-sky-800 font-semibold">
                                    {formatCurrency(req.totalCost)}
                                  </td>
                                  <td className="px-3 py-2" />
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Requisition Timeline Progress Indicators */}
                          <div className="mt-2 bg-white border rounded-xl p-4">
                            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                              ความคืบหน้าคำขอเบิกสินค้า
                            </h5>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-semibold">
                              
                              {/* Step 1: Request */}
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full flex items-center justify-center bg-sky-100 text-sky-600 font-bold">
                                  1
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-800">ส่งคำขอ & จองสต๊อก</p>
                                  <span className="block text-[10px] text-slate-400 font-normal">โดย: {req.requester}</span>
                                  {req.createdBy ? (
                                    <span className="block text-[10px] text-slate-400 font-normal">คนคีย์: {req.createdBy}</span>
                                  ) : null}
                                </div>
                                <CheckCircle2 size={16} className="text-emerald-500 shrink-0 ml-auto md:ml-2" />
                              </div>
                              
                              {/* Step 2: Approval */}
                              <div className="flex items-center gap-2">
                                <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold ${
                                  req.status !== "pending" && req.status !== "cancelled"
                                    ? "bg-sky-100 text-sky-600"
                                    : "bg-slate-100 text-slate-400"
                                }`}>
                                  2
                                </div>
                                <div>
                                  <p className={req.status !== "pending" && req.status !== "cancelled" ? "text-slate-800" : "text-slate-400 font-medium"}>
                                    อนุมัติแล้ว / รอคลังจ่ายของ
                                  </p>
                                  {req.approver && (
                                    <span className="block text-[10px] text-slate-400 font-normal">โดย: {req.approver}</span>
                                  )}
                                </div>
                                {req.status !== "pending" && req.status !== "cancelled" ? (
                                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0 ml-2" />
                                ) : req.status === "cancelled" ? (
                                  <XCircle size={16} className="text-rose-500 shrink-0 ml-2" />
                                ) : (
                                  <Clock size={16} className="text-amber-500 shrink-0 ml-2" />
                                )}
                              </div>

                              <div className="hidden md:block h-0.5 bg-slate-200 grow mx-2" />

                              {/* Step 3: Admin issues and requester receives */}
                              <div className="flex items-center gap-2">
                                <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold ${
                                  req.status === "issued" || req.status === "received" || req.status === "employee_confirmed" || req.status === "completed"
                                    ? "bg-sky-100 text-sky-600"
                                    : "bg-slate-100 text-slate-400"
                                }`}>
                                  3
                                </div>
                                <div>
                                  <p className={req.status === "issued" || req.status === "received" || req.status === "employee_confirmed" || req.status === "completed" ? "text-slate-800" : "text-slate-400 font-medium"}>
                                    แอดมินจ่ายสินค้า / ผู้รับยืนยัน
                                  </p>
                                </div>
                                {req.status === "received" || req.status === "employee_confirmed" || req.status === "completed" ? (
                                  <CheckSquare size={16} className="text-emerald-500 shrink-0 ml-2" />
                                ) : req.status === "cancelled" ? (
                                  <XCircle size={16} className="text-rose-500 shrink-0 ml-2" />
                                ) : (
                                  <Clock size={16} className="text-slate-300 shrink-0 ml-2" />
                                )}
                              </div>

                              <div className="hidden md:block h-0.5 bg-slate-200 grow mx-2" />
                              <div className="flex items-center gap-2">
                                <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold ${req.status === "completed" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>4</div>
                                <div><p className={req.status === "completed" ? "text-slate-800" : "text-slate-400 font-medium"}>แอดมินปิดใบเบิก</p></div>
                                {req.status === "completed" ? <CheckSquare size={16} className="text-emerald-500 shrink-0 ml-2" /> : <Clock size={16} className="text-slate-300 shrink-0 ml-2" />}
                              </div>

                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </Table>
        )}
      </DataPanel>
      </section>
    </>
  );
}
