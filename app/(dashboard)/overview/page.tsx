"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, ClipboardPlus, Clock3, Database, PackageCheck, PackageMinus } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import {
  addDays,
  buildInventoryMap,
  formatDate,
  formatNumber,
  getLocalDateValue,
} from "@/lib/stock-flow/utils";
import type { Transaction } from "@/types/stock-flow";
import { getRequisitionStatusLabel } from "@/lib/stock-flow/status";
import { useTransactions } from "../TransactionContext";
import { defaultAppSettings, type AppSettings } from "@/lib/app-settings-shared";

type UserRole = "employee" | "manager" | "admin";

type SessionUser = {
  name: string;
  email?: string;
  role: UserRole;
};

function isSasitornTester(user: { name?: string; email?: string }) {
  return user.name?.trim().toLowerCase() === "ศศิธร จรุงจรรยาพงศ์" || user.email?.trim().toLowerCase() === "sasitoja@scg.com";
}

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
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);

  const userRole = currentUser?.role ?? "employee";
  const canViewStockOverview = canViewStockOverviewRole(userRole);
  const currentUserName = currentUser?.name?.trim() || "";
  const lowStockThreshold = Number(appSettings.lowStockThreshold || defaultAppSettings.lowStockThreshold);

  useEffect(() => {
    fetch(withBasePath("/api/auth/session"), { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const user = data?.user;
        const actualRole: UserRole = user?.role === "admin" || user?.role === "manager" ? user.role : "employee";
        const previewRole = actualRole === "admin" && isSasitornTester(user)
          ? localStorage.getItem("current_role")
          : null;
        const role: UserRole = previewRole === "employee" || previewRole === "manager" || previewRole === "admin" ? previewRole : actualRole;
        setCurrentUser(user ? { name: user.name ?? "ผู้ใช้งาน", email: user.email, role } : null);
      })
      .catch(() => setCurrentUser(null))
      .finally(() => setIsCheckingSession(false));
    fetch(withBasePath("/api/settings"), { cache: "no-store" })
      .then((response) => response.ok ? response.json() : defaultAppSettings)
      .then((settings) => setAppSettings({ ...defaultAppSettings, ...settings }))
      .catch(() => setAppSettings(defaultAppSettings));
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

  const ownRequisitions = useMemo(
    () => groupRequisitions(ownTransactionsUntilOverviewDate),
    [ownTransactionsUntilOverviewDate]
  );

  const lowStockInventory = useMemo(
    () =>
      inventory
        .filter((item) => item.balance <= lowStockThreshold)
        .sort((a, b) => a.balance - b.balance)
        .slice(0, 5),
    [inventory, lowStockThreshold]
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
    const lowStockCount = inventory.filter((item) => item.balance <= lowStockThreshold).length;

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
        helper: `คงเหลือไม่เกิน ${formatNumber(lowStockThreshold)}`,
        icon: AlertTriangle,
        tone: "amber" as const,
        valueTone: "danger" as const,
      },
    ];
  }, [
    canViewStockOverview,
    inventory,
    lowStockThreshold,
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

  const highestBalanceInventory = useMemo(
    () => inventory.filter((item) => item.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 5),
    [inventory]
  );

  const inventoryStatus = useMemo(() => {
    const total = inventory.length;
    const low = inventory.filter((item) => item.balance <= lowStockThreshold).length;
    const warning = inventory.filter(
      (item) => item.balance > lowStockThreshold && item.balance <= lowStockThreshold * 3
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
  }, [inventory, lowStockThreshold]);

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
            { label: "รอฉันอนุมัติ", value: managerPending.length, icon: Clock3, tone: "amber" },
            { label: "อนุมัติแล้ว รอคลังจ่าย", value: managerApproved.length, icon: CheckCircle2, tone: "sky" },
            { label: "กำลังส่งมอบ", value: managerInProgress.length, icon: PackageCheck, tone: "violet" },
            { label: "ใบเบิกของฉัน", value: managerOwn.length, icon: ClipboardList, tone: "emerald" },
          ].map((item) => { const Icon = item.icon; return <article key={item.label}><div className={`manager-kpi-icon ${item.tone}`}><Icon size={21} /></div><span>{item.label}</span><strong>{formatNumber(item.value)}</strong><small>ใบ</small></article>; })}
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
      <div className="overview-header">
        <div>
          <h2>{canViewStockOverview ? "ภาพรวมสต็อก" : "ภาพรวมการเบิกของฉัน"}</h2>
        </div>
      </div>

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

      <section className="overview-insight-grid">
        <article className="overview-list-card overview-brief-card">
          <div className="overview-section-heading">
            <div>
              <h3>สรุปสำหรับผู้บริหาร</h3>
              <p>{formatDate(overviewDateFrom)} - {formatDate(overviewDateTo)}</p>
            </div>
          </div>

          <div className="overview-brief-list">
            <div>
              <span>รับเข้าในช่วงที่เลือก</span>
              <strong>{formatNumber(totalStockIn)} หน่วย</strong>
            </div>
            <div>
              <span>{canViewStockOverview ? "เบิกจ่ายในช่วงที่เลือก" : "เบิกของฉันในช่วงที่เลือก"}</span>
              <strong>{formatNumber(totalStockOut)} หน่วย</strong>
            </div>
            <div>
              <span>มูลค่าสต็อกคงเหลือโดยประมาณ</span>
              <strong>฿{formatNumber(estimatedInventoryValue)}</strong>
            </div>
            <div>
              <span>สินค้าที่เคลื่อนไหวในช่วงนี้</span>
              <strong>{formatNumber(new Set(rangeTransactions.map((item) => `${item.name}::${item.sku}::${item.unit}`)).size)} รายการ</strong>
            </div>
          </div>

          <div className="overview-brief-note">
            ระบบมีค่า `min` สำหรับแจ้งเตือนของใกล้หมดแล้ว แต่ยังไม่มีค่า `max` รายสินค้า จึงแสดง “คงเหลือสูงสุด” เพื่อช่วยดูของที่อาจค้างสต็อกแทน
          </div>
        </article>

        <article className="overview-list-card">
          <div className="overview-section-heading">
            <div>
              <h3>สินค้าเบิกบ่อย</h3>
              <p>ดูทั้งจำนวนครั้งและปริมาณที่ถูกเบิก</p>
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
        </article>
      </section>

      <section className="overview-bottom-grid">
        {canViewStockOverview ? (
          <article className="overview-list-card">
            <div className="overview-section-heading">
              <div>
                <h3>สินค้าต่ำกว่า min</h3>
                <p>สินค้าเหลือน้อยกว่าหรือเท่ากับ {formatNumber(lowStockThreshold)} หน่วย</p>
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
          {canViewStockOverview ? (
            <div className="overview-secondary-block">
              <div className="overview-section-heading">
                <div>
                  <h3>สินค้าคงเหลือสูงสุด</h3>
                  <p>ใช้ดูของที่ค้างคลังหรือมีโอกาสสต็อกมากเกินไป</p>
                </div>
              </div>

              <div className="overview-priority-list">
                {highestBalanceInventory.length > 0 ? (
                  highestBalanceInventory.map((item) => (
                    <div className="overview-priority-item" key={item.key}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.sku || "-"} · รับเข้า {formatNumber(item.totalIn)} · เบิก {formatNumber(item.totalOut)}</span>
                      </div>
                      <div>
                        <strong>{formatNumber(item.balance)} {item.unit}</strong>
                        <span>คงเหลือ</span>
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
