"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageMinus, FileText, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsGrid } from "@/components/stock-flow/StatsGrid";
import { Table } from "@/components/stock-flow/Table";
import {
  formatNumber,
  getLocalDateValue,
  formatDate,
  formatCurrencyWithLabel,
  getProductImportTypeLabel,
  buildInventoryLotMap,
  buildItemKey,
} from "@/lib/stock-flow/utils";
import { useTransactions } from "../TransactionContext";
import type { Transaction, TransactionType } from "@/types/stock-flow";
import type { StatCard } from "@/components/stock-flow/StatsGrid";
import { getRequisitionStatusClass, getRequisitionStatusLabel, RECEIVE_STATUS_LABEL } from "@/lib/stock-flow/status";

type HistoryFilter = "all" | TransactionType;

type HistorySectionProps = {
  movementOverview: {
    transactions: Transaction[];
  };
  movementStats: StatCard[];
  lotLabels: Map<string, string>;
  activeFilter: HistoryFilter;
  dateFrom: string;
  dateTo: string;
  earliestDate: string;
  onFilterChange: (filter: HistoryFilter) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  openDeliveryDocumentFromHistory: (issueKey: string) => void;
};

const historyFilters: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "in", label: "รับเข้า" },
  { value: "out", label: "เบิกจ่าย" },
];

function getReceiveDocumentNo(item: Transaction) {
  const documentSuffix = item.id.replace(/[^a-zA-Z0-9]/g, "").slice(-5).toUpperCase() || "00000";
  return `IN-${item.date.replaceAll("-", "")}-${documentSuffix}`;
}

function HistorySection({
  movementOverview,
  movementStats,
  lotLabels,
  activeFilter,
  dateFrom,
  dateTo,
  earliestDate,
  onFilterChange,
  onDateFromChange,
  onDateToChange,
  openDeliveryDocumentFromHistory,
}: HistorySectionProps) {
  return (
    <section id="history" className="grid gap-3">
      <div className="dashboard-category-header">
        <div className="history-header-left">
          <div>
            <h3 className="dashboard-section-title">ประวัติรับเข้า-เบิกจ่ายสินค้า</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              รวมความเคลื่อนไหวสินค้าเข้าและออก เรียงตามเวลาที่บันทึกล่าสุด
            </p>
          </div>
          <div className="history-filter-row">
            <div className="dashboard-category-switch history-type-switch">
              {historyFilters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`dashboard-category-switch-option ${
                    activeFilter === item.value ? "dashboard-category-switch-option-active" : ""
                  }`}
                  onClick={() => onFilterChange(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="overview-date-range history-date-range">
              <label className="overview-date-input">
                <span>จากวันที่</span>
                <input
                  type="date"
                  value={dateFrom}
                  min={earliestDate}
                  max={dateTo}
                  onChange={(event) => onDateFromChange(event.target.value)}
                />
              </label>
              <span className="overview-date-separator">-</span>
              <label className="overview-date-input">
                <span>ถึงวันที่</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  max={getLocalDateValue()}
                  onChange={(event) => onDateToChange(event.target.value)}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <StatsGrid stats={movementStats} />

      <section className="history-table-section">
        <div className="history-table-header">
          <div>
            <h2 className="dashboard-section-title">รายการเคลื่อนไหวทั้งหมด</h2>
            <p className="dashboard-subtitle">
              ใช้ตรวจย้อนหลังได้ทั้งวันที่รับเข้า วันที่เบิก และเวลาที่ระบบบันทึก
            </p>
          </div>
        </div>
        <Table
          headers={[
            "วันที่รายการ / เวลาบันทึก",
            "ประเภท",
            "เลขเอกสาร",
            "สินค้า",
            "ล็อต",
            "ประเภทสินค้า",
            "หมวดหมู่",
            "จำนวน",
            "มูลค่าต้นทุน",
            "ผู้ดำเนินการ",
            "หมายเหตุ",
            "สถานะ / เอกสาร",
          ]}
          emptyMessage="ยังไม่มีประวัติรายการสินค้า"
          columnCount={12}
        >
          {movementOverview.transactions.map((item) => {
            const issueKey = item.issueKey || "-";
            const isStockIn = item.type === "in";
            const documentNo = isStockIn ? getReceiveDocumentNo(item) : issueKey;
            const lotKey = `${buildItemKey(item)}::${item.expiryDate || "no-expiry"}`;
            const lotLabel = lotLabels.get(lotKey) || "-";
            const relatedPerson = isStockIn
              ? item.requester || "จุดเก็บไม่ระบุ"
              : item.requester || "ผู้ขอไม่ระบุ";

            return (
              <tr key={`history-${item.id}`} className="history-group-row">
                <td>
                  <strong className="font-semibold text-[var(--text-strong)]">
                    {formatDate(item.date)}
                  </strong>
                  <div className="text-[12px] text-[var(--text-muted)]">
                    บันทึก{" "}
                    {new Date(item.createdAt).toLocaleTimeString("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </td>
                <td>
                  <span
                    className={`history-type-pill ${
                      isStockIn ? "history-type-pill-in" : "history-type-pill-out"
                    }`}
                  >
                    {isStockIn ? (
                      <>
                        <PackagePlus size={13} />
                        รับเข้า
                      </>
                    ) : (
                      <>
                        <PackageMinus size={13} />
                        เบิกจ่าย
                      </>
                    )}
                  </span>
                </td>
                <td>
                  <strong className="font-semibold text-[var(--text-strong)]">
                    {documentNo}
                  </strong>
                  {!isStockIn && issueKey !== "-" ? (
                    <div className="history-group-label">ใบเบิกสินค้า</div>
                  ) : null}
                </td>
                <td>
                  <strong className="font-semibold text-[var(--text-strong)]">{item.name}</strong>
                  <div className="text-[12px] text-[var(--text-muted)]">{item.sku || "-"}</div>
                </td>
                <td className="whitespace-nowrap font-semibold text-[var(--text-strong)]">
                  {lotLabel}
                </td>
                <td>{getProductImportTypeLabel(item.productImportType)}</td>
                <td>{item.category}</td>
                <td className="text-right">
                  {formatNumber(item.quantity)}{" "}
                  <span className="text-[12px] text-[var(--text-subtle)]">{item.unit}</span>
                </td>
                <td className="text-right">
                  {formatCurrencyWithLabel(
                    item.quantity * (item.costPrice ?? 0),
                    item.costCurrency
                  )}
                </td>
                <td>
                  <strong className="font-semibold text-[var(--text-strong)]">
                    {isStockIn ? "คลัง/จุดเก็บ" : "ผู้ขอเบิก"}
                  </strong>
                  <div className="text-[12px] text-[var(--text-muted)]">{relatedPerson}</div>
                </td>
                <td className="text-[12px] text-[var(--text-muted)]">{item.note || "-"}</td>
                <td>
                  <div className="history-action-stack">
                    <span className={`stock-pill ${isStockIn ? "stock-pill-ok" : getRequisitionStatusClass(item.status)}`}>
                      {isStockIn ? RECEIVE_STATUS_LABEL : getRequisitionStatusLabel(item.status)}
                    </span>
                    {!isStockIn && issueKey !== "-" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => openDeliveryDocumentFromHistory(issueKey)}
                      >
                        <FileText size={14} />
                        ดูใบเบิก
                      </Button>
                    ) : null}
                  </div>
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
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>("all");
  const today = getLocalDateValue();
  const earliestTransactionDate = useMemo(() => {
    if (transactions.length === 0) {
      return today;
    }

    return transactions
      .map((item) => item.date)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))[0] || today;
  }, [today, transactions]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const effectiveDateFrom = dateFrom || earliestTransactionDate;
  const effectiveDateTo = dateTo || today;

  const movementOverview = useMemo(() => {
    const movementTransactions = transactions
      .filter((item) => activeFilter === "all" || item.type === activeFilter)
      .filter((item) => item.date >= effectiveDateFrom && item.date <= effectiveDateTo)
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);
    const stockInTransactions = movementTransactions.filter((item) => item.type === "in");
    const stockOutTransactions = movementTransactions.filter((item) => item.type === "out");

    return {
      transactions: movementTransactions,
      totalMovements: movementTransactions.length,
      stockInCount: stockInTransactions.length,
      stockOutCount: stockOutTransactions.length,
      totalQuantity: movementTransactions.reduce((sum, item) => sum + item.quantity, 0),
      totalCostValue: movementTransactions.reduce(
        (sum, item) => sum + item.quantity * (item.costPrice ?? 0),
        0
      ),
      todayMovements: movementTransactions.filter((item) => item.date === today).length,
    };
  }, [activeFilter, effectiveDateFrom, effectiveDateTo, today, transactions]);

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

  const movementStats: StatCard[] = useMemo(
    () => [
      {
        label: "รายการทั้งหมด",
        value: formatNumber(movementOverview.totalMovements),
        unit: "รายการ",
        helper: activeFilter === "all" ? "รวมรับเข้าและเบิกจ่าย" : "ตามตัวกรองที่เลือก",
        tone: "sky",
      },
      {
        label: "รับเข้าสินค้า",
        value: formatNumber(movementOverview.stockInCount),
        unit: "รายการ",
        helper: "ประวัติรับเข้าสินค้าทั้งหมด",
        tone: "emerald",
      },
      {
        label: "เบิกจ่ายสินค้า",
        value: formatNumber(movementOverview.stockOutCount),
        unit: "รายการ",
        helper: "ประวัติเบิกจ่ายสินค้าทั้งหมด",
        tone: "orange",
      },
      {
        label: "จำนวนรวม",
        value: formatNumber(movementOverview.totalQuantity),
        unit: "หน่วย",
        helper: "รวมจำนวนตามตัวกรองที่เลือก",
        tone: "amber",
      },
      {
        label: "มูลค่าต้นทุน",
        value: formatCurrencyWithLabel(movementOverview.totalCostValue, "THB"),
        helper: "คำนวณจากต้นทุนของรายการ",
        tone: "violet",
      },
      {
        label: "รายการวันนี้",
        value: formatNumber(movementOverview.todayMovements),
        unit: "รายการ",
        helper: "อ้างอิงจากวันที่รายการ",
        tone: "sky",
      },
    ],
    [activeFilter, movementOverview]
  );

  function openDeliveryDocumentFromHistory(issueKey: string) {
    router.push(`/delivery-note?issueKey=${encodeURIComponent(issueKey)}`);
  }

  function handleDateFromChange(value: string) {
    setDateFrom(value);
    if (value > effectiveDateTo) {
      setDateTo(value);
    }
  }

  function handleDateToChange(value: string) {
    setDateTo(value);
    if (value < effectiveDateFrom) {
      setDateFrom(value);
    }
  }

  return (
    <HistorySection
      movementOverview={movementOverview}
      movementStats={movementStats}
      lotLabels={lotLabels}
      activeFilter={activeFilter}
      dateFrom={effectiveDateFrom}
      dateTo={effectiveDateTo}
      earliestDate={earliestTransactionDate}
      onFilterChange={setActiveFilter}
      onDateFromChange={handleDateFromChange}
      onDateToChange={handleDateToChange}
      openDeliveryDocumentFromHistory={openDeliveryDocumentFromHistory}
    />
  );
}
