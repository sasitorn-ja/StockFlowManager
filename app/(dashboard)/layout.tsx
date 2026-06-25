"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";
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
  UserCheck,
} from "lucide-react";

type DashboardLayoutProps = {
  children: ReactNode;
};

const navigationItems = [
  { label: "ภาพรวมสต๊อก", href: "/overview", icon: Home },
  { label: "รายการสินค้า", href: "/items", icon: Database },
  { label: "รับเข้าสินค้า", href: "/receive", icon: ClipboardPlus },
  { label: "เบิกจ่ายสินค้า", href: "/issue", icon: PackageMinus },
  { label: "ติดตามสถานะการเบิก", href: "/approve", icon: PackageCheck },
  { label: "ประวัติรายการ", href: "/history", icon: History },
  { label: "ใกล้หมดสต๊อก / โครงการ", href: "/expiring", icon: Clock3 },
  { label: "ตั้งค่า", href: "/settings", icon: Settings },
  { label: "จัดการสิทธิ์แอดมิน", href: "/admin-rights", icon: UserCheck },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userRole, setUserRole] = useState("employee");
  const [simulatedUsername, setSimulatedUsername] = useState("พนักงาน");
  const [allUsers, setAllUsers] = useState<{ username: string; isAdmin: boolean }[]>([]);
  const pathname = usePathname();

  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin-users");
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch (e) {
      console.error("Failed to fetch simulated users", e);
    }
  }

  useEffect(() => {
    const cachedRole = localStorage.getItem("simulated_role") || "employee";
    const cachedUsername = localStorage.getItem("simulated_username") || "พนักงาน";
    setUserRole(cachedRole);
    setSimulatedUsername(cachedUsername);
    
    fetchUsers();

    const handleRoleChangedExternal = () => {
      setUserRole(localStorage.getItem("simulated_role") || "employee");
      setSimulatedUsername(localStorage.getItem("simulated_username") || "พนักงาน");
    };

    window.addEventListener("simulated-role-changed", handleRoleChangedExternal);
    window.addEventListener("admin-users-changed", fetchUsers);

    return () => {
      window.removeEventListener("simulated-role-changed", handleRoleChangedExternal);
      window.removeEventListener("admin-users-changed", fetchUsers);
    };
  }, []);

  async function handleUsernameChange(newUsername: string) {
    setSimulatedUsername(newUsername);
    localStorage.setItem("simulated_username", newUsername);

    let foundUser = allUsers.find((u) => u.username === newUsername);
    
    if (!foundUser) {
      try {
        const res = await fetch("/api/admin-users");
        if (res.ok) {
          const data = (await res.json()) as { username: string; isAdmin: boolean }[];
          setAllUsers(data);
          foundUser = data.find((u) => u.username === newUsername);
        }
      } catch (e) {
        console.error(e);
      }
    }

    const nextRole = foundUser?.isAdmin ? "admin" : "employee";
    setUserRole(nextRole);
    localStorage.setItem("simulated_role", nextRole);

    window.dispatchEvent(new Event("simulated-role-changed"));
  }

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
          // Hide admin rights menu if current role is not admin
          if (item.href === "/admin-rights" && userRole !== "admin") {
            return null;
          }

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

          <div className="flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50/50 px-3 py-1 text-xs shadow-sm">
            <span className="font-semibold text-sky-800">จำลองผู้ใช้:</span>
            <select
              value={simulatedUsername}
              onChange={(e) => handleUsernameChange(e.target.value)}
              className="bg-transparent font-medium text-sky-900 border-none outline-none cursor-pointer focus:ring-0 py-0.5"
              style={{ minWidth: "140px" }}
            >
              {(() => {
                const options = [...allUsers];
                if (simulatedUsername && !options.some((o) => o.username === simulatedUsername)) {
                  options.push({ username: simulatedUsername, isAdmin: userRole === "admin" });
                }
                return options.map((u) => (
                  <option key={`sim-user-${u.username}`} value={u.username}>
                    {u.username} ({u.isAdmin ? "แอดมิน" : "พนักงาน"})
                  </option>
                ));
              })()}
            </select>
          </div>
        </header>

        <div className="dashboard-content">{children}</div>
      </div>
    </main>
  );
}
