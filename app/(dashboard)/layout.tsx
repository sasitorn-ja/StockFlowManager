"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TransactionProvider } from "./TransactionContext";
import {
  Menu,
  X,
  PackageCheck,
  Home,
  ClipboardPlus,
  PackageMinus,
  Database,
  History,
  Clock3,
  UserCheck,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";

type DashboardLayoutProps = {
  children: ReactNode;
};

type UserRole = "employee" | "manager" | "admin";

const navigationGroups = [
  {
    id: "stock",
    label: "คลังสินค้า",
    icon: Database,
    items: [
      { label: "รายการสินค้า", href: "/items", icon: Database },
      { label: "รับเข้าสินค้า", href: "/receive", icon: ClipboardPlus },
      { label: "เบิกจ่ายสินค้า", href: "/issue", icon: PackageMinus },
      { label: "ใกล้หมดสต็อก", href: "/expiring", icon: Clock3 },
    ],
  },
  {
    id: "requisition",
    label: "ใบเบิกและประวัติ",
    icon: PackageCheck,
    items: [
      { label: "ติดตามสถานะการเบิก", href: "/approve", icon: PackageCheck },
      { label: "ประวัติรายการ", href: "/history", icon: History },
    ],
  },
  {
    id: "system",
    label: "งานผู้ดูแลระบบ",
    icon: Settings,
    items: [
      { label: "ข้อมูลหลักสินค้า", href: "/master-data", icon: Database, adminOnly: true },
      { label: "จัดการสิทธิ์แอดมิน", href: "/admin-rights", icon: UserCheck, adminOnly: true },
      { label: "ตั้งค่า", href: "/settings", icon: Settings, adminOnly: true },
    ],
  },
];

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
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      navigationGroups.map((group) => [
        group.id,
        group.items.some((item) => item.href === pathname),
      ])
    )
  );
  const [ssoUser, setSsoUser] = useState<{ name: string; email?: string; userId?: string; role: UserRole } | null>(null);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const user = data?.user ?? null;
        setSsoUser(user);
        const role: UserRole = user?.role === "admin" || user?.role === "manager" ? user.role : "employee";
        setUserRole(role);
        // Keep existing feature pages in sync while their UI reads this shared value.
        localStorage.setItem("simulated_role", role);
        localStorage.setItem("simulated_username", user?.name ?? "ผู้ใช้งาน");
        window.dispatchEvent(new Event("simulated-role-changed"));
      })
      .catch(() => setSsoUser(null));
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
          <PackageCheck aria-hidden="true" size={28} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="brand-title">CPAC SB&amp;M</p>
          <p className="brand-subtitle">PRECAST SOLUTIONS</p>
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
        <Link
          className={`dashboard-nav-item ${pathname === "/overview" ? "dashboard-nav-item-active" : ""}`}
          href="/overview"
          onClick={closeMobileMenu}
          aria-current={pathname === "/overview" ? "page" : undefined}
        >
          <Home aria-hidden="true" className="dashboard-nav-icon" size={17} strokeWidth={2.1} />
          <span className="min-w-0 flex-1 truncate">ภาพรวมสต๊อก</span>
        </Link>

        {navigationGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !("adminOnly" in item) || !item.adminOnly || userRole === "admin"
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
    </>
  );

  return (
    <main className="dashboard-shell">
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
              <h1 className="truncate text-base font-bold text-[var(--text-strong)] md:text-lg">
                CPAC SB&amp;M Inventory Management
              </h1>
            </div>
          </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-semibold text-slate-800">{ssoUser?.name ?? "ผู้ใช้งาน"}</p>
            {ssoUser?.email ? <p className="text-[11px] text-slate-500">{ssoUser.email}</p> : null}
          </div>
          <a href="/api/auth/logout" className="icon-button" aria-label="ออกจากระบบ" title="ออกจากระบบ"><LogOut aria-hidden="true" size={18} /></a>
        </div>
      </header>

        <div className="dashboard-content">{children}</div>
      </div>
    </main>
  );
}
