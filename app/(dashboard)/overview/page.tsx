"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BarChart3, ClipboardPlus, Database, PackageMinus } from "lucide-react";
import { LOW_STOCK_THRESHOLD } from "@/lib/stock-flow/constants";
import {
  buildInventoryMap,
  getLocalDateValue,
  addDays,
  formatDate,
  formatNumber,
} from "@/lib/stock-flow/utils";
import type { Transaction } from "@/types/stock-flow";
import { useTransactions } from "../TransactionContext";

export default function OverviewPage() {
  const { transactions } = useTransactions();
  const [overviewDateFrom, setOverviewDateFrom] = useState(() => addDays(getLocalDateValue(), -6));
  const [overviewDateTo, setOverviewDateTo] = useState(getLocalDateValue);

  const transactionsUntilOverviewDate = useMemo(
    () => transactions.filter((item) => item.date <= overviewDateTo),
    [overviewDateTo, transactions]
  );
  const transactionsInChartRange = useMemo(
    () =>
      transactions.filter((item) => item.date >= overviewDateFrom && item.date <= overviewDateTo),
    [overviewDateFrom, overviewDateTo, transactions]
  );
  const inventory = useMemo(
    () => [...buildInventoryMap(transactionsUntilOverviewDate).values()],
    [transactionsUntilOverviewDate]
  );

  const overviewStats = useMemo(() => {
    const stockInToday = transactions
      .filter((item) => item.date === overviewDateTo && item.type === "in")
      .reduce((sum, item) => sum + item.quantity, 0);
    const stockOutToday = transactions
      .filter((item) => item.date === overviewDateTo && item.type === "out")
      .reduce((sum, item) => sum + item.quantity, 0);
    const lowStockItems = inventory.filter((item) => item.balance <= LOW_STOCK_THRESHOLD).length;

    return [
      {
        label: "จำนวนสินค้าทั้งหมด",
        value: formatNumber(inventory.length),
        unit: "รายการ",
        helper: "รายการสินค้าในคลัง",
        icon: Database,
        tone: "sky" as const,
      },
      {
        label: "รับเข้าสินค้าวันนี้",
        value: formatNumber(stockInToday),
        unit: "หน่วย",
        helper: formatDate(overviewDateTo),
        icon: ClipboardPlus,
        tone: "emerald" as const,
      },
      {
        label: "เบิกจ่ายสินค้าวันนี้",
        value: formatNumber(stockOutToday),
        unit: "หน่วย",
        helper: formatDate(overviewDateTo),
        icon: PackageMinus,
        tone: "orange" as const,
      },
      {
        label: "สินค้าใกล้หมดสต็อก",
        value: formatNumber(lowStockItems),
        unit: "รายการ",
        helper: `คงเหลือไม่เกิน ${LOW_STOCK_THRESHOLD}`,
        icon: AlertTriangle,
        tone: "amber" as const,
      },
    ];
  }, [inventory, overviewDateTo, transactions]);

  const stockFlowChart = useMemo(() => {
    const days: string[] = [];
    for (let date = overviewDateFrom; date <= overviewDateTo; date = addDays(date, 1)) {
      days.push(date);
    }

    const rows = days.map((date) => {
      const stockIn = transactionsInChartRange
        .filter((item) => item.date === date && item.type === "in")
        .reduce((sum, item) => sum + item.quantity, 0);
      const stockOut = transactionsInChartRange
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
  }, [overviewDateFrom, overviewDateTo, transactionsInChartRange]);

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
      warning,
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

  const pendingRequisitions = useMemo(() => {
    const requisitionMap = new Map<
      string,
      {
        issueKey: string;
        requester: string;
        date: string;
        createdAt: number;
        itemCount: number;
        totalQuantity: number;
      }
    >();

    transactionsUntilOverviewDate
      .filter((transaction) => transaction.type === "out" && transaction.issueKey)
      .forEach((transaction) => {
        const status = transaction.status || "completed";

        if (status !== "pending") {
          return;
        }

        const current = requisitionMap.get(transaction.issueKey) || {
          issueKey: transaction.issueKey,
          requester: transaction.requester || "-",
          date: transaction.date,
          createdAt: transaction.createdAt,
          itemCount: 0,
          totalQuantity: 0,
        };

        current.itemCount += 1;
        current.totalQuantity += transaction.quantity;
        current.createdAt = Math.max(current.createdAt, transaction.createdAt);
        requisitionMap.set(transaction.issueKey, current);
      });

    return Array.from(requisitionMap.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);
  }, [transactionsUntilOverviewDate]);

  return (
    <section id="import" className="overview-page">
      <div className="overview-header">
        <div>
          <h2>ภาพรวมสต็อก</h2>
          <p>สรุปสถานะคลังสินค้าแบบรวดเร็วสำหรับผู้บริหารและทีมคลัง</p>
        </div>
        <div className="overview-date-range">
          <label className="overview-date-input">
            <span>จากวันที่</span>
            <input
              type="date"
              value={overviewDateFrom}
              max={overviewDateTo}
              onChange={(event) => setOverviewDateFrom(event.target.value)}
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
              onChange={(event) => setOverviewDateTo(event.target.value)}
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
                <strong>{stat.value}</strong>
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
            <h3>แนวโน้มรับเข้าและเบิกจ่ายสินค้า</h3>
            <p>
              {formatDate(overviewDateFrom)} - {formatDate(overviewDateTo)}
            </p>
          </div>
          <div className="overview-chart-summary">
            <span>
              <strong>{formatNumber(totalStockIn)}</strong> รับเข้า
            </span>
            <span>
              <strong>{formatNumber(totalStockOut)}</strong> เบิกจ่าย
            </span>
          </div>
        </div>

        <div className="overview-chart-legend">
          <span>
            <i className="overview-legend-in" /> รับเข้า
          </span>
          <span>
            <i className="overview-legend-out" /> เบิกจ่าย
          </span>
        </div>

        <div
          className="overview-bar-chart"
          style={{
            gridTemplateColumns: `repeat(${Math.max(stockFlowChart.rows.length, 1)}, minmax(18px, 1fr))`,
          }}
          aria-label="Stock In vs Stock Out chart"
        >
          {stockFlowChart.rows.map((row) => (
            <div className="overview-bar-group" key={row.date}>
              <div className="overview-bars">
                <div
                  className="overview-bar overview-bar-in"
                  style={{
                    height:
                      row.stockIn > 0
                        ? `${Math.max(4, (row.stockIn / stockFlowChart.maxValue) * 100)}%`
                        : "0%",
                  }}
                  title={`รับเข้า: ${formatNumber(row.stockIn)}`}
                />
                <div
                  className="overview-bar overview-bar-out"
                  style={{
                    height:
                      row.stockOut > 0
                        ? `${Math.max(4, (row.stockOut / stockFlowChart.maxValue) * 100)}%`
                        : "0%",
                  }}
                  title={`เบิกจ่าย: ${formatNumber(row.stockOut)}`}
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
              <span>ยังไม่มีการรับเข้า/เบิกจ่ายในช่วงวันที่เลือก</span>
            </>
          ) : null}
        </div>
      </section>

      <section className="overview-bottom-grid">
        <article className="overview-list-card">
          <div className="overview-section-heading">
            <div>
              <h3>สถานะสินค้าในคลัง</h3>
              <p>สรุปสุขภาพสต็อกเพื่อประเมินความเสี่ยงทันที</p>
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
                <span><i className="status-dot-warning" /> สินค้าใกล้จุดเตือน</span>
                <strong>{formatNumber(inventoryStatus.warning)}</strong>
              </div>
              <div>
                <span><i className="status-dot-low" /> สินค้าต่ำกว่ากำหนด</span>
                <strong>{formatNumber(inventoryStatus.low)}</strong>
              </div>
            </div>
          </div>
        </article>

        <article className="overview-list-card">
          <div className="overview-section-heading">
            <div>
              <h3>รายการรออนุมัติ</h3>
              <p>ใบเบิกที่ควรตรวจสอบและดำเนินการต่อ</p>
            </div>
            <a href="/approve">ดูทั้งหมด</a>
          </div>

          <div className="overview-pending-list">
            {pendingRequisitions.length > 0 ? (
              pendingRequisitions.map((requisition) => (
                <div className="overview-pending-item" key={requisition.issueKey}>
                  <div>
                    <strong>{requisition.issueKey}</strong>
                    <span>{formatDate(requisition.date)} · ผู้ขอ {requisition.requester}</span>
                  </div>
                  <div>
                    <strong>{formatNumber(requisition.itemCount)}</strong>
                    <span>{formatNumber(requisition.totalQuantity)} หน่วย</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="overview-soft-empty">ไม่มีใบเบิกรออนุมัติ</div>
            )}
          </div>
        </article>
      </section>
    </section>
  );
}
