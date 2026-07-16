"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageMinus, FileText, PackagePlus } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import { getClientAppSettings, getClientSession } from "@/lib/dashboard-client-cache";
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
  buildInventoryLotKey,
} from "@/lib/stock-flow/utils";
import { useTransactions } from "../TransactionContext";
import type { Transaction, TransactionType } from "@/types/stock-flow";
import type { StatCard } from "@/components/stock-flow/StatsGrid";
import { getRequisitionStatusClass, getRequisitionStatusLabel, RECEIVE_STATUS_LABEL } from "@/lib/stock-flow/status";
import { defaultAppSettings, type AppSettings } from "@/lib/app-settings-shared";

type HistoryFilter = "all" | TransactionType;
type UserRole = "employee" | "manager" | "admin";

type HistorySectionProps = {
  movementOverview: {
    transactions: Transaction[];
  };
  isGlobalView: boolean;
  movementStats: StatCard[];
  lotLabels: Map<string, string>;
  receivePrefix: string;
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

function getReceiveDocumentNo(item: Transaction, receivePrefix: string) {
  const documentSuffix = item.id.replace(/[^a-zA-Z0-9]/g, "").slice(-5).toUpperCase() || "00000";
  return `${receivePrefix || "IN"}-${item.date.replaceAll("-", "")}-${documentSuffix}`;
}

function HistorySection({
  movementOverview,
  isGlobalView,
  movementStats,
  lotLabels,
  receivePrefix,
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
            <h3 className="dashboard-section-title">บัญชีรับ-จ่ายสินค้า</h3>
            <p className="dashboard-subtitle">
              ใช้ตรวจรายการย้อนหลังของคลังเท่านั้น ไม่ใช่หน้าดำเนินการกับใบเบิก
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
            <h2 className="dashboard-section-title">รายการรับ-จ่ายย้อนหลัง</h2>
            <p className="dashboard-subtitle">
              {isGlobalView
                ? "ดูหลักฐานการเคลื่อนไหวของสินค้า ทั้งรับเข้าคลังและจ่ายออกจากใบเบิกที่ดำเนินการแล้ว"
                : "ใช้ตรวจย้อนหลังใบเบิกของคุณ วันที่เบิก และเวลาที่ระบบบันทึก"}
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
            const documentNo = isStockIn ? getReceiveDocumentNo(item, receivePrefix) : issueKey;
            const lotKey = buildInventoryLotKey(item);
            const lotLabel = lotLabels.get(lotKey) || "-";
            const relatedPerson = isStockIn
              ? item.requester || "จุดเก็บไม่ระบุ"
              : item.requester || "ผู้ขอไม่ระบุ";
            const canViewIssueDocument =
              !isStockIn &&
              issueKey !== "-" &&
              (!item.status ||
                item.status === "approved" ||
                item.status === "issued" ||
                item.status === "received" ||
                item.status === "employee_confirmed" ||
                item.status === "completed");

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
                    {canViewIssueDocument ? (
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
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [currentUserName, setCurrentUserName] = useState("");
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>("all");
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);
  const today = getLocalDateValue();

  useEffect(() => {
    getClientSession()
      .then((data) => {
        const user = data?.user;
        const role = user?.role;
        setCurrentRole(role === "admin" || role === "manager" ? role : "employee");
        setCurrentUserName(user?.name?.trim() || "");
      })
      .catch(() => {
        setCurrentRole("employee");
        setCurrentUserName("");
      });
    getClientAppSettings()
      .then((settings) => setAppSettings(settings))
      .catch(() => setAppSettings(defaultAppSettings));
  }, []);
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
  const isGlobalView = currentRole === "admin" || currentRole === "manager";

  const movementOverview = useMemo(() => {
    const movementTransactions = transactions
      .filter((item) => {
        if (isGlobalView) {
          return true;
        }

        return item.type === "out" && (item.requester || "").trim() === currentUserName;
      })
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
  }, [activeFilter, currentUserName, effectiveDateFrom, effectiveDateTo, isGlobalView, today, transactions]);

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
        helper: isGlobalView
          ? activeFilter === "all" ? "รวมรับเข้าและเบิกจ่าย" : "ตามตัวกรองที่เลือก"
          : "เฉพาะใบเบิกของคุณ",
        tone: "sky",
      },
      {
        label: "รับเข้าสินค้า",
        value: formatNumber(movementOverview.stockInCount),
        unit: "รายการ",
        helper: isGlobalView ? "ประวัติรับเข้าสินค้าทั้งหมด" : "คนทั่วไปดูประวัติรับเข้ารวมไม่ได้",
        tone: "emerald",
      },
      {
        label: "เบิกจ่ายสินค้า",
        value: formatNumber(movementOverview.stockOutCount),
        unit: "รายการ",
        helper: isGlobalView ? "ประวัติเบิกจ่ายสินค้าทั้งหมด" : "เฉพาะใบเบิกของคุณ",
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
    [activeFilter, isGlobalView, movementOverview]
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

  if (currentRole === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--text-muted)]">
        กำลังตรวจสอบสิทธิ์...
      </div>
    );
  }

  if (!isGlobalView) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="dashboard-card max-w-[480px] p-8 text-center shadow-xl backdrop-blur-xl">
          <h3 className="text-lg font-bold text-[var(--text-strong)]">ปฏิเสธการเข้าถึง</h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            พนักงานสามารถติดตามใบเบิกของตัวเองได้ที่หน้าติดตามสถานะการเบิก
          </p>
          <div className="mt-6">
            <Button type="button" onClick={() => router.push("/approve")}>
              กลับไปหน้าติดตามสถานะ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <HistorySection
      movementOverview={movementOverview}
      isGlobalView={isGlobalView}
      movementStats={movementStats}
      lotLabels={lotLabels}
      receivePrefix={appSettings.receivePrefix}
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
