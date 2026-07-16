"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ClipboardList, ClipboardPlus, Clock3, Database, PackageMinus } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import { getClientAppSettings, getClientMasterProducts, getClientSession } from "@/lib/dashboard-client-cache";
import {
  addDays,
  buildInventoryMap,
  formatDate,
  formatNumber,
  getStockTargetStatus,
  getLocalDateValue,
  isExpiringSoon,
  matchesMasterProduct,
} from "@/lib/stock-flow/utils";
import type { ProductMaster, Transaction } from "@/types/stock-flow";
import { useTransactions } from "../TransactionContext";
import { defaultAppSettings, type AppSettings } from "@/lib/app-settings-shared";

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
  approver: string;
  date: string;
  createdAt: number;
  itemCount: number;
  totalQuantity: number;
  status: Transaction["status"];
};

type EChartProps = {
  option: Record<string, unknown>;
  className?: string;
};

function EChart({ option, className = "" }: EChartProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let chart: { setOption: (option: Record<string, unknown>, replace?: boolean) => void; resize: () => void; dispose: () => void } | null = null;
    let isDisposed = false;

    async function mountChart() {
      const echarts = await import("echarts");
      if (!chartRef.current || isDisposed) return;

      chart = echarts.init(chartRef.current);
      chart.setOption(option, true);
      const resizeChart = () => chart?.resize();
      window.addEventListener("resize", resizeChart);

      return () => window.removeEventListener("resize", resizeChart);
    }

    let cleanupResize: (() => void) | undefined;
    mountChart().then((cleanup) => {
      cleanupResize = cleanup;
    });

    return () => {
      isDisposed = true;
      cleanupResize?.();
      chart?.dispose();
    };
  }, [option]);

  return <div ref={chartRef} className={`overview-echart ${className}`} />;
}

function clampDate(value: string, min: string, max: string) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function canViewStockOverviewRole(role: UserRole) {
  return role === "admin" || role === "manager";
}

function getCurrentMonthStartDate() {
  return `${getLocalDateValue().slice(0, 8)}01`;
}

function formatLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function enumerateDateRange(from: string, to: string) {
  const dates: string[] = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return dates;
  }

  for (let current = start; current <= end; current.setDate(current.getDate() + 1)) {
    dates.push(formatLocalDateKey(current));
  }

  return dates;
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
        approver: transaction.approver || "",
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
  const [overviewDateFrom, setOverviewDateFrom] = useState(getCurrentMonthStartDate);
  const [overviewDateTo, setOverviewDateTo] = useState(getLocalDateValue);
  const [masterProducts, setMasterProducts] = useState<ProductMaster[]>([]);
  const [isMasterProductsLoaded, setIsMasterProductsLoaded] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);

  const userRole = currentUser?.role ?? "employee";
  const canViewStockOverview = canViewStockOverviewRole(userRole);
  const currentUserName = currentUser?.name?.trim() || "";

  useEffect(() => {
    getClientSession()
      .then((data) => {
        const user = data?.user;
        const role: UserRole = user?.role === "admin" || user?.role === "manager" ? user.role : "employee";
        setCurrentUser(user ? { name: user.name ?? "ผู้ใช้งาน", email: user.email, role } : null);
      })
      .catch(() => setCurrentUser(null))
      .finally(() => setIsCheckingSession(false));
    getClientMasterProducts()
      .then((products) => setMasterProducts(products))
      .catch(() => setMasterProducts([]))
      .finally(() => setIsMasterProductsLoaded(true));
    getClientAppSettings()
      .then((settings) => setAppSettings(settings))
      .catch(() => setAppSettings(defaultAppSettings));
  }, []);

  useEffect(() => {
    if (!isCheckingSession && !canViewStockOverview) {
      router.replace("/approve");
    }
  }, [canViewStockOverview, isCheckingSession, router]);

  const overviewDateFloor = useMemo(
    () => {
      const fallbackFloor = addDays(getLocalDateValue(), -365);
      const firstTransactionDate = transactions.map((item) => item.date).filter(Boolean).sort()[0];
      return firstTransactionDate && firstTransactionDate < fallbackFloor ? firstTransactionDate : fallbackFloor;
    },
    [transactions]
  );

  useEffect(() => {
    if (overviewDateFrom > overviewDateTo) {
      setOverviewDateFrom(overviewDateTo);
    }
  }, [overviewDateFrom, overviewDateTo]);

  const handleOverviewDateFromChange = (value: string) => {
    setOverviewDateFrom(clampDate(value, overviewDateFloor, overviewDateTo));
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
  const inactiveMasterProducts = useMemo(
    () => masterProducts.filter((product) => !product.isActive),
    [masterProducts]
  );
  const activeInventory = useMemo(
    () =>
      isMasterProductsLoaded
        ? inventory.filter(
            (item) => !inactiveMasterProducts.some((product) => matchesMasterProduct(item, product))
          )
        : [],
    [inactiveMasterProducts, inventory, isMasterProductsLoaded]
  );
  const activeRangeTransactions = useMemo(
    () =>
      isMasterProductsLoaded
        ? rangeTransactions.filter(
            (item) => !inactiveMasterProducts.some((product) => matchesMasterProduct(item, product))
          )
        : [],
    [inactiveMasterProducts, isMasterProductsLoaded, rangeTransactions]
  );
  const activeChartTransactions = useMemo(
    () =>
      isMasterProductsLoaded
        ? chartTransactions.filter(
            (item) => !inactiveMasterProducts.some((product) => matchesMasterProduct(item, product))
          )
        : [],
    [chartTransactions, inactiveMasterProducts, isMasterProductsLoaded]
  );
  const inventoryWithTargets = useMemo(
    () =>
      activeInventory.map((item) => {
        const matchedProduct = masterProducts.find((product) => matchesMasterProduct(item, product));
        const minStock = matchedProduct?.minStock ?? 0;
        const maxStock = matchedProduct?.maxStock ?? 0;

        return {
          ...item,
          minStock,
          maxStock,
          stockTargetStatus: getStockTargetStatus(item.balance, minStock, maxStock),
        };
      }),
    [activeInventory, masterProducts]
  );

  const ownRequisitions = useMemo(
    () => groupRequisitions(ownTransactionsUntilOverviewDate),
    [ownTransactionsUntilOverviewDate]
  );

  const lowStockItems = useMemo(
    () =>
      inventoryWithTargets
        .filter((item) => item.stockTargetStatus === "low")
        .sort((a, b) => a.balance - b.balance),
    [inventoryWithTargets]
  );

  const highStockItems = useMemo(
    () =>
      inventoryWithTargets
        .filter((item) => item.stockTargetStatus === "high")
        .sort((a, b) => b.balance - a.balance),
    [inventoryWithTargets]
  );

  const expiringItems = useMemo(
    () =>
      activeInventory
        .filter((item) => item.balance > 0 && isExpiringSoon(item.nearestExpiryDate, Number(appSettings.expiryWarningDays || 90)))
        .sort((a, b) => a.nearestExpiryDate.localeCompare(b.nearestExpiryDate)),
    [activeInventory, appSettings.expiryWarningDays]
  );

  const lowStockInventory = useMemo(
    () =>
      lowStockItems.slice(0, 5),
    [lowStockItems]
  );
  const highStockInventory = useMemo(() => highStockItems.slice(0, 5), [highStockItems]);

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
          unit: "จำนวนสินค้า",
          helper: "ไม่ใช่จำนวนรายการสินค้า",
          icon: PackageMinus,
          tone: "orange" as const,
        },
      ];
    }

    const stockInToday = activeRangeTransactions
      .filter((item) => item.date === overviewDateTo && item.type === "in")
      .reduce((sum, item) => sum + item.quantity, 0);
    const stockOutToday = activeRangeTransactions
      .filter((item) => item.date === overviewDateTo && item.type === "out")
      .reduce((sum, item) => sum + item.quantity, 0);
    return [
      {
        label: "สินค้าในคลัง",
        value: formatNumber(activeInventory.length),
        unit: "รายการ",
        helper: "รายการที่ยังมีความเคลื่อนไหว",
        icon: Database,
        tone: "sky" as const,
      },
      {
        label: "รับเข้าวันนี้",
        value: formatNumber(stockInToday),
        unit: "จำนวนสินค้า",
        helper: "ไม่ใช่จำนวนรายการสินค้า",
        icon: ClipboardPlus,
        tone: "emerald" as const,
      },
      {
        label: "เบิกจ่ายวันนี้",
        value: formatNumber(stockOutToday),
        unit: "จำนวนสินค้า",
        helper: "ไม่ใช่จำนวนรายการสินค้า",
        icon: PackageMinus,
        tone: "orange" as const,
      },
      {
        label: "ต่ำกว่ากำหนด",
        value: formatNumber(lowStockItems.length),
        unit: "รายการ",
        helper: "คงเหลือต่ำกว่า min ของสินค้า",
        icon: AlertTriangle,
        tone: "amber" as const,
        valueTone: "danger" as const,
      },
      {
        label: "ใกล้หมด/หมดอายุ",
        value: formatNumber(expiringItems.length),
        unit: "รายการ",
        helper: `ภายใน ${formatNumber(Number(appSettings.expiryWarningDays || 90))} วัน`,
        icon: Clock3,
        tone: "violet" as const,
        valueTone: expiringItems.length > 0 ? ("danger" as const) : undefined,
      },
    ];
  }, [
    appSettings.expiryWarningDays,
    activeInventory.length,
    activeRangeTransactions,
    canViewStockOverview,
    expiringItems.length,
    lowStockItems.length,
    overviewDateTo,
    ownRangeTransactions,
    ownRequisitions,
    transactions,
  ]);

  const totalStockIn = rangeTransactions
    .filter((item) => item.type === "in")
    .reduce((sum, item) => sum + item.quantity, 0);
  const totalStockOut = chartTransactions
    .filter((item) => item.type === "out")
    .reduce((sum, item) => sum + item.quantity, 0);

  const estimatedInventoryValue = useMemo(
    () =>
      activeInventory.reduce(
        (sum, item) => sum + item.balance * (item.costPrice > 0 ? item.costPrice : item.price || 0),
        0
      ),
    [activeInventory]
  );

  const movementChartPoints = useMemo(() => {
    return enumerateDateRange(overviewDateFrom, overviewDateTo).map((date) => {
      const dayTransactions = activeRangeTransactions.filter((item) => item.date === date);
      const stockIn = dayTransactions.filter((item) => item.type === "in").length;
      const stockOut = dayTransactions.filter(
        (item) => item.type === "out" && item.status !== "cancelled"
      ).length;

      return {
        date,
        label: new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", {
          day: "2-digit",
          month: "short",
        }),
        stockIn,
        stockOut,
      };
    });
  }, [activeRangeTransactions, overviewDateFrom, overviewDateTo]);

  const stockStatusSummary = useMemo(() => {
    return {
      low: lowStockItems.length,
      high: highStockItems.length,
      normal: inventoryWithTargets.filter((item) => item.stockTargetStatus === "normal").length,
      missing: inventoryWithTargets.filter((item) => item.stockTargetStatus === "missing").length,
    };
  }, [highStockItems.length, inventoryWithTargets, lowStockItems.length]);

  const movementChartOption = useMemo(
    () => ({
      animationDuration: 450,
      color: ["#0b63bd", "#f97316"],
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15,23,42,0.92)",
        borderWidth: 0,
        textStyle: { color: "#fff", fontFamily: "Sarabun, sans-serif" },
        formatter: (params: any) => {
          const points = Array.isArray(params) ? params : [];
          const title = points[0]?.axisValueLabel || "";
          const rows = points
            .map((point) => {
              const value = Number(point.value || 0);
              return `${point.marker || ""} ${point.seriesName}: ${formatNumber(value)} รายการ`;
            })
            .join("<br/>");

          return `${title}<br/>${rows}`;
        },
      },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: "#64748b", fontFamily: "Sarabun, sans-serif", fontWeight: 700 },
      },
      grid: { top: 38, right: 12, bottom: 28, left: 42 },
      xAxis: {
        type: "category",
        data: movementChartPoints.map((item) => item.label),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#dbe7f5" } },
        axisLabel: {
          color: "#64748b",
          fontFamily: "Sarabun, sans-serif",
          fontWeight: 700,
          hideOverlap: true,
        },
      },
      yAxis: {
        type: "value",
        name: "รายการ",
        nameTextStyle: { color: "#64748b", fontFamily: "Sarabun, sans-serif", fontWeight: 800 },
        minInterval: 1,
        splitLine: { lineStyle: { color: "#edf2f7" } },
        axisLabel: { color: "#64748b", fontFamily: "Sarabun, sans-serif", fontWeight: 700 },
      },
      series: [
        {
          name: "รับเข้า",
          type: "bar",
          barMaxWidth: 26,
          data: movementChartPoints.map((item) => item.stockIn),
          itemStyle: { borderRadius: [7, 7, 0, 0] },
        },
        {
          name: "เบิกจ่าย",
          type: "bar",
          barMaxWidth: 26,
          data: movementChartPoints.map((item) => item.stockOut),
          itemStyle: { borderRadius: [7, 7, 0, 0] },
        },
      ],
    }),
    [movementChartPoints]
  );

  const stockStatusChartOption = useMemo(
    () => ({
      animationDuration: 450,
      color: ["#16a34a", "#dc2626", "#f59e0b", "#94a3b8"],
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(15,23,42,0.92)",
        borderWidth: 0,
        textStyle: { color: "#fff", fontFamily: "Sarabun, sans-serif" },
      },
      legend: {
        bottom: 0,
        left: "center",
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: "#64748b", fontFamily: "Sarabun, sans-serif", fontWeight: 700 },
      },
      series: [
        {
          name: "สถานะสต๊อก",
          type: "pie",
          radius: ["52%", "74%"],
          center: ["50%", "44%"],
          avoidLabelOverlap: true,
          label: { formatter: "{b}\n{c}", color: "#0f172a", fontFamily: "Sarabun, sans-serif", fontWeight: 800 },
          labelLayout: { hideOverlap: true, moveOverlap: "shiftY" },
          data: [
            { value: stockStatusSummary.normal, name: "ปกติ" },
            { value: stockStatusSummary.low, name: "ต่ำกว่า min" },
            { value: stockStatusSummary.high, name: "สูงกว่า max" },
            { value: stockStatusSummary.missing, name: "ยังไม่ตั้งค่า" },
          ],
        },
      ],
    }),
    [stockStatusSummary]
  );

  const mostIssuedProducts = useMemo(() => {
    const productMap = new Map<
      string,
      { key: string; name: string; sku: string; unit: string; issueCount: number; totalQuantity: number; balance: number }
    >();

    activeChartTransactions
      .filter((item) => item.type === "out" && item.status !== "cancelled")
      .forEach((item) => {
        const key = `${item.name}::${item.sku}::${item.unit}`;
        const current = productMap.get(key) || {
          key,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          issueCount: 0,
          totalQuantity: 0,
          balance: activeInventory.find((inventoryItem) => inventoryItem.key === `${item.productImportType ?? "resale"}::${item.name.toLowerCase()}::${item.sku.toLowerCase()}::${item.unit.toLowerCase()}`)?.balance ?? 0,
        };

        current.issueCount += 1;
        current.totalQuantity += item.quantity;
        productMap.set(key, current);
      });

    return Array.from(productMap.values())
      .sort((a, b) => b.issueCount - a.issueCount || b.totalQuantity - a.totalQuantity)
      .slice(0, 5);
  }, [activeChartTransactions, activeInventory]);

  const mostReceivedProducts = useMemo(() => {
    const productMap = new Map<
      string,
      { key: string; name: string; sku: string; unit: string; receiveCount: number; totalQuantity: number; balance: number }
    >();

    activeRangeTransactions
      .filter((item) => item.type === "in")
      .forEach((item) => {
        const key = `${item.name}::${item.sku}::${item.unit}`;
        const current = productMap.get(key) || {
          key,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          receiveCount: 0,
          totalQuantity: 0,
          balance:
            activeInventory.find(
              (inventoryItem) =>
                inventoryItem.key ===
                `${item.productImportType ?? "resale"}::${item.name.toLowerCase()}::${item.sku.toLowerCase()}::${item.unit.toLowerCase()}`
            )?.balance ?? 0,
        };

        current.receiveCount += 1;
        current.totalQuantity += item.quantity;
        productMap.set(key, current);
      });

    return Array.from(productMap.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity || b.receiveCount - a.receiveCount)
      .slice(0, 5);
  }, [activeInventory, activeRangeTransactions]);

  const highestBalanceInventory = useMemo(
    () => inventoryWithTargets.filter((item) => item.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 5),
    [inventoryWithTargets]
  );

  const stockReviewRows = useMemo(() => {
    return inventoryWithTargets
      .map((item) => {
        const rangeIn = activeRangeTransactions
          .filter((transaction) => transaction.type === "in" && transaction.name === item.name && transaction.sku === item.sku && transaction.unit === item.unit)
          .reduce((sum, transaction) => sum + transaction.quantity, 0);
        const rangeOut = activeRangeTransactions
          .filter((transaction) => transaction.type === "out" && transaction.name === item.name && transaction.sku === item.sku && transaction.unit === item.unit && transaction.status !== "cancelled")
          .reduce((sum, transaction) => sum + transaction.quantity, 0);
        const safeMax = item.maxStock > 0 ? item.maxStock : Math.max(item.minStock * 2, item.balance, item.minStock, 1);
        const progressPercent = Math.max(0, Math.min(100, (item.balance / safeMax) * 100));
        const minPercent = Math.max(0, Math.min(100, (item.minStock / safeMax) * 100));
        const maxPercent = item.maxStock > 0 ? 100 : 0;

        return {
          ...item,
          rangeIn,
          rangeOut,
          progressPercent,
          minPercent,
          maxPercent,
        };
      })
      .sort((left, right) => {
        const priority = { low: 0, high: 1, normal: 2, missing: 3 } as const;
        return (
          priority[left.stockTargetStatus] - priority[right.stockTargetStatus] ||
          right.rangeOut - left.rangeOut ||
          right.rangeIn - left.rangeIn ||
          left.name.localeCompare(right.name, "th")
        );
      })
      .slice(0, 12);
  }, [activeRangeTransactions, inventoryWithTargets]);

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
      <section className="overview-simple-header">
        <div>
          <h2>Dashboard</h2>
          <p>ดูเฉพาะตัวเลขหลัก สถานะสต๊อก และงานที่ต้องจัดการ</p>
        </div>
        <div className="overview-simple-filter">
          <div className="overview-date-range">
            <label className="overview-date-input">
              <span>จากวันที่</span>
              <input
                type="date"
                value={overviewDateFrom}
                min={overviewDateFloor}
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
      </section>

      <section className="overview-simple-kpis">
        {overviewStats.map((stat) => {
          const Icon = stat.icon as any;
          return (
            <article key={stat.label}>
              <div className={`overview-kpi-icon overview-kpi-icon-${stat.tone}`}>
                <Icon size={21} />
              </div>
              <div>
                <span>{stat.label}</span>
                <strong className={stat.valueTone === "danger" ? "text-red-600" : ""}>
                  {stat.value}
                </strong>
                <small>{stat.unit}</small>
                <em>{stat.helper}</em>
              </div>
            </article>
          );
        })}
      </section>

      <section className="overview-simple-grid">
        <article className="overview-simple-card overview-chart-panel">
          <div className="overview-simple-card-heading">
            <div>
              <h3>รับเข้า / เบิกจ่าย (จำนวนรายการ)</h3>
              <p>{formatDate(overviewDateFrom)} - {formatDate(overviewDateTo)} · นับ 1 รายการต่อ 1 ครั้ง ไม่ใช่จำนวนหน่วยสินค้า</p>
            </div>
          </div>
          <EChart option={movementChartOption} className="overview-echart-movement" />
        </article>

        <article className="overview-simple-card overview-chart-panel">
          <div className="overview-simple-card-heading">
            <div>
              <h3>สถานะสต๊อก</h3>
              <p>เทียบ min / max ของสินค้า</p>
            </div>
          </div>
          <EChart option={stockStatusChartOption} className="overview-echart-status" />
        </article>
      </section>

      <section className="overview-simple-grid overview-simple-grid-lists">
        <article className="overview-simple-card">
          <div className="overview-simple-card-heading">
            <div>
              <h3>ต้องเติมสต๊อก</h3>
              <p>{lowStockItems.length > 0 ? `${formatNumber(lowStockItems.length)} รายการต่ำกว่า min` : "ไม่มีรายการต่ำกว่า min"}</p>
            </div>
            <Link href="/receive">รับเข้า</Link>
          </div>
          <div className="overview-simple-list">
            {lowStockInventory.length > 0 ? (
              lowStockInventory.map((item) => (
                <div className="overview-priority-item" key={item.key}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.sku || "-"} · min {formatNumber(item.minStock)} {item.unit}</span>
                  </div>
                  <div>
                    <strong>{formatNumber(item.balance)} {item.unit}</strong>
                    <span>คงเหลือ</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="overview-soft-empty">สต๊อกอยู่ในเกณฑ์ ไม่มีรายการต้องเติมตอนนี้</div>
            )}
          </div>
        </article>

        <article className="overview-simple-card">
          <div className="overview-simple-card-heading">
            <div>
              <h3>ใบเบิกรออนุมัติ</h3>
              <p>{visibleRequisitions.length > 0 ? `${formatNumber(visibleRequisitions.length)} ใบล่าสุด` : "ไม่มีใบเบิกรออนุมัติ"}</p>
            </div>
            <Link href="/approve">ดูทั้งหมด</Link>
          </div>
          <div className="overview-simple-list">
            {visibleRequisitions.length > 0 ? (
              visibleRequisitions.map((requisition) => (
                <div className="overview-priority-item" key={requisition.issueKey}>
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
              <div className="overview-soft-empty">ไม่มีใบเบิกรอผู้จัดการอนุมัติ</div>
            )}
          </div>
        </article>
      </section>
    </section>
  );
}
