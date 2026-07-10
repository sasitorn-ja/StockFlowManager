"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BarChart3, ClipboardList, ClipboardPlus, Database, PackageMinus } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import { LOW_STOCK_THRESHOLD } from "@/lib/stock-flow/constants";
import {
  addDays,
  buildInventoryMap,
  formatDate,
  formatNumber,
  getLocalDateValue,
} from "@/lib/stock-flow/utils";
import type { Transaction } from "@/types/stock-flow";
import { useTransactions } from "../TransactionContext";

const MAX_OVERVIEW_DAY_RANGE = 29;

type UserRole = "employee" | "manager" | "admin";

type SessionUser = {
  name: string;
  email?: string;
  role: UserRole;
};

type RequisitionSummary = {
  issueKey: string;
  requester: string;
  createdBy: string;
  date: string;
  createdAt: number;
  itemCount: number;
  totalQuantity: number;
  status: Transaction["status"];
};

function clampDate(value: string, min: string, max: string) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function canViewStockOverviewRole(role: UserRole) {
  return role === "admin" || role === "manager";
}

function groupRequisitions(transactions: Transaction[]) {
  const requisitionMap = new Map<string, RequisitionSummary>();

  transactions
    .filter((transaction) => transaction.type === "out" && transaction.issueKey)
    .forEach((transaction) => {
      const current = requisitionMap.get(transaction.issueKey) || {
        issueKey: transaction.issueKey,
        requester: transaction.requester || "-",
        createdBy: transaction.createdBy || "",
        date: transaction.date,
        createdAt: transaction.createdAt,
        itemCount: 0,
        totalQuantity: 0,
        status: transaction.status || "completed",
      };

      current.itemCount += 1;
      current.totalQuantity += transaction.quantity;
      current.createdAt = Math.max(current.createdAt, transaction.createdAt);
      current.status = transaction.status || current.status;
      requisitionMap.set(transaction.issueKey, current);
    });

  return Array.from(requisitionMap.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export default function OverviewPage() {
  const router = useRouter();
  const { transactions } = useTransactions();
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [overviewDateFrom, setOverviewDateFrom] = useState(() => addDays(getLocalDateValue(), -6));
  const [overviewDateTo, setOverviewDateTo] = useState(getLocalDateValue);

  const userRole = currentUser?.role ?? "employee";
  const canViewStockOverview = canViewStockOverviewRole(userRole);
  const currentUserName = currentUser?.name?.trim() || "";

  useEffect(() => {
    fetch(withBasePath("/api/auth/session"), { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const user = data?.user;
        const role: UserRole = user?.role === "admin" || user?.role === "manager" ? user.role : "employee";
        setCurrentUser(user ? { name: user.name ?? "ผู้ใช้งาน", email: user.email, role } : null);
      })
      .catch(() => setCurrentUser(null))
      .finally(() => setIsCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!isCheckingSession && !canViewStockOverview) {
      router.replace("/approve");
    }
  }, [canViewStockOverview, isCheckingSession, router]);

  const earliestAllowedOverviewDateFrom = useMemo(
    () => addDays(overviewDateTo, -MAX_OVERVIEW_DAY_RANGE),
    [overviewDateTo]
  );

  useEffect(() => {
    if (overviewDateFrom < earliestAllowedOverviewDateFrom) {
      setOverviewDateFrom(earliestAllowedOverviewDateFrom);
    }
  }, [earliestAllowedOverviewDateFrom, overviewDateFrom]);

  const handleOverviewDateFromChange = (value: string) => {
    setOverviewDateFrom(clampDate(value, earliestAllowedOverviewDateFrom, overviewDateTo));
  };

  const handleOverviewDateToChange = (value: string) => {
    setOverviewDateTo(clampDate(value, overviewDateFrom, getLocalDateValue()));
  };

  const transactionsUntilOverviewDate = useMemo(
    () => transactions.filter((item) => item.date <= overviewDateTo),
    [overviewDateTo, transactions]
  );

  const rangeTransactions = useMemo(
    () =>
      transactions.filter((item) => item.date >= overviewDateFrom && item.date <= overviewDateTo),
    [overviewDateFrom, overviewDateTo, transactions]
  );

  const ownTransactionsUntilOverviewDate = useMemo(
    () =>
      transactionsUntilOverviewDate.filter(
        (item) =>
          item.type === "out" &&
          ((item.createdBy || "").trim() === currentUserName ||
            (!(item.createdBy || "").trim() && (item.requester || "").trim() === currentUserName))
      ),
    [currentUserName, transactionsUntilOverviewDate]
  );

  const ownRangeTransactions = useMemo(
    () =>
      rangeTransactions.filter(
        (item) =>
          item.type === "out" &&
          ((item.createdBy || "").trim() === currentUserName ||
            (!(item.createdBy || "").trim() && (item.requester || "").trim() === currentUserName))
      ),
    [currentUserName, rangeTransactions]
  );

  const chartTransactions = canViewStockOverview ? rangeTransactions : ownRangeTransactions;
  const inventory = useMemo(
    () => [...buildInventoryMap(transactionsUntilOverviewDate).values()],
    [transactionsUntilOverviewDate]
  );

  const ownRequisitions = useMemo(
    () => groupRequisitions(ownTransactionsUntilOverviewDate),
    [ownTransactionsUntilOverviewDate]
  );

  const lowStockInventory = useMemo(
    () =>
      inventory
        .filter((item) => item.balance <= LOW_STOCK_THRESHOLD)
        .sort((a, b) => a.balance - b.balance)
        .slice(0, 5),
    [inventory]
  );

  const overviewStats = useMemo(() => {
    if (!canViewStockOverview) {
      const pendingCount = ownRequisitions.filter((item) => item.status === "pending").length;
      const approvedCount = ownRequisitions.filter(
        (item) => item.status === "approved" || item.status === "issued" || item.status === "received" || item.status === "employee_confirmed"
      ).length;
      const completedCount = ownRequisitions.filter((item) => item.status === "completed").length;
      const ownStockOutToday = ownRangeTransactions
        .filter((item) => item.date === overviewDateTo)
        .reduce((sum, item) => sum + item.quantity, 0);

      return [
        {
          label: "ใบเบิกของฉัน",
          value: formatNumber(ownRequisitions.length),
          unit: "ใบ",
          helper: "เฉพาะรายการที่คุณเป็นผู้ขอ",
          icon: ClipboardList,
          tone: "sky" as const,
        },
        {
          label: "รออนุมัติ",
          value: formatNumber(pendingCount),
          unit: "ใบ",
          helper: "รอผู้จัดการตรวจสอบ",
          icon: AlertTriangle,
          tone: "amber" as const,
          valueTone: pendingCount > 0 ? ("danger" as const) : undefined,
        },
        {
          label: "อนุมัติแล้ว",
          value: formatNumber(approvedCount),
          unit: "ใบ",
          helper: `สำเร็จแล้ว ${formatNumber(completedCount)} ใบ`,
          icon: ClipboardPlus,
          tone: "emerald" as const,
        },
        {
          label: "เบิกวันนี้",
          value: formatNumber(ownStockOutToday),
          unit: "หน่วย",
          helper: formatDate(overviewDateTo),
          icon: PackageMinus,
          tone: "orange" as const,
        },
      ];
    }

    const stockInToday = transactions
      .filter((item) => item.date === overviewDateTo && item.type === "in")
      .reduce((sum, item) => sum + item.quantity, 0);
    const stockOutToday = transactions
      .filter((item) => item.date === overviewDateTo && item.type === "out")
      .reduce((sum, item) => sum + item.quantity, 0);
    const lowStockCount = inventory.filter((item) => item.balance <= LOW_STOCK_THRESHOLD).length;

    return [
      {
        label: "สินค้าในคลัง",
        value: formatNumber(inventory.length),
        unit: "รายการ",
        helper: "รายการที่ยังมีความเคลื่อนไหว",
        icon: Database,
        tone: "sky" as const,
      },
      {
        label: "รับเข้าวันนี้",
        value: formatNumber(stockInToday),
        unit: "หน่วย",
        helper: formatDate(overviewDateTo),
        icon: ClipboardPlus,
        tone: "emerald" as const,
      },
      {
        label: "เบิกจ่ายวันนี้",
        value: formatNumber(stockOutToday),
        unit: "หน่วย",
        helper: formatDate(overviewDateTo),
        icon: PackageMinus,
        tone: "orange" as const,
      },
      {
        label: "ต่ำกว่ากำหนด",
        value: formatNumber(lowStockCount),
        unit: "รายการ",
        helper: `คงเหลือไม่เกิน ${LOW_STOCK_THRESHOLD}`,
        icon: AlertTriangle,
        tone: "amber" as const,
        valueTone: "danger" as const,
      },
    ];
  }, [
    canViewStockOverview,
    inventory,
    overviewDateTo,
    ownRangeTransactions,
    ownRequisitions,
    transactions,
  ]);

  const stockFlowChart = useMemo(() => {
    const days: string[] = [];
    for (let date = overviewDateFrom; date <= overviewDateTo; date = addDays(date, 1)) {
      days.push(date);
    }

    const rows = days.map((date) => {
      const stockIn = rangeTransactions
        .filter((item) => item.date === date && item.type === "in")
        .reduce((sum, item) => sum + item.quantity, 0);
      const stockOut = chartTransactions
        .filter((item) => item.date === date && item.type === "out")
        .reduce((sum, item) => sum + item.quantity, 0);

      return {
        date,
        label: new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "short" }).format(
          new Date(`${date}T00:00:00`)
        ),
        stockIn,
        stockOut,
      };
    });
    const maxValue = Math.max(1, ...rows.flatMap((row) => [row.stockIn, row.stockOut]));

    return { rows, maxValue };
  }, [chartTransactions, overviewDateFrom, overviewDateTo, rangeTransactions]);

  const totalStockIn = stockFlowChart.rows.reduce((sum, item) => sum + item.stockIn, 0);
  const totalStockOut = stockFlowChart.rows.reduce((sum, item) => sum + item.stockOut, 0);

  const inventoryStatus = useMemo(() => {
    const total = inventory.length;
    const low = inventory.filter((item) => item.balance <= LOW_STOCK_THRESHOLD).length;
    const warning = inventory.filter(
      (item) => item.balance > LOW_STOCK_THRESHOLD && item.balance <= LOW_STOCK_THRESHOLD * 3
    ).length;
    const normal = Math.max(0, total - warning - low);
    const normalPercent = total > 0 ? (normal / total) * 100 : 0;
    const warningPercent = total > 0 ? (warning / total) * 100 : 0;

    return {
      total,
      normal,
      low,
      donutStyle: {
        background:
          total > 0
            ? `conic-gradient(#059669 0 ${normalPercent}%, #f59e0b ${normalPercent}% ${
                normalPercent + warningPercent
              }%, #dc2626 ${normalPercent + warningPercent}% 100%)`
            : "#e2e8f0",
      },
    };
  }, [inventory]);

  const visibleRequisitions = useMemo(() => {
    if (!canViewStockOverview) return ownRequisitions.slice(0, 5);

    return groupRequisitions(transactionsUntilOverviewDate)
      .filter((item) => item.status === "pending")
      .slice(0, 5);
  }, [canViewStockOverview, ownRequisitions, transactionsUntilOverviewDate]);

  if (isCheckingSession || !canViewStockOverview) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--text-muted)]">
        กำลังตรวจสอบสิทธิ์...
      </div>
    );
  }

  return (
    <section id="import" className="overview-page">
      <div className="overview-header">
        <div>
          <h2>{canViewStockOverview ? "ภาพรวมสต็อก" : "ภาพรวมการเบิกของฉัน"}</h2>
        </div>
        <div className="overview-date-range">
          <label className="overview-date-input">
            <span>จากวันที่</span>
            <input
              type="date"
              value={overviewDateFrom}
              min={earliestAllowedOverviewDateFrom}
              max={overviewDateTo}
              onChange={(event) => handleOverviewDateFromChange(event.target.value)}
            />
          </label>
          <span className="overview-date-separator">-</span>
          <label className="overview-date-input">
            <span>ถึงวันที่</span>
            <input
              type="date"
              value={overviewDateTo}
              min={overviewDateFrom}
              max={getLocalDateValue()}
              onChange={(event) => handleOverviewDateToChange(event.target.value)}
            />
          </label>
        </div>
      </div>

      <section className="overview-kpi-grid">
        {overviewStats.map((stat) => {
          const Icon = stat.icon as any;
          return (
            <article key={stat.label} className="overview-kpi-card">
              {Icon && (
                <div className={`overview-kpi-icon overview-kpi-icon-${stat.tone}`}>
                  <Icon size={22} />
                </div>
              )}
              <div>
                <p>{stat.label}</p>
                <strong className={stat.valueTone === "danger" ? "text-red-600" : ""}>
                  {stat.value}
                </strong>
                {stat.unit ? <span>{stat.unit}</span> : null}
              </div>
              <small>{stat.helper}</small>
            </article>
          );
        })}
      </section>

      <section className="overview-chart-card">
        <div className="overview-chart-header">
          <div>
            <h3>{canViewStockOverview ? "แนวโน้มรับเข้าและเบิกจ่าย" : "แนวโน้มรับเข้าและการเบิกของฉัน"}</h3>
            <p>
              {formatDate(overviewDateFrom)} - {formatDate(overviewDateTo)}
            </p>
          </div>
          <div className="overview-chart-summary">
            <span>
              <strong>{formatNumber(totalStockIn)}</strong> รับเข้า
            </span>
            <span>
              <strong>{formatNumber(totalStockOut)}</strong>{" "}
              {canViewStockOverview ? "เบิกจ่าย" : "เบิกของฉัน"}
            </span>
          </div>
        </div>

        <div className="overview-chart-legend">
          <span>
            <i className="overview-legend-in" /> รับเข้า
          </span>
          <span>
            <i className="overview-legend-out" /> {canViewStockOverview ? "เบิกจ่าย" : "เบิกของฉัน"}
          </span>
        </div>

        <div
          className="overview-bar-chart"
          style={{
            gridTemplateColumns: `repeat(${Math.max(stockFlowChart.rows.length, 1)}, minmax(18px, 1fr))`,
          }}
          aria-label={canViewStockOverview ? "Stock In vs Stock Out chart" : "My requisition chart"}
        >
          {stockFlowChart.rows.map((row) => (
            <div className="overview-bar-group" key={row.date}>
              <div className="overview-bar-tooltip" role="tooltip">
                <strong>{row.label}</strong>
                <span>รับเข้า {formatNumber(row.stockIn)}</span>
                <span>{canViewStockOverview ? "เบิกจ่าย" : "เบิกของฉัน"} {formatNumber(row.stockOut)}</span>
              </div>
              <div className="overview-bars">
                <div
                  className="overview-bar overview-bar-in"
                  style={{
                    height:
                      row.stockIn > 0
                        ? `${Math.max(4, (row.stockIn / stockFlowChart.maxValue) * 100)}%`
                        : "0%",
                  }}
                  aria-label={`${row.label} รับเข้า ${formatNumber(row.stockIn)}`}
                  tabIndex={0}
                />
                <div
                  className="overview-bar overview-bar-out"
                  style={{
                    height:
                      row.stockOut > 0
                        ? `${Math.max(4, (row.stockOut / stockFlowChart.maxValue) * 100)}%`
                        : "0%",
                  }}
                  aria-label={`${row.label} เบิกจ่าย ${formatNumber(row.stockOut)}`}
                  tabIndex={0}
                />
              </div>
              <span>{row.label}</span>
            </div>
          ))}
        </div>

        <div className="overview-chart-empty">
          {totalStockIn + totalStockOut === 0 ? (
            <>
              <BarChart3 size={18} />
              <span>
                {canViewStockOverview
                  ? "ยังไม่มีการรับเข้า/เบิกจ่ายในช่วงวันที่เลือก"
                  : "ยังไม่มีการรับเข้าหรือใบเบิกของคุณในช่วงวันที่เลือก"}
              </span>
            </>
          ) : null}
        </div>
      </section>

      <section className="overview-bottom-grid">
        {canViewStockOverview ? (
          <article className="overview-list-card">
            <div className="overview-section-heading">
              <div>
                <h3>สุขภาพสต็อก</h3>
                <p>แยกสินค้าปกติและสินค้าที่ต้องติดตาม</p>
              </div>
            </div>

            <div className="overview-status-widget">
              <div className="overview-donut" style={inventoryStatus.donutStyle}>
                <div>
                  <strong>{formatNumber(inventoryStatus.total)}</strong>
                  <span>ทั้งหมด</span>
                </div>
              </div>
              <div className="overview-status-list">
                <div>
                  <span><i className="status-dot-normal" /> สินค้าปกติ</span>
                  <strong>{formatNumber(inventoryStatus.normal)}</strong>
                </div>
                <div>
                  <span><i className="status-dot-low" /> ต่ำกว่ากำหนด</span>
                  <strong>{formatNumber(inventoryStatus.low)}</strong>
                </div>
              </div>
            </div>

            <div className="overview-low-stock-list">
              <div className="overview-low-stock-heading">
                <strong>รายการที่ควรเติมสต็อก</strong>
                <span>{lowStockInventory.length} รายการ</span>
              </div>
              {lowStockInventory.length > 0 ? (
                lowStockInventory.map((item) => (
                  <div className="overview-low-stock-item" key={item.key}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.sku || "-"}</span>
                    </div>
                    <div>
                      <strong className="text-red-600">{formatNumber(item.balance)}</strong>
                      <span>{item.unit}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="overview-low-stock-empty">ไม่มีสินค้าที่ใกล้หมดในขณะนี้</div>
              )}
            </div>
          </article>
        ) : (
          <article className="overview-list-card">
            <div className="overview-section-heading">
              <div>
                <h3>สิทธิ์การมองเห็น</h3>
                <p>บัญชีพนักงานเห็นเฉพาะงานของตัวเอง</p>
              </div>
            </div>
            <div className="overview-soft-empty">
              ข้อมูลคงคลังรวม รายการใกล้หมด และใบเบิกของผู้อื่นจะแสดงเฉพาะผู้จัดการและผู้ดูแลระบบ
            </div>
          </article>
        )}

        <article className="overview-list-card">
          <div className="overview-section-heading">
            <div>
              <h3>{canViewStockOverview ? "รอผู้จัดการอนุมัติ" : "ใบเบิกล่าสุดของฉัน"}</h3>
              <p>{canViewStockOverview ? "ใบเบิกใหม่ที่ยังไม่ได้รับการอนุมัติ" : "รายการของคุณตามช่วงวันที่เลือก"}</p>
            </div>
            <Link href="/approve">ดูทั้งหมด</Link>
          </div>

          <div className="overview-pending-list">
            {visibleRequisitions.length > 0 ? (
              visibleRequisitions.map((requisition) => (
                <div className="overview-pending-item" key={requisition.issueKey}>
                  <div>
                    <strong>{requisition.issueKey}</strong>
                    <span>
                      {formatDate(requisition.date)}
                      {canViewStockOverview ? ` · ผู้ขอ ${requisition.requester}` : ` · ${requisition.status || "completed"}`}
                    </span>
                  </div>
                  <div>
                    <strong>{formatNumber(requisition.itemCount)}</strong>
                    <span>{formatNumber(requisition.totalQuantity)} หน่วย</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="overview-soft-empty">
                {canViewStockOverview ? "ไม่มีใบเบิกรอผู้จัดการอนุมัติ" : "ยังไม่มีใบเบิกของคุณในช่วงวันที่เลือก"}
              </div>
            )}
          </div>
        </article>
      </section>
    </section>
  );
}
