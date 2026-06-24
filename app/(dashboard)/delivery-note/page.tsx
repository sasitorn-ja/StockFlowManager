"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataPanel } from "@/components/stock-flow/DataPanel";
import {
  buildInventoryMap,
  buildItemKey,
  formatDate,
  formatNumber,
  formatCurrencyWithLabel,
  getProductImportTypeLabel,
} from "@/lib/stock-flow/utils";
import type { Transaction } from "@/types/stock-flow";
import { useTransactions } from "../TransactionContext";

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
};

function DeliveryNoteSection({
  deliveryDocument,
  setActiveSection,
}: DeliveryNoteSectionProps) {
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
    <section id="delivery-note" className="grid gap-3">
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
            <p>
              ผู้อนุมัตินำส่ง {deliveryDocument.transaction.approver || ".............................."}
            </p>
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
                      `${row.transaction.name}: ${formatNumber(row.afterBalance)} ${
                        row.transaction.unit
                      }`
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
    </section>
  );
}

function DeliveryNoteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const issueKey = searchParams.get("issueKey") || "";
  const { transactions } = useTransactions();

  const deliveryDocument = useMemo<IssueDeliveryDocument | null>(() => {
    if (!issueKey || transactions.length === 0) {
      return null;
    }

    const docTransactions = transactions.filter((t) => t.issueKey === issueKey);
    if (docTransactions.length === 0) {
      return null;
    }

    const firstTransaction = docTransactions[0];
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
