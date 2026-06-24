"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { TransactionProvider } from "./TransactionContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Settings,
} from "lucide-react";

type DashboardLayoutProps = {
  children: ReactNode;
};

const navigationItems = [
  { label: "ภาพรวมสต๊อก", href: "/overview", icon: Home },
  { label: "รับเข้าสินค้า", href: "/receive", icon: ClipboardPlus },
  { label: "เบิกจ่ายสินค้า", href: "/issue", icon: PackageMinus },
  { label: "รายการสินค้า", href: "/items", icon: Database },
  { label: "ประวัติรายการ", href: "/history", icon: History },
  { label: "ใกล้หมดสต๊อก / โครงการ", href: "/expiring", icon: Clock3 },
  { label: "ตั้งค่า", href: "/settings", icon: Settings },
  { label: "Approve", href: "/approve", icon: PackageCheck },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
  }

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
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={`${item.label}-${item.href}`}
              className={`dashboard-nav-item ${isActive ? "dashboard-nav-item-active" : ""}`}
              href={item.href}
              onClick={closeMobileMenu}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                aria-hidden="true"
                className="dashboard-nav-icon"
                size={17}
                strokeWidth={2.1}
              />
              <span>{item.label}</span>
            </Link>
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
        <header className="dashboard-header">
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
        </header>

        <div className="dashboard-content">
            <TransactionProvider>{children}</TransactionProvider>
          </div>
      </div>
    </main>
  );
}
