"use client";

import { useMemo, useState } from "react";
import { Database, PackageCheck, Clock3, ClipboardPlus, PackageMinus, Search, Filter, ChevronDown } from "lucide-react";
import { LOW_STOCK_THRESHOLD } from "@/lib/stock-flow/constants";
import {
  buildInventoryMap,
  buildItemKey,
  getLocalDateValue,
  addDays,
  formatNumber,
  formatDate,
  getProductImportTypeLabel,
} from "@/lib/stock-flow/utils";
import type { Transaction, ProductImportType, InventoryItem } from "@/types/stock-flow";
import type { StatCard } from "@/components/stock-flow/StatsGrid";
import { useTransactions } from "../TransactionContext";

type OverviewFilter = "all" | ProductImportType;

const overviewFilterOptions: { value: OverviewFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "resale", label: "สินค้าซื้อมาขายไป" },
  { value: "stable", label: "สินค้า stable" },
];

export default function OverviewPage() {
  const { transactions } = useTransactions();
  const [searchTerm, setSearchTerm] = useState("");
  const [overviewFilter, setOverviewFilter] = useState<OverviewFilter>("all");
  const [overviewDateFrom, setOverviewDateFrom] = useState(() => addDays(getLocalDateValue(), -6));
  const [overviewDateTo, setOverviewDateTo] = useState(getLocalDateValue);

  const inventory = useMemo(() => [...buildInventoryMap(transactions).values()], [transactions]);

  const latestTransactionByItemKey = useMemo(() => {
    return transactions.reduce((map, transaction) => {
      const itemKey = buildItemKey(transaction);
      const current = map.get(itemKey);

      if (!current || transaction.createdAt > current.createdAt) {
        map.set(itemKey, transaction);
      }

      return map;
    }, new Map<string, Transaction>());
  }, [transactions]);

  const filteredTransactionsByDate = useMemo(() => {
    return transactions.filter((item) => item.date >= overviewDateFrom && item.date <= overviewDateTo);
  }, [overviewDateFrom, overviewDateTo, transactions]);

  const filteredOverviewInventory = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const baseInventory =
      overviewFilter === "resale" || overviewFilter === "stable"
        ? inventory.filter((item) => item.productImportType === overviewFilter)
        : inventory;

    return baseInventory.filter((item) => {
      const haystack = `${item.name} ${item.sku} ${item.category}`.toLowerCase();
      const latestTransaction = latestTransactionByItemKey.get(item.key);
      const matchesSearch = haystack.includes(normalizedSearchTerm);
      const matchesDate = latestTransaction
        ? latestTransaction.date >= overviewDateFrom && latestTransaction.date <= overviewDateTo
        : true;

      return matchesSearch && matchesDate;
    });
  }, [inventory, latestTransactionByItemKey, overviewDateFrom, overviewDateTo, overviewFilter, searchTerm]);

  const overviewStats = useMemo(() => {
    const totalBalance = filteredOverviewInventory.reduce((sum, item) => sum + item.balance, 0);
    const lowStockCount = filteredOverviewInventory.filter(
      (item) => item.balance <= LOW_STOCK_THRESHOLD
    ).length;
    const receivedInRange = filteredTransactionsByDate
      .filter((item) => item.type === "in")
      .reduce((sum, item) => sum + item.quantity, 0);
    const issuedInRange = filteredTransactionsByDate
      .filter((item) => item.type === "out")
      .reduce((sum, item) => sum + item.quantity, 0);

    return [
      {
        label: "จำนวนสินค้า",
        value: formatNumber(filteredOverviewInventory.length),
        unit: "รายการ",
        helper: "ตามช่วงวันที่ที่เลือก",
        icon: Database,
        tone: "sky" as const,
      },
      {
        label: "คงเหลือรวม",
        value: formatNumber(totalBalance),
        unit: "หน่วย",
        helper: "รวมสินค้าคงเหลือทั้งหมด",
        icon: PackageCheck,
        tone: "emerald" as const,
      },
      {
        label: "รายการใกล้หมด",
        value: formatNumber(lowStockCount),
        unit: "รายการ",
        helper: "ต่ำกว่าจุดสั่งซื้อ",
        icon: Clock3,
        tone: "amber" as const,
      },
      {
        label: "รับเข้าในช่วงนี้",
        value: formatNumber(receivedInRange),
        unit: "หน่วย",
        helper: `${filteredTransactionsByDate.filter((item) => item.type === "in").length} รายการ`,
        icon: ClipboardPlus,
        tone: "sky" as const,
      },
      {
        label: "เบิกจ่ายในช่วงนี้",
        value: formatNumber(issuedInRange),
        unit: "หน่วย",
        helper: `${filteredTransactionsByDate.filter((item) => item.type === "out").length} รายการ`,
        icon: PackageMinus,
        tone: "violet" as const,
      },
    ];
  }, [filteredOverviewInventory, filteredTransactionsByDate]);

  const currentOverviewFilterLabel =
    overviewFilterOptions.find((item) => item.value === overviewFilter)?.label ?? "ทั้งหมด";

  return (
    <section id="import" className="overview-page">
      <div className="overview-header">
        <div>
          <h2>ภาพรวมสต๊อกสินค้า</h2>
          <p>ภาพรวมสินค้าแยกตามหมวดหมู่และสถานะสต๊อก</p>
        </div>
        <div className="overview-actions">
          <label className="overview-date-input">
            <input
              type="date"
              value={overviewDateFrom}
              max={overviewDateTo}
              onChange={(event) => setOverviewDateFrom(event.target.value)}
            />
          </label>
          <span className="overview-date-separator">-</span>
          <label className="overview-date-input">
            <input
              type="date"
              value={overviewDateTo}
              min={overviewDateFrom}
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

      <div className="overview-grid">
        <section className="overview-table-card">
          <div className="overview-table-toolbar">
            <label className="overview-search">
              <Search size={17} />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ค้นหารหัสสินค้า หรือ รายการสินค้า..."
              />
            </label>
            <div className="overview-table-actions">
              <details className="overview-filter-menu">
                <summary>
                  <Filter size={15} />
                  <span>ตัวกรอง: {currentOverviewFilterLabel}</span>
                  <ChevronDown size={14} />
                </summary>
                <div className="overview-filter-dropdown">
                  {overviewFilterOptions.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={overviewFilter === item.value ? "active" : ""}
                      onClick={(event) => {
                        setOverviewFilter(item.value);
                        event.currentTarget.closest("details")?.removeAttribute("open");
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </details>
            </div>
          </div>

          <div className="overview-table-wrap">
            <table className="overview-table">
              <thead>
                <tr>
                  <th>รหัสสินค้า</th>
                  <th>รายการสินค้า</th>
                  <th>หมวดหลัก</th>
                  <th>ประเภทย่อย</th>
                  <th>คงเหลือ</th>
                  <th>หน่วย</th>
                  <th>จุดเตือน</th>
                  <th>สถานะ</th>
                  <th>อัปเดตล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {filteredOverviewInventory.length > 0 ? (
                  filteredOverviewInventory
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name, "th"))
                    .map((item) => {
                      const latestTransaction = latestTransactionByItemKey.get(item.key);
                      const status =
                        item.balance <= LOW_STOCK_THRESHOLD
                          ? "ต้องสั่งเพิ่ม"
                          : item.balance <= LOW_STOCK_THRESHOLD * 3
                            ? "ใกล้หมด"
                            : "ปกติ";

                      return (
                        <tr key={item.key}>
                          <td className="sku-cell">{item.sku || "-"}</td>
                          <td>
                            <strong>{item.name}</strong>
                            <span>
                              {item.nearestExpiryDate
                                ? `หมดอายุ ${formatDate(item.nearestExpiryDate)}`
                                : "ไม่มีวันหมดอายุ"}
                            </span>
                          </td>
                          <td>{getProductImportTypeLabel(item.productImportType)}</td>
                          <td>{item.category}</td>
                          <td className="text-right font-semibold">{formatNumber(item.balance)}</td>
                          <td>{item.unit}</td>
                          <td>{LOW_STOCK_THRESHOLD}</td>
                          <td>
                            <span
                              className={`stock-pill stock-pill-${
                                status === "ปกติ"
                                  ? "ok"
                                  : status === "ใกล้หมด"
                                    ? "warn"
                                    : "danger"
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                          <td>
                            {latestTransaction ? (
                              <>
                                <strong>{formatDate(latestTransaction.date)}</strong>
                                <span>
                                  {new Date(latestTransaction.createdAt).toLocaleTimeString(
                                    "th-TH",
                                    { hour: "2-digit", minute: "2-digit" }
                                  )}
                                </span>
                              </>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">ยังไม่มีข้อมูลสินค้าในภาพรวม</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="overview-pagination">
            <span>
              แสดง 1 - {Math.min(filteredOverviewInventory.length, 8)} จาก{" "}
              {formatNumber(filteredOverviewInventory.length)} รายการ
            </span>
            <div>
              <button type="button">‹</button>
              <button type="button" className="active">
                1
              </button>
              <button type="button">2</button>
              <button type="button">3</button>
              <button type="button">›</button>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
