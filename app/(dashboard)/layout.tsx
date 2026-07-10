"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { withBasePath } from "@/lib/base-path";
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
    label: "งานเบิกสินค้า",
    icon: PackageMinus,
    items: [
      { label: "เลือกสินค้าเพื่อเบิก", href: "/issue", icon: PackageMinus },
      { label: "ใบเบิกของฉัน", href: "/approve", icon: PackageCheck, roles: ["employee"] },
      { label: "อนุมัติและติดตาม", href: "/approve", icon: PackageCheck, roles: ["manager"] },
      { label: "ติดตามใบเบิก", href: "/approve", icon: PackageCheck, roles: ["admin"] },
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
      { label: "ประวัติคลังสินค้า", href: "/history", icon: History, roles: ["admin"] },
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
        {userRole === "manager" || userRole === "admin" ? (
          <Link
            className={`dashboard-nav-item ${pathname === "/overview" ? "dashboard-nav-item-active" : ""}`}
            href="/overview"
            onClick={closeMobileMenu}
            aria-current={pathname === "/overview" ? "page" : undefined}
          >
            <Home aria-hidden="true" className="dashboard-nav-icon" size={17} strokeWidth={2.1} />
            <span className="min-w-0 flex-1 truncate">แดชบอร์ด</span>
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
          <div className="hidden text-right sm:block">
            <p className="text-xs font-semibold text-slate-800">{ssoUser?.name ?? "ผู้ใช้งาน"}</p>
            {ssoUser?.email ? <p className="text-[11px] text-slate-500">{ssoUser.email}</p> : null}
          </div>
          <a href={withBasePath("/api/auth/logout")} className="icon-button" aria-label="ออกจากระบบ" title="ออกจากระบบ"><LogOut aria-hidden="true" size={18} /></a>
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
          <PackageCheck size={20} /><span>ใบเบิกของฉัน</span>
        </Link>
        {userRole === "admin" ? (
          <Link href="/receive" className={pathname === "/receive" ? "active" : ""}>
            <ClipboardPlus size={20} /><span>รับสินค้า</span>
          </Link>
        ) : userRole === "manager" ? (
          <Link href="/overview" className={pathname === "/overview" ? "active" : ""}>
            <Home size={20} /><span>แดชบอร์ด</span>
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
