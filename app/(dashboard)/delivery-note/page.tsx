"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import { Button } from "@/components/ui/button";
import { DataPanel } from "@/components/stock-flow/DataPanel";
import {
  buildInventoryMap,
  buildItemKey,
  normalizeTransactions,
  formatDate,
  formatNumber,
} from "@/lib/stock-flow/utils";
import type { Transaction } from "@/types/stock-flow";

export type IssueDeliveryDocument = {
  transaction: Transaction;
  transactions: Transaction[];
  rows: {
    transaction: Transaction;
    beforeBalance: number;
    afterBalance: number;
    costValue: number;
    storageLocation: string;
  }[];
  beforeBalance: number;
  afterBalance: number;
  costValue: number;
  documentNo: string;
  approvedDate: string;
};

type DeliveryNoteSectionProps = {
  deliveryDocument: IssueDeliveryDocument | null;
  setActiveSection: (val: string) => void;
  isLoading: boolean;
};

function formatDateTime(timestamp?: number) {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DeliveryNoteSection({
  deliveryDocument,
  setActiveSection,
  isLoading,
}: DeliveryNoteSectionProps) {
  if (isLoading) {
    return (
      <section id="delivery-note" className="grid gap-3">
        <div className="p-12 text-center text-sm text-[var(--text-muted)] font-medium bg-white rounded-xl border border-[var(--border-soft)] shadow-sm">
          กำลังดึงข้อมูลใบกำกับเบิกสินค้า...
        </div>
      </section>
    );
  }

  if (!deliveryDocument) {
    return (
      <section id="delivery-note" className="grid gap-3">
        <DataPanel
          title="ยังไม่มีใบกำกับเบิกสินค้า"
          description="เมื่อใบเบิกได้รับอนุมัติและคลังยืนยันจ่ายสินค้าแล้ว ระบบจะแสดงเอกสารใบกำกับเบิกสินค้าในหน้านี้"
        >
          <Button type="button" onClick={() => setActiveSection("approve")}>
            ไปหน้าจัดการใบเบิกสินค้า
          </Button>
        </DataPanel>
      </section>
    );
  }

  const requesterName = deliveryDocument.transaction.requester || "-";
  const createdByName = deliveryDocument.transaction.createdBy || deliveryDocument.transaction.requester || "-";
  const approverName = deliveryDocument.transaction.approver || "-";
  function handlePrint() {
    window.print();
  }

  return (
    <section id="delivery-note" className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-sky-600">
            Delivery Note
          </p>
          <h3 className="dashboard-section-title">เอกสารเบิกสินค้า</h3>
        </div>
        <Button type="button" onClick={handlePrint} className="gap-2">
          <Printer size={16} />
          พิมพ์เอกสาร
        </Button>
        <Button type="button" variant="secondary" onClick={() => setActiveSection("approve")}>
          กลับไปหน้าจัดการใบเบิกสินค้า
        </Button>
      </div>

      <article className="delivery-document">
        <header className="delivery-document-header">
          <h2>ใบเบิกสินค้า</h2>
          <p>เอกสารฉบับเดียวสำหรับอนุมัติ จ่าย รับ และปิดใบเบิก</p>
        </header>

        <div className="delivery-document-meta">
          <div>
            <p>จาก ระบบ CPAC SB&amp;M Inventory Management</p>
            <p>ผู้ขอเบิกสินค้า {requesterName}</p>
            <p>ผู้อนุมัติ {approverName}</p>
          </div>
          <div className="text-right">
            <p>
              หมายเลข <strong>{deliveryDocument.documentNo}</strong>
            </p>
            <p>สร้างใบเบิก {formatDateTime(deliveryDocument.transaction.createdAt)}</p>
            {deliveryDocument.transaction.receivedAt ? <p>รับสินค้า {formatDateTime(deliveryDocument.transaction.receivedAt)}</p> : null}
          </div>
        </div>

        <div className="delivery-table-wrap">
          <table className="delivery-table">
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>จำนวน</th>
                <th>ชื่อรายการ</th>
                <th>หน่วย</th>
                <th>สถานที่จัดเก็บ</th>
              </tr>
            </thead>
            <tbody>
              {deliveryDocument.rows.map((row, index) => (
                <tr key={`delivery-row-${row.transaction.id || index + 1}`}>
                  <td>{index + 1}</td>
                  <td className="text-right">{formatNumber(row.transaction.quantity)}</td>
                  <td>{row.transaction.name}</td>
                  <td>{row.transaction.unit}</td>
                  <td>{row.storageLocation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-left text-sm text-[var(--text-strong)]">
          <p>
            หมายเหตุ {deliveryDocument.transaction.note?.trim() || "................................"}
          </p>
        </div>

        <div className="delivery-print-spacer" aria-hidden="true" />

        <section className="delivery-summary-grid">
          <div>
            <p className="delivery-sign-line">ผู้จัดของ / แอดมิน ..............................................</p>
            <p>คนคีย์ใบเบิก {createdByName}</p>
          </div>
          <div>
            <p className="delivery-sign-line">ผู้รับสินค้า ..............................................</p>
            <p className="delivery-sign-line">ลายเซ็นผู้รับ ......................................</p>
          </div>
          <div>
            <p className="delivery-sign-line">วันที่รับ ....../....../...... ............ น.</p>
          </div>
        </section>
      </article>
    </section>
  );
}

function DeliveryNoteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const issueKey = searchParams.get("issueKey") || "";
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchTransactions() {
    setIsLoading(true);
    try {
      const res = await fetch(withBasePath("/api/transactions"));
      if (res.ok) {
        const data = await res.json();
        setTransactions(normalizeTransactions(data));
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchTransactions();
  }, []);

  const deliveryDocument = useMemo<IssueDeliveryDocument | null>(() => {
    if (!issueKey || transactions.length === 0) {
      return null;
    }

    const docTransactions = transactions.filter((t) => t.issueKey === issueKey);
    if (docTransactions.length === 0) {
      return null;
    }

    const firstTransaction = docTransactions[0];
    // Security check: Only allow approved, completed (or legacy) requisitions to be viewed
    if (
      firstTransaction.status &&
      firstTransaction.status !== "approved" &&
      firstTransaction.status !== "issued" &&
      firstTransaction.status !== "received" &&
      firstTransaction.status !== "employee_confirmed" &&
      firstTransaction.status !== "completed"
    ) {
      return null;
    }
    const currentInventory = buildInventoryMap(transactions);
    const rows = docTransactions.map((transaction) => {
      const currentItem = currentInventory.get(buildItemKey(transaction));
      const afterBalance = currentItem?.balance ?? 0;
      const beforeBalance = afterBalance + transaction.quantity;
      const storageLocation =
        transactions.find(
          (item) =>
            item.type === "in" &&
            buildItemKey(item) === buildItemKey(transaction) &&
            (item.expiryDate || "") === (transaction.expiryDate || "") &&
            String(item.requester || "").trim()
        )?.requester || "-";

      return {
        transaction,
        beforeBalance,
        afterBalance,
        costValue: transaction.quantity * (transaction.costPrice ?? 0),
        storageLocation,
      };
    });

    return {
      transaction: firstTransaction,
      transactions: docTransactions,
      rows,
      beforeBalance: rows[0]?.beforeBalance ?? 0,
      afterBalance: rows[0]?.afterBalance ?? 0,
      costValue: rows.reduce((sum, row) => sum + row.costValue, 0),
      documentNo: issueKey,
      approvedDate: firstTransaction.date,
    };
  }, [issueKey, transactions]);

  function handleBack(sectionId: string) {
    router.push(`/${sectionId}`);
  }

  return (
    <DeliveryNoteSection
      deliveryDocument={deliveryDocument}
      setActiveSection={handleBack}
      isLoading={isLoading}
    />
  );
}

export default function DeliveryNotePage() {
  return (
    <Suspense fallback={<div className="p-5 text-center text-sm text-[var(--text-muted)]">กำลังดึงข้อมูลใบเบิก...</div>}>
      <DeliveryNoteContent />
    </Suspense>
  );
}
