"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
          description="เมื่อ Approved และยืนยันเบิกสินค้าแล้ว ระบบจะแสดงเอกสารใบกำกับเบิกสินค้าในหน้านี้"
        >
          <Button type="button" onClick={() => setActiveSection("issue")}>
            ไปหน้านำออกสินค้า
          </Button>
        </DataPanel>
      </section>
    );
  }

  const documentTransactions =
    deliveryDocument.transactions?.length > 0
      ? deliveryDocument.transactions
      : [deliveryDocument.transaction];
  return (
    <section id="delivery-note" className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-sky-600">
            Delivery Note
          </p>
          <h3 className="dashboard-section-title">เอกสารเบิกสินค้า</h3>
        </div>
        <Button type="button" variant="secondary" onClick={() => setActiveSection("history")}>
          กลับไปประวัติภาพรวม
        </Button>
      </div>

      <article className="delivery-document">
        <header className="delivery-document-header">
          <h2>ใบจัดของ</h2>
          <p>เอกสารสำหรับจัดเตรียมสินค้าออกจากคลัง</p>
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
                <th>รหัสสินค้า</th>
                <th>ชื่อสินค้า</th>
                <th>วันหมดอายุ</th>
                <th>จำนวน</th>
                <th>หน่วย</th>
              </tr>
            </thead>
            <tbody>
              {documentTransactions.map((transaction, index) => (
                <tr key={`delivery-row-${transaction.id || index + 1}`}>
                  <td>{index + 1}</td>
                  <td>{transaction.sku || "-"}</td>
                  <td>{transaction.name}</td>
                  <td>{transaction.expiryDate ? formatDate(transaction.expiryDate) : "-"}</td>
                  <td className="text-right">{formatNumber(transaction.quantity)}</td>
                  <td>{transaction.unit}</td>
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
            <p>ผู้จัดของ ..............................................</p>
            <p>ตรวจสอบสินค้า ........................................</p>
          </div>
          <div>
            <p>พื้นที่จัดเตรียม ......................................</p>
          </div>
          <div>
            <p>เวลาจัดของ ....../....../...... ............ น.</p>
            <p>ผู้รับมอบจากคลัง ................................</p>
          </div>
        </section>
      </article>

      <article className="delivery-document delivery-document-break">
        <header className="delivery-document-header">
          <h2>ใบกำกับส่งของ</h2>
          <p>เอกสารสำหรับส่งมอบสินค้าให้ผู้ขอเบิก</p>
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
              {documentTransactions.map((transaction, index) => (
                <tr key={`delivery-note-row-${transaction.id || index + 1}`}>
                  <td>{index + 1}</td>
                  <td>ISSUE</td>
                  <td>{deliveryDocument.documentNo}</td>
                  <td>{transaction.name}</td>
                  <td>{transaction.requester || "-"}</td>
                  <td className="text-right">{formatNumber(transaction.quantity)}</td>
                  <td>{transaction.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="delivery-print-spacer" aria-hidden="true" />

        <section className="delivery-summary-grid delivery-summary-grid-single">
          <div>
            <p>ผู้ออกเอกสาร ................................</p>
            <p>
              ผู้อนุมัตินำส่ง {deliveryDocument.transaction.approver || ".............................."}
            </p>
          </div>
        </section>

        <section className="delivery-detail-footer delivery-detail-footer-compact">
          <div className="delivery-footer-box">
            <p>
              ชื่อผู้รับของ {deliveryDocument.transaction.requester || "................................"}
            </p>
            <p>วันที่ถึง ....../....../...... เวลา ............ น.</p>
            <p>ผู้รับโปรดเซ็นชื่อพร้อมประทับตรา</p>
          </div>
          <div className="delivery-footer-box">
            <p>รายการตรวจรับของไม่ครบ</p>
            <p>รายการที่ ........................ จำนวน ............</p>
            <p>ผู้รับของ ........................................</p>
            <p>ผู้รับจ้างขนส่ง ..................................</p>
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
      firstTransaction.status !== "completed"
    ) {
      return null;
    }
    const currentInventory = buildInventoryMap(transactions);
    const rows = docTransactions.map((transaction) => {
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
