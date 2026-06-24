"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { PackageMinus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsGrid } from "@/components/stock-flow/StatsGrid";
import { Table } from "@/components/stock-flow/Table";
import {
  buildInventoryMap,
  formatNumber,
  formatCurrency,
  getLocalDateValue,
  formatDate,
  formatCurrencyWithLabel,
  getProductImportTypeLabel,
} from "@/lib/stock-flow/utils";
import { useTransactions } from "../TransactionContext";
import type { Transaction } from "@/types/stock-flow";
import type { StatCard } from "@/components/stock-flow/StatsGrid";

type HistorySectionProps = {
  issueOverview: {
    transactions: Transaction[];
  };
  issueHistoryStats: StatCard[];
  openIssueDialog: () => void;
  openDeliveryDocumentFromHistory: (issueKey: string) => void;
};

function HistorySection({
  issueOverview,
  issueHistoryStats,
  openIssueDialog,
  openDeliveryDocumentFromHistory,
}: HistorySectionProps) {
  return (
    <section id="history" className="grid gap-3">
      <div className="dashboard-category-header">
        <div className="history-header-left">
          <div>
            <h3 className="dashboard-section-title">ประวัติภาพรวมการขอเบิกสินค้า</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              รวมข้อมูลใบเบิกทั้งหมด จำนวนที่เบิก และรายละเอียดรายการจ่ายออก
            </p>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={openIssueDialog}>
          <PackageMinus size={16} />
          สร้างใบเบิกใหม่
        </Button>
      </div>

      <StatsGrid stats={issueHistoryStats} />

      <section className="history-table-section">
        <div className="history-table-header">
          <div>
            <h2 className="dashboard-section-title">รายการขอเบิกทั้งหมด</h2>
            <p className="dashboard-subtitle">
              เรียงจากใบเบิกล่าสุดไปเก่าสุด พร้อมประเภทสินค้าและ Key เบิก
            </p>
          </div>
        </div>
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
                className={`history-group-row ${isGroupStart ? "history-group-start" : ""} ${
                  isGroupEnd ? "history-group-end" : ""
                }`}
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
                  <strong className="font-semibold text-[var(--text-strong)]">{item.name}</strong>
                  <div className="text-[12px] text-[var(--text-muted)]">{item.sku || "-"}</div>
                </td>
                <td>{getProductImportTypeLabel(item.productImportType)}</td>
                <td>{item.category}</td>
                <td className="text-right">
                  {formatNumber(item.quantity)}{" "}
                  <span className="text-[12px] text-[var(--text-subtle)]">{item.unit}</span>
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
                <td className="text-[12px] text-[var(--text-muted)]">{item.note || "-"}</td>
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
      </section>
    </section>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const { transactions } = useTransactions();

  const inventory = useMemo(() => [...buildInventoryMap(transactions).values()], [transactions]);

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
    ],
    [issueOverview]
  );

  function openIssueDialog() {
    router.push("/issue");
  }

  function openDeliveryDocumentFromHistory(issueKey: string) {
    router.push(`/delivery-note?issueKey=${encodeURIComponent(issueKey)}`);
  }

  return (
    <HistorySection
      issueOverview={issueOverview}
      issueHistoryStats={issueHistoryStats}
      openIssueDialog={openIssueDialog}
      openDeliveryDocumentFromHistory={openDeliveryDocumentFromHistory}
    />
  );
}
