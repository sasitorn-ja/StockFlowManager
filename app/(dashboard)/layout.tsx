"use client";

import type { ReactNode } from "react";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { withBasePath } from "@/lib/base-path";
import { TransactionProvider, useTransactions } from "./TransactionContext";
import {
  Menu,
  X,
  Bell,
  CalendarDays,
  PackageCheck,
  Home,
  ClipboardPlus,
  PackageMinus,
  Database,
  Clock3,
  UserCheck,
  Settings,
  LogOut,
  ChevronDown,
  UserRound,
} from "lucide-react";

type DashboardLayoutProps = {
  children: ReactNode;
};

type UserRole = "employee" | "manager" | "admin";
type NavigationItem = {
  label: string;
  href: string;
  icon: typeof Database;
  roles?: UserRole[];
};

function isSasitornTester(user: { name?: string; email?: string } | null) {
  const name = user?.name?.trim().toLowerCase() || "";
  const email = user?.email?.trim().toLowerCase() || "";
  return name === "ศศิธร จรุงจรรยาพงศ์" || email === "sasitoja@scg.com";
}

const navigationGroups = [
  {
    id: "requisition",
    label: "จัดการใบเบิกสินค้า",
    icon: PackageMinus,
    items: [
      { label: "เลือกสินค้าเพื่อเบิก", href: "/issue", icon: PackageMinus },
      { label: "ใบเบิกของฉัน", href: "/approve", icon: PackageCheck, roles: ["employee"] },
      { label: "อนุมัติใบเบิก", href: "/approve", icon: PackageCheck, roles: ["manager"] },
      { label: "จัดการใบเบิก", href: "/approve", icon: PackageCheck, roles: ["admin"] },
    ] satisfies NavigationItem[],
  },
  {
    id: "stock",
    label: "บริหารคลังสินค้า",
    icon: Database,
    items: [
      { label: "สินค้าในคลัง", href: "/items", icon: Database, roles: ["admin"] },
      { label: "รับสินค้าเข้าคลัง", href: "/receive", icon: ClipboardPlus, roles: ["admin"] },
      { label: "สินค้าใกล้หมด/หมดอายุ", href: "/expiring", icon: Clock3, roles: ["admin"] },
    ] satisfies NavigationItem[],
  },
  {
    id: "system",
    label: "งานผู้ดูแลระบบ",
    icon: Settings,
    items: [
      { label: "ผู้ใช้และบทบาท", href: "/admin-rights", icon: UserCheck, roles: ["admin"] },
      { label: "ตั้งค่าระบบ", href: "/settings", icon: Settings, roles: ["admin"] },
    ] satisfies NavigationItem[],
  },
];

const buddyUiStyles = `
  .dashboard-sidebar,
  .dashboard-sidebar-mobile { width: 274px; }
  .dashboard-sidebar {
    background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(247,251,255,.96));
    border-right: 1px solid rgba(216,229,246,.92);
    box-shadow: 12px 0 34px rgba(15,76,140,.08);
    overflow-x: hidden;
  }
  .dashboard-main { padding-left: 274px; }
  .dashboard-sidebar-brand { height: 92px; padding-inline: 18px; }
  .brand-mark {
    display: inline-flex; width: 58px; height: 58px; align-items: center; justify-content: center;
    border-radius: 18px; background: rgba(238,247,255,.92); overflow: hidden;
  }
  .brand-mark img {
    width: 52px; height: 52px; object-fit: contain; filter: drop-shadow(0 8px 12px rgba(7,71,161,.14));
    transform-origin: 50% 82%;
    animation: buddy-brand-nod 7s ease-in-out infinite;
  }
  .brand-title { font-size: 22px; line-height: 1.08; letter-spacing: 0; }
  .brand-subtitle { margin-top: 3px; color: #173b72; font-size: 11px; font-weight: 700; letter-spacing: 0; text-transform: none; }
  .dashboard-nav { padding: 16px; }
  .dashboard-nav-item { height: 46px; border-radius: 10px; color: #183660; font-size: 14px; }
  .dashboard-nav-item-active {
    background: linear-gradient(90deg,rgba(226,241,255,.96),rgba(205,232,255,.9));
    color: #0757a6; box-shadow: 0 10px 20px rgba(8,99,216,.1);
  }
  .dashboard-nav-item-active::before { background: #3b82f6; }
  .dashboard-sidebar-buddy { margin: auto 16px 14px; display: grid; justify-items: center; padding-top: 12px; }
  .dashboard-sidebar-buddy img {
    width: min(184px,76%); height: auto; filter: drop-shadow(0 16px 22px rgba(7,71,161,.14));
    transform-origin: 50% 88%;
    animation: buddy-float 4.8s ease-in-out infinite;
    will-change: transform;
  }
  .dashboard-sidebar-buddy:hover img { animation: buddy-wave 1.2s ease-in-out infinite; }
  @keyframes buddy-float {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    28% { transform: translateY(-7px) rotate(-1.2deg); }
    56% { transform: translateY(-2px) rotate(1deg); }
    78% { transform: translateY(-5px) rotate(-0.5deg); }
  }
  @keyframes buddy-wave {
    0%, 100% { transform: translateY(-4px) rotate(0deg) scale(1); }
    25% { transform: translateY(-7px) rotate(-2deg) scale(1.015); }
    50% { transform: translateY(-4px) rotate(2deg) scale(1.015); }
    75% { transform: translateY(-6px) rotate(-1deg) scale(1.01); }
  }
  @keyframes buddy-brand-nod {
    0%, 84%, 100% { transform: rotate(0deg); }
    88% { transform: rotate(-3deg); }
    92% { transform: rotate(3deg); }
    96% { transform: rotate(-1deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .brand-mark img,
    .dashboard-sidebar-buddy img,
    .dashboard-sidebar-buddy:hover img { animation: none; }
  }
  .dashboard-sidebar-logout { padding: 0 16px 16px; }
  .dashboard-logout-link {
    display: flex; min-height: 52px; align-items: center; gap: 12px; border-radius: 10px;
    background: rgba(248,251,255,.92); color: #173b72; padding: 0 16px; font-size: 14px; font-weight: 700;
  }
  .dashboard-logout-link:hover { background: #eaf4ff; color: #075bd8; }
  .dashboard-header { min-height: 82px; border-bottom: 0; background: linear-gradient(90deg,rgba(255,255,255,.86),rgba(246,251,255,.72)); box-shadow: none; }
  .dashboard-topbar-actions { display: flex; align-items: center; gap: 10px; }
  .dashboard-date-pill,
  .dashboard-notification-button,
  .dashboard-user-card {
    min-height: 50px; border: 1px solid rgba(216,229,246,.92); border-radius: 12px;
    background: rgba(255,255,255,.9); box-shadow: 0 10px 24px rgba(15,76,140,.08);
  }
  .dashboard-date-pill { display: flex; align-items: center; gap: 10px; padding: 0 14px; color: #23486f; font-size: 13px; font-weight: 700; white-space: nowrap; }
  .dashboard-date-pill svg { color: #0b63bd; }
  .dashboard-date-pill b { color: #647b98; font-size: 12px; }
  .dashboard-notification-button { position: relative; display: inline-flex; width: 50px; align-items: center; justify-content: center; color: #0b2d62; }
  .dashboard-notification-button span {
    position: absolute; right: 8px; top: 7px; display: inline-flex; min-width: 17px; height: 17px;
    align-items: center; justify-content: center; border-radius: 999px; background: #0b80ff; color: #fff; font-size: 10px; font-weight: 800;
  }
  .dashboard-user-card { display: flex; align-items: center; gap: 10px; min-width: 154px; padding: 0 12px; }
  .dashboard-user-avatar {
    display: inline-flex; width: 34px; height: 34px; align-items: center; justify-content: center;
    border-radius: 10px; background: linear-gradient(180deg,#e6f5ff,#cdeaff); color: #0747a1;
  }
  .dashboard-user-card p { max-width: 112px; overflow: hidden; color: #0b2d62; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 800; }
  .dashboard-user-card span { display: block; color: #647b98; font-size: 11px; font-weight: 700; }
  .dashboard-content { padding: 16px 24px 26px; }
  @media (max-width: 1023px) {
    .dashboard-main { padding-left: 0; }
    .dashboard-sidebar-buddy { margin-top: auto; }
    .dashboard-header { align-items: flex-start; flex-direction: column; min-height: auto; }
    .dashboard-topbar-actions { width: 100%; overflow-x: auto; padding-bottom: 2px; }
  }
  @media (max-width: 640px) {
    .dashboard-content { padding: 12px; }
    .dashboard-date-pill { display: none; }
    .dashboard-user-card { min-width: auto; padding: 0 10px; }
  }
`;

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <TransactionProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </TransactionProvider>
  );
}

function DashboardLayoutInner({ children }: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("employee");
  const [actualRole, setActualRole] = useState<UserRole>("employee");
  const { transactions } = useTransactions();
  const pathname = usePathname();
  const [now, setNow] = useState<Date | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      navigationGroups.map((group) => [
        group.id,
        group.items.some((item) => item.href === pathname),
      ])
    )
  );
  const [ssoUser, setSsoUser] = useState<{ name: string; email?: string; userId?: string; role: UserRole } | null>(null);
  const todayLabel = useMemo(() => {
    if (!now) return "กำลังโหลดวันที่";
    return new Intl.DateTimeFormat("th-TH", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(now);
  }, [now]);
  const timeLabel = useMemo(() => {
    if (!now) return "--:--";
    return new Intl.DateTimeFormat("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now);
  }, [now]);
  const pendingApprovalCount = useMemo(
    () =>
      new Set(
        transactions
          .filter((transaction) => transaction.type === "out" && transaction.status === "pending" && transaction.issueKey)
          .map((transaction) => transaction.issueKey)
      ).size,
    [transactions]
  );

  useEffect(() => {
    fetch(withBasePath("/api/auth/session"), { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const user = data?.user ?? null;
        setSsoUser(user);
        const role: UserRole = user?.role === "admin" || user?.role === "manager" ? user.role : "employee";
        setActualRole(role);
        const previewRole = role === "admin" && isSasitornTester(user) ? localStorage.getItem("admin_preview_role") : null;
        const effectiveRole: UserRole = previewRole === "employee" || previewRole === "manager" || previewRole === "admin" ? previewRole : role;
        setUserRole(effectiveRole);
        localStorage.setItem("current_role", effectiveRole);
        localStorage.setItem("current_username", user?.name ?? "ผู้ใช้งาน");
        window.dispatchEvent(new Event("current-user-changed"));
      })
      .catch(() => setSsoUser(null));
  }, []);

  function changePreviewRole(role: UserRole) {
    if (actualRole !== "admin" || !isSasitornTester(ssoUser)) return;
    setUserRole(role);
    localStorage.setItem("admin_preview_role", role);
    localStorage.setItem("current_role", role);
    window.dispatchEvent(new Event("current-user-changed"));
  }

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
  }

  useEffect(() => {
    const activeGroup = navigationGroups.find((group) =>
      group.items.some((item) => item.href === pathname)
    );
    if (activeGroup) {
      setOpenGroups((current) => ({ ...current, [activeGroup.id]: true }));
    }
  }, [pathname]);

  const sidebarContent = (
    <>
      <div className="dashboard-sidebar-brand">
        <div className="brand-mark">
          <img src={withBasePath("/picture/sbm-buddy-transparent.png")} alt="SB&M Buddy mascot" />
        </div>
        <div className="min-w-0">
          <p className="brand-title">CPAC SB&amp;M</p>
          <p className="brand-subtitle">Inventory Management</p>
        </div>
        <button
          type="button"
          onClick={closeMobileMenu}
          className="icon-button ml-auto lg:hidden"
          aria-label="ปิดเมนู"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <nav className="dashboard-nav" aria-label="เมนูหลัก">
        {userRole === "manager" || userRole === "admin" ? (
          <Link
            className={`dashboard-nav-item ${pathname === "/overview" ? "dashboard-nav-item-active" : ""}`}
            href="/overview"
            onClick={closeMobileMenu}
            aria-current={pathname === "/overview" ? "page" : undefined}
          >
            <Home aria-hidden="true" className="dashboard-nav-icon" size={17} strokeWidth={2.1} />
            <span className="min-w-0 flex-1 truncate">Dashboard</span>
          </Link>
        ) : null}

        {[...navigationGroups]
          .sort((a, b) => {
            if (userRole !== "admin") return 0;
            const order: Record<string, number> = { stock: 0, requisition: 1, system: 2 };
            return order[a.id] - order[b.id];
          })
          .map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.roles || (item.roles as readonly UserRole[]).includes(userRole)
          );
          if (visibleItems.length === 0) return null;
          const isOpen = Boolean(openGroups[group.id]);
          const hasActiveItem = visibleItems.some((item) => item.href === pathname);
          const GroupIcon = group.icon;
          return (
            <div key={group.id} className="dashboard-nav-group">
              <button
                type="button"
                className={`dashboard-nav-item dashboard-nav-group-trigger ${hasActiveItem ? "dashboard-nav-group-active" : ""}`}
                onClick={() => setOpenGroups((current) => ({ ...current, [group.id]: !isOpen }))}
                aria-expanded={isOpen}
              >
                <GroupIcon aria-hidden="true" className="dashboard-nav-icon" size={17} strokeWidth={2.1} />
                <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
                <ChevronDown aria-hidden="true" size={15} className={`dashboard-nav-chevron ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen ? (
                <div className="dashboard-nav-submenu">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        className={`dashboard-nav-item dashboard-nav-subitem ${isActive ? "dashboard-nav-item-active" : ""}`}
                        href={item.href}
                        onClick={closeMobileMenu}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon aria-hidden="true" className="dashboard-nav-icon" size={16} strokeWidth={2.1} />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="dashboard-sidebar-buddy" aria-label="SB&M Buddy">
        <img src={withBasePath("/picture/sbm-buddy-transparent.png")} alt="SB&M Buddy mascot" />
      </div>

      <div className="dashboard-sidebar-logout">
        <a href={withBasePath("/api/auth/logout")} className="dashboard-logout-link">
          <LogOut aria-hidden="true" size={18} />
          <span>ออกจากระบบ</span>
        </a>
      </div>
    </>
  );

  return (
    <main className="dashboard-shell">
      <style dangerouslySetInnerHTML={{ __html: buddyUiStyles }} />
      {isMobileMenuOpen ? (
        <button
          type="button"
          className="dashboard-overlay"
          onClick={closeMobileMenu}
          aria-label="ปิดเมนู"
        />
      ) : null}

      <aside
        className={`dashboard-sidebar-mobile ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      <aside className="dashboard-sidebar">{sidebarContent}</aside>

      <div className="dashboard-main">
        <header className="dashboard-header flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="icon-button lg:hidden"
              aria-label="เปิดเมนู"
            >
              <Menu aria-hidden="true" size={19} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold text-[var(--text-strong)] md:text-xl">
                CPAC SB&amp;M Inventory Management
              </h1>
              <p className="hidden text-[12px] font-semibold text-[var(--text-muted)] md:block">
                SB&amp;M Buddy พร้อมช่วยจัดการคลังสินค้า
              </p>
            </div>
          </div>

        <div className="dashboard-topbar-actions">
          {actualRole === "admin" && isSasitornTester(ssoUser) ? (
            <label className="admin-role-preview">
              <span>ดูหน้าจอในบทบาท</span>
              <select value={userRole} onChange={(event) => changePreviewRole(event.target.value as UserRole)}>
                <option value="employee">พนักงาน</option>
                <option value="manager">ผู้จัดการ</option>
                <option value="admin">แอดมิน</option>
              </select>
            </label>
          ) : null}
          <div className="dashboard-date-pill">
            <CalendarDays aria-hidden="true" size={17} />
            <span>{todayLabel}</span>
            <b>{timeLabel} น.</b>
          </div>
          <Link
            href="/approve"
            className="dashboard-notification-button"
            aria-label={
              pendingApprovalCount > 0
                ? `มีใบเบิกรอดำเนินการ ${pendingApprovalCount} รายการ`
                : "ไปหน้าจัดการใบเบิก"
            }
            title={pendingApprovalCount > 0 ? "ไปดูใบเบิกรอดำเนินการ" : "ไปหน้าจัดการใบเบิก"}
          >
            <Bell aria-hidden="true" size={19} />
            {pendingApprovalCount > 0 ? <span>{pendingApprovalCount}</span> : null}
          </Link>
          <div className="dashboard-user-card">
            <div className="dashboard-user-avatar">
              <UserRound aria-hidden="true" size={17} />
            </div>
            <div className="hidden min-w-0 text-left sm:block">
              <p>{ssoUser?.name ?? "ผู้ใช้งาน"}</p>
              <span>{userRole === "admin" ? "ผู้ดูแลระบบ" : userRole === "manager" ? "ผู้จัดการ" : "พนักงาน"}</span>
            </div>
          </div>
        </div>
      </header>

        <div className="dashboard-content">
          {actualRole === "admin" && isSasitornTester(ssoUser) && userRole !== "admin" ? (
            <div className="admin-preview-banner">กำลังดูตัวอย่างหน้าจอในบทบาท <strong>{userRole === "manager" ? "ผู้จัดการ" : "พนักงาน"}</strong> · สิทธิ์บัญชีจริงยังเป็นแอดมิน</div>
          ) : null}
          {children}
        </div>
      </div>
      <nav className="mobile-commerce-nav" aria-label="เมนูมือถือ">
        <Link href="/issue" className={pathname === "/issue" ? "active" : ""}>
          <PackageMinus size={20} /><span>เลือกสินค้า</span>
        </Link>
        <Link href="/approve" className={pathname === "/approve" ? "active" : ""}>
          <PackageCheck size={20} /><span>{userRole === "admin" ? "จัดการใบเบิก" : userRole === "manager" ? "อนุมัติใบเบิก" : "ใบเบิกของฉัน"}</span>
        </Link>
        {userRole === "admin" ? (
          <Link href="/receive" className={pathname === "/receive" ? "active" : ""}>
            <ClipboardPlus size={20} /><span>รับสินค้า</span>
          </Link>
        ) : userRole === "manager" ? (
          <Link href="/overview" className={pathname === "/overview" ? "active" : ""}>
            <Home size={20} /><span>Dashboard</span>
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
