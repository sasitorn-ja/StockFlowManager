"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsGrid } from "@/components/stock-flow/StatsGrid";
import { DataPanel } from "@/components/stock-flow/DataPanel";
import { Table } from "@/components/stock-flow/Table";
import { StatusBadge } from "@/components/stock-flow/StatusBadge";
import {
  buildInventoryMap,
  buildItemKey,
  formatDate,
  formatNumber,
  formatCurrency,
  formatCurrencyWithLabel,
  getLocalDateValue,
  getProductImportTypeLabel,
} from "@/lib/stock-flow/utils";
import { useTransactions } from "../TransactionContext";
import { LOW_STOCK_THRESHOLD } from "@/lib/stock-flow/constants";
import type { Transaction, InventoryItem } from "@/types/stock-flow";

export default function ApprovePage() {
  const router = useRouter();
  const { transactions } = useTransactions();
  const [pendingIssueBatch, setPendingIssueBatch] = useState<Transaction[]>([]);
  const [isPendingIssueApproved, setIsPendingIssueApproved] = useState(false);
  const [approvedDate, setApprovedDate] = useState("");
  const [isApprovalDetailOpen, setIsApprovalDetailOpen] = useState(false);

  useEffect(() => {
    // Read pending batch from localStorage
    const cached = localStorage.getItem("pending_issue_batch");
    if (cached) {
      setPendingIssueBatch(JSON.parse(cached));
    }
  }, []);

  const inventory = useMemo(() => [...buildInventoryMap(transactions).values()], [transactions]);

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
    pendingIssueBatch.length > 0 &&
    Boolean(isPendingIssueApproved) &&
    (pendingIssueBatchStatus ? !pendingIssueBatchStatus.hasInsufficientStock : false);

  const pendingApprovalDetails = useMemo(() => {
    if (pendingIssueBatchStatus) {
      return pendingIssueBatchStatus.rows.map((row) => ({
        issueKey: row.transaction.issueKey || "-",
        requester: row.transaction.requester || "-",
        approver: row.transaction.approver || "-",
        approvedDate: approvedDate || getLocalDateValue(),
      }));
    }
    return [];
  }, [approvedDate, pendingIssueBatchStatus]);

  function approvePendingIssue() {
    setIsPendingIssueApproved(true);
    setApprovedDate(getLocalDateValue());
    setIsApprovalDetailOpen(false);
  }

  function handleBackToEdit() {
    // Keep pending_draft so `/issue` page can restore it, but clear batch
    localStorage.removeItem("pending_issue_batch");
    router.push("/issue");
  }

  function confirmIssueTransaction() {
    if (pendingIssueBatch.length === 0) {
      return;
    }

    if (!isPendingIssueApproved) {
      window.alert("ต้องมีคนกด Approved ก่อน จึงจะยืนยันเบิกสินค้าได้");
      return;
    }

    const firstTransaction = pendingIssueBatch[0];
    const documentNo =
      firstTransaction.issueKey || `ISS-${String(firstTransaction.createdAt).slice(-6)}`;

    // Persist to Neon Database
    fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingIssueBatch),
    }).then((res) => {
      if (res.ok) {
        // Clear caches
        localStorage.removeItem("pending_issue_batch");
        localStorage.removeItem("pending_draft");
        // Redirect to delivery note page with query parameters
        router.push(`/delivery-note?issueKey=${encodeURIComponent(documentNo)}`);
      } else {
        window.alert("ไม่สามารถบันทึกข้อมูลใบเบิกรวมเข้าฐานข้อมูล Neon ได้");
      }
    });
  }

  return (
    <section id="approve" className="grid gap-4">
      <section className="dashboard-card">
        <div className="dashboard-panel-header">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-sky-600">
              Approval Center
            </p>
            <h3 className="dashboard-section-title">Approve ใบเบิกสินค้า</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              ใช้สำหรับกดอนุมัติรายการเบิก ก่อนตรวจสอบและยืนยันตัดสต๊อกจริง
            </p>
          </div>
          <div className="dashboard-header-actions">
            <Button
              type="button"
              onClick={approvePendingIssue}
              disabled={isPendingIssueApproved || pendingIssueBatch.length === 0}
            >
              {isPendingIssueApproved ? "Approved แล้ว" : "Approved"}
            </Button>
          </div>
        </div>
      </section>

      {pendingIssueBatchStatus ? (
        <div className="grid gap-4">
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

          <div className="approval-footer flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] bg-white p-4">
            {!pendingIssueBatchStatus.hasInsufficientStock ? (
              <div className="approval-action-group flex items-center gap-2">
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
            ) : (
              <div />
            )}
            <div className="approval-right-actions flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={handleBackToEdit}>
                กลับไปแก้ไข
              </Button>
              <Button
                type="button"
                onClick={confirmIssueTransaction}
                disabled={!pendingIssueCanConfirm}
              >
                ยืนยันเบิกสินค้า
              </Button>
            </div>
          </div>

          {isPendingIssueApproved && isApprovalDetailOpen ? (
            <section className="approval-detail-panel rounded-lg border border-[var(--border)] bg-white p-4">
              <div className="approval-detail-header flex items-center justify-between pb-3 border-b border-[var(--border-soft)] mb-3">
                <strong>รายละเอียดผู้อนุมัติ</strong>
                <span className="text-sm text-[var(--text-muted)]">
                  {formatDate(approvedDate || getLocalDateValue())}
                </span>
              </div>
              <div className="approval-detail-list grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {pendingApprovalDetails.map((item, index) => (
                  <article
                    key={`approval-detail-${item.issueKey}-${index}`}
                    className="p-3 rounded-md bg-[var(--bg-muted)] border border-[var(--border-muted)]"
                  >
                    <span className="block text-[12px] text-[var(--text-muted)]">
                      เลขใบเบิก {item.issueKey}
                    </span>
                    <strong className="block text-sm">{item.approver}</strong>
                    <small className="block text-[11px] text-[var(--text-subtle)]">
                      ผู้ขอเบิก: {item.requester}
                    </small>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <DataPanel
          title="ยังไม่มีรายการรออนุมัติ"
          description="เมื่อคีย์เบิกจ่ายในเมนูเบิกจ่ายสินค้าแล้ว รายการรออนุมัติจะแสดงในหน้านี้"
        >
          <Button type="button" onClick={() => router.push("/issue")}>
            ไปหน้าเบิกจ่ายสินค้า
          </Button>
        </DataPanel>
      )}
    </section>
  );
}
