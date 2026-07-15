"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, ClipboardPlus, Clock3, Database, PackageCheck, PackageMinus } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import { getClientMasterProducts, getClientSession } from "@/lib/dashboard-client-cache";
import {
  addDays,
  buildInventoryMap,
  formatDate,
  formatNumber,
  getStockTargetStatus,
  getLocalDateValue,
  matchesMasterProduct,
} from "@/lib/stock-flow/utils";
import type { ProductMaster, Transaction } from "@/types/stock-flow";
import { getRequisitionStatusLabel } from "@/lib/stock-flow/status";
import { useTransactions } from "../TransactionContext";

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
  const [overviewDateFrom, setOverviewDateFrom] = useState(() => addDays(getLocalDateValue(), -6));
  const [overviewDateTo, setOverviewDateTo] = useState(getLocalDateValue);
  const [masterProducts, setMasterProducts] = useState<ProductMaster[]>([]);

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
      .catch(() => setMasterProducts([]));
  }, []);

  useEffect(() => {
    if (!isCheckingSession && !canViewStockOverview) {
      router.replace("/approve");
    }
  }, [canViewStockOverview, isCheckingSession, router]);

  const earliestAllowedOverviewDateFrom = useMemo(
    () => transactions.map((item) => item.date).filter(Boolean).sort()[0] || getLocalDateValue(),
    [transactions]
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
  const inventoryWithTargets = useMemo(
    () =>
      inventory.map((item) => {
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
    [inventory, masterProducts]
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
        value: formatNumber(lowStockItems.length),
        unit: "รายการ",
        helper: "คงเหลือต่ำกว่า min ของสินค้า",
        icon: AlertTriangle,
        tone: "amber" as const,
        valueTone: "danger" as const,
      },
    ];
  }, [
    canViewStockOverview,
    inventory,
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
      inventory.reduce(
        (sum, item) => sum + item.balance * (item.costPrice > 0 ? item.costPrice : item.price || 0),
        0
      ),
    [inventory]
  );

  const mostIssuedProducts = useMemo(() => {
    const productMap = new Map<
      string,
      { key: string; name: string; sku: string; unit: string; issueCount: number; totalQuantity: number; balance: number }
    >();

    chartTransactions
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
          balance: inventory.find((inventoryItem) => inventoryItem.key === `${item.productImportType ?? "resale"}::${item.name.toLowerCase()}::${item.sku.toLowerCase()}::${item.unit.toLowerCase()}`)?.balance ?? 0,
        };

        current.issueCount += 1;
        current.totalQuantity += item.quantity;
        productMap.set(key, current);
      });

    return Array.from(productMap.values())
      .sort((a, b) => b.issueCount - a.issueCount || b.totalQuantity - a.totalQuantity)
      .slice(0, 5);
  }, [chartTransactions, inventory]);

  const mostReceivedProducts = useMemo(() => {
    const productMap = new Map<
      string,
      { key: string; name: string; sku: string; unit: string; receiveCount: number; totalQuantity: number; balance: number }
    >();

    rangeTransactions
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
            inventory.find(
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
  }, [inventory, rangeTransactions]);

  const highestBalanceInventory = useMemo(
    () => inventoryWithTargets.filter((item) => item.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 5),
    [inventoryWithTargets]
  );

  const stockReviewRows = useMemo(() => {
    return inventoryWithTargets
      .map((item) => {
        const rangeIn = rangeTransactions
          .filter((transaction) => transaction.type === "in" && transaction.name === item.name && transaction.sku === item.sku && transaction.unit === item.unit)
          .reduce((sum, transaction) => sum + transaction.quantity, 0);
        const rangeOut = rangeTransactions
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
  }, [inventoryWithTargets, rangeTransactions]);

  const visibleRequisitions = useMemo(() => {
    if (!canViewStockOverview) return ownRequisitions.slice(0, 5);

    return groupRequisitions(transactionsUntilOverviewDate)
      .filter((item) => item.status === "pending")
      .slice(0, 5);
  }, [canViewStockOverview, ownRequisitions, transactionsUntilOverviewDate]);

  const managerRequisitions = useMemo(
    () => groupRequisitions(transactionsUntilOverviewDate),
    [transactionsUntilOverviewDate]
  );
  const managerPending = managerRequisitions.filter(
    (item) => item.status === "pending" && (!item.approver || item.approver === currentUserName)
  );
  const managerApproved = managerRequisitions.filter((item) => item.status === "approved");
  const managerInProgress = managerRequisitions.filter(
    (item) => item.status === "issued" || item.status === "received" || item.status === "employee_confirmed"
  );
  const managerOwn = managerRequisitions.filter(
    (item) => item.requester === currentUserName || item.createdBy === currentUserName
  );

  if (isCheckingSession || !canViewStockOverview) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--text-muted)]">
        กำลังตรวจสอบสิทธิ์...
      </div>
    );
  }

  if (userRole === "manager") {
    return (
      <section className="manager-dashboard">
        <header className="manager-dashboard-hero">
          <div><span>MANAGER WORKSPACE</span><h2>แดชบอร์ดผู้จัดการ</h2><strong>{currentUserName}</strong></div>
          <div><Link href="/approve">ตรวจสอบใบเบิก <ArrowRight size={16} /></Link><Link href="/issue">สร้างใบเบิก</Link></div>
        </header>

        <section className="manager-kpi-grid">
          {[
            { label: "รอฉันอนุมัติ", value: managerPending.length, unit: "ใบ", icon: Clock3, tone: "amber" },
            { label: "อนุมัติแล้ว รอคลังจ่าย", value: managerApproved.length, unit: "ใบ", icon: CheckCircle2, tone: "sky" },
            { label: "กำลังส่งมอบ", value: managerInProgress.length, unit: "ใบ", icon: PackageCheck, tone: "violet" },
            { label: "ใบเบิกของฉัน", value: managerOwn.length, unit: "ใบ", icon: ClipboardList, tone: "emerald" },
            { label: "ต่ำกว่า min", value: lowStockItems.length, unit: "รายการ", icon: AlertTriangle, tone: "amber" },
            { label: "สูงกว่า max", value: highStockItems.length, unit: "รายการ", icon: Database, tone: "sky" },
          ].map((item) => { const Icon = item.icon; return <article key={item.label}><div className={`manager-kpi-icon ${item.tone}`}><Icon size={21} /></div><span>{item.label}</span><strong>{formatNumber(item.value)}</strong><small>{item.unit}</small></article>; })}
        </section>

        <section className="manager-dashboard-grid">
          <article className="manager-work-card manager-work-card-priority">
            <div className="manager-work-heading"><div><span>งานที่ต้องทำ</span><h3>ใบเบิกรออนุมัติ</h3></div><Link href="/approve">ดูทั้งหมด</Link></div>
            <div className="manager-request-list">
              {managerPending.slice(0, 6).map((item) => <Link href="/approve" key={item.issueKey}><div><strong>{item.issueKey}</strong><span>{item.requester} · {formatDate(item.date)}</span></div><div><b>{formatNumber(item.itemCount)} รายการ</b><span>{formatNumber(item.totalQuantity)} หน่วย</span></div><ArrowRight size={16} /></Link>)}
              {managerPending.length === 0 ? <div className="manager-empty"><CheckCircle2 size={32} /><strong>ไม่มีใบเบิกรออนุมัติ</strong></div> : null}
            </div>
          </article>

          <article className="manager-work-card">
            <div className="manager-work-heading"><div><span>ติดตามงาน</span><h3>ใบเบิกของฉัน</h3></div><Link href="/approve">ดูทั้งหมด</Link></div>
            <div className="manager-own-list">
              {managerOwn.slice(0, 6).map((item) => <Link href="/approve" key={item.issueKey}><div><strong>{item.issueKey}</strong><span>{formatDate(item.date)} · {formatNumber(item.totalQuantity)} หน่วย</span></div><em>{getRequisitionStatusLabel(item.status)}</em></Link>)}
              {managerOwn.length === 0 ? <div className="manager-empty"><ClipboardList size={32} /><strong>ยังไม่มีใบเบิกของคุณ</strong></div> : null}
            </div>
          </article>
        </section>
      </section>
    );
  }

  return (
    <section id="import" className="overview-page">
      <section className="overview-summary-row">
        <div className="overview-kpi-grid">
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
        </div>

        <div className="overview-date-card">
          <div className="overview-date-card-label">ช่วงวันที่</div>
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
      </section>

      <section className="overview-focus-grid">
        <article className={`overview-action-card ${lowStockItems.length > 0 ? "overview-action-card-alert" : ""}`}>
          <div className="overview-action-heading">
            <div className="overview-action-icon">
              <AlertTriangle size={22} />
            </div>
            <div>
              <span>Action required</span>
              <h3>เติมสต็อกก่อนของขาด</h3>
              <p>สินค้าเหลือน้อยกว่าจำนวนขั้นต่ำที่ตั้งไว้รายสินค้า</p>
            </div>
          </div>

          <div className="overview-action-metric">
            <strong>{formatNumber(lowStockItems.length)}</strong>
            <span>รายการต้องเติม</span>
          </div>

          <div className="overview-action-list">
            {lowStockInventory.length > 0 ? (
              lowStockInventory.map((item) => (
                <div className="overview-action-item" key={item.key}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.sku || "-"} · min {formatNumber(item.minStock)} {item.unit}</span>
                  </div>
                  <b>{formatNumber(item.balance)} {item.unit}</b>
                </div>
              ))
            ) : (
              <div className="overview-action-empty">
                <CheckCircle2 size={22} />
                <span>ไม่มีสินค้าต่ำกว่า min ตอนนี้</span>
              </div>
            )}
          </div>

          <Link className="overview-action-link" href="/receive">
            รับสินค้าเข้าคลัง <ArrowRight size={15} />
          </Link>
        </article>

        <article className="overview-movement-card">
          <div className="overview-section-heading">
            <div>
              <h3>ความเคลื่อนไหวช่วงนี้</h3>
              <p>{formatDate(overviewDateFrom)} - {formatDate(overviewDateTo)}</p>
            </div>
          </div>

          <div className="overview-movement-grid">
            <div>
              <span>รับเข้า</span>
              <strong>{formatNumber(totalStockIn)}</strong>
              <small>หน่วย</small>
            </div>
            <div>
              <span>เบิกจ่าย</span>
              <strong>{formatNumber(totalStockOut)}</strong>
              <small>หน่วย</small>
            </div>
            <div>
              <span>มูลค่าสต็อก</span>
              <strong>฿{formatNumber(estimatedInventoryValue)}</strong>
              <small>ประมาณการ</small>
            </div>
          </div>

          <div className="overview-section-heading overview-section-heading-compact">
            <div>
              <h3>สินค้าเบิกบ่อย</h3>
              <p>ช่วยดูว่าควรเติมของตัวไหนก่อน</p>
            </div>
          </div>

          <div className="overview-priority-list">
            {mostIssuedProducts.length > 0 ? (
              mostIssuedProducts.map((item) => (
                <div className="overview-priority-item" key={item.key}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.sku || "-"} · คงเหลือ {formatNumber(item.balance)} {item.unit}</span>
                  </div>
                  <div>
                    <strong>{formatNumber(item.totalQuantity)} {item.unit}</strong>
                    <span>{formatNumber(item.issueCount)} ครั้ง</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="overview-soft-empty">ยังไม่มีข้อมูลการเบิกในช่วงวันที่เลือก</div>
            )}
          </div>

          <div className="overview-section-heading overview-section-heading-compact">
            <div>
              <h3>สินค้ารับเข้าเยอะ</h3>
              <p>ใช้ดูว่าช่วงนี้สินค้าไหนเข้าคลังมากเป็นพิเศษ</p>
            </div>
          </div>

          <div className="overview-priority-list">
            {mostReceivedProducts.length > 0 ? (
              mostReceivedProducts.map((item) => (
                <div className="overview-priority-item" key={`received-${item.key}`}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.sku || "-"} · คงเหลือ {formatNumber(item.balance)} {item.unit}</span>
                  </div>
                  <div>
                    <strong>{formatNumber(item.totalQuantity)} {item.unit}</strong>
                    <span>{formatNumber(item.receiveCount)} ครั้ง</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="overview-soft-empty">ยังไม่มีข้อมูลการรับเข้าในช่วงวันที่เลือก</div>
            )}
          </div>
        </article>
      </section>

      <section className="overview-bottom-grid">
        {canViewStockOverview ? (
          <article className="overview-list-card">
            <div className="overview-section-heading">
              <div>
                <h3>สต๊อกรายสินค้า</h3>
                <p>ดูคงเหลือเทียบกับ min / max รายสินค้า พร้อมปริมาณรับเข้าและเบิกจ่ายในช่วงวันที่เลือก</p>
              </div>
            </div>

            <div className="overview-stock-table-wrap">
              <table className="overview-stock-table">
                <thead>
                  <tr>
                    <th>สินค้า</th>
                    <th>รับเข้า</th>
                    <th>เบิกจ่าย</th>
                    <th>คงเหลือ / min-max</th>
                    <th>ภาพรวมสต๊อก</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {stockReviewRows.map((item) => (
                    <tr key={item.key}>
                      <td>
                        <div className="overview-stock-product">
                          <strong>{item.name}</strong>
                          <span>{item.sku || "-"} · {item.unit}</span>
                        </div>
                      </td>
                      <td className="text-right">{formatNumber(item.rangeIn)}</td>
                      <td className="text-right">{formatNumber(item.rangeOut)}</td>
                      <td>
                        <div className="overview-stock-amount">
                          <strong>{formatNumber(item.balance)} {item.unit}</strong>
                          <span>min {formatNumber(item.minStock)} / max {formatNumber(item.maxStock)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="overview-stock-meter">
                          <div className="overview-stock-meter-track">
                            <div className="overview-stock-meter-fill" style={{ width: `${item.progressPercent}%` }} />
                            <span className="overview-stock-meter-min" style={{ left: `${item.minPercent}%` }} />
                            {item.maxStock > 0 ? (
                              <span className="overview-stock-meter-max" style={{ left: `${item.maxPercent}%` }} />
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`stock-pill ${
                            item.stockTargetStatus === "low"
                              ? "stock-pill-danger"
                              : item.stockTargetStatus === "high"
                                ? "stock-pill-warn"
                                : item.stockTargetStatus === "normal"
                                  ? "stock-pill-ok"
                                  : ""
                          }`}
                        >
                          {item.stockTargetStatus === "low"
                            ? "ต่ำกว่า min"
                            : item.stockTargetStatus === "high"
                              ? "สูงกว่า max"
                              : item.stockTargetStatus === "normal"
                                ? "อยู่ในช่วง"
                                : "ยังไม่ตั้งค่า"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
          {canViewStockOverview ? (
            <div className="overview-secondary-block">
              <div className="overview-section-heading">
                <div>
                  <h3>{highStockInventory.length > 0 ? "สินค้าสูงกว่า max" : "สินค้าคงเหลือสูงสุด"}</h3>
                  <p>{highStockInventory.length > 0 ? "รายการที่คงเหลือมากกว่าจำนวนสูงสุดที่ตั้งไว้" : "ใช้ดูของที่ค้างคลังหรือมีโอกาสสต็อกมากเกินไป"}</p>
                </div>
              </div>

              <div className="overview-priority-list">
                {(highStockInventory.length > 0 ? highStockInventory : highestBalanceInventory).length > 0 ? (
                  (highStockInventory.length > 0 ? highStockInventory : highestBalanceInventory).map((item) => (
                    <div className="overview-priority-item" key={item.key}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          {item.sku || "-"}
                          {highStockInventory.length > 0
                            ? ` · max ${formatNumber(item.maxStock)} ${item.unit}`
                            : ` · รับเข้า ${formatNumber(item.totalIn)} · เบิก ${formatNumber(item.totalOut)}`}
                        </span>
                      </div>
                      <div>
                        <strong>{formatNumber(item.balance)} {item.unit}</strong>
                        <span>{highStockInventory.length > 0 ? "คงเหลือเกินเป้า" : "คงเหลือ"}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="overview-soft-empty">ยังไม่มีสินค้าคงเหลือในคลัง</div>
                )}
              </div>
            </div>
          ) : null}

          <div className={canViewStockOverview ? "overview-secondary-block" : undefined}>
            <div className="overview-section-heading">
              <div>
                <h3>{canViewStockOverview ? "รอผู้จัดการอนุมัติ" : "ใบเบิกล่าสุดของฉัน"}</h3>
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
          </div>
        </article>
      </section>
    </section>
  );
}
