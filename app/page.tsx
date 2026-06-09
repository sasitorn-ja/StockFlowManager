"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  ClipboardPlus,
  Clock3,
  History,
  LayoutDashboard,
  Menu,
  PackageCheck,
  X,
} from "lucide-react";

import { DataPanel } from "@/components/stock-flow/DataPanel";
import { StatusBadge } from "@/components/stock-flow/StatusBadge";
import { StockForm } from "@/components/stock-flow/StockForm";
import { StatsGrid } from "@/components/stock-flow/StatsGrid";
import { Table } from "@/components/stock-flow/Table";
import { LOW_STOCK_THRESHOLD, STORAGE_KEY } from "@/lib/stock-flow/constants";
import { createSampleTransactions } from "@/lib/stock-flow/sample-data";
import {
  buildInventoryMap,
  buildItemKey,
  compareExpiryDate,
  createEmptyForm,
  formatCurrency,
  formatDate,
  formatDaysLeft,
  formatNumber,
  getDaysUntil,
  getLocalDateValue,
  isExpiringSoon,
} from "@/lib/stock-flow/utils";
import type { FormState, Transaction } from "@/types/stock-flow";

const inputClassName = "control-input";

const navigationItems = [
  { label: "ภาพรวม", href: "#overview", icon: LayoutDashboard },
  { label: "บันทึกรายการ", href: "#form", icon: ClipboardPlus },
  { label: "ใกล้หมดอายุ", href: "#priority", icon: Clock3 },
  { label: "คงเหลือสินค้า", href: "#inventory", icon: Boxes },
  { label: "รายการล่าสุด", href: "#transactions", icon: History },
];

const sectionIds = navigationItems.map((item) => item.href.slice(1));

export default function HomePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [isReady, setIsReady] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(sectionIds[0]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setTransactions(JSON.parse(saved) as Transaction[]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }, [isReady, transactions]);

  useEffect(() => {
    function syncActiveSection() {
      const currentHash = window.location.hash.slice(1);

      if (sectionIds.includes(currentHash)) {
        setActiveSection(currentHash);
        return;
      }

      const scrollLine = 110;
      const currentSection =
        sectionIds
          .map((id) => {
            const element = document.getElementById(id);

            return element ? { id, top: element.getBoundingClientRect().top } : null;
          })
          .filter((item): item is { id: string; top: number } => Boolean(item))
          .filter((item) => item.top <= scrollLine)
          .pop()?.id ?? sectionIds[0];

      setActiveSection(currentSection);
    }

    syncActiveSection();
    window.addEventListener("hashchange", syncActiveSection);
    window.addEventListener("scroll", syncActiveSection, { passive: true });

    return () => {
      window.removeEventListener("hashchange", syncActiveSection);
      window.removeEventListener("scroll", syncActiveSection);
    };
  }, []);

  const inventory = useMemo(() => [...buildInventoryMap(transactions).values()], [transactions]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const haystack = `${item.name} ${item.sku}`.toLowerCase();
      return haystack.includes(searchTerm.trim().toLowerCase());
    });
  }, [inventory, searchTerm]);

  const priorityItems = useMemo(() => {
    return inventory
      .filter((item) => item.balance > 0 && isExpiringSoon(item.nearestExpiryDate))
      .sort((a, b) => compareExpiryDate(a.nearestExpiryDate, b.nearestExpiryDate));
  }, [inventory]);

  const stats = useMemo(() => {
    const today = getLocalDateValue();
    const receivedToday = transactions
      .filter((item) => item.type === "in" && item.date === today)
      .reduce((sum, item) => sum + item.quantity, 0);
    const issuedToday = transactions
      .filter((item) => item.type === "out" && item.date === today)
      .reduce((sum, item) => sum + item.quantity, 0);
    const totalBalance = inventory.reduce((sum, item) => sum + item.balance, 0);
    const totalValue = inventory.reduce((sum, item) => sum + item.balance * item.price, 0);
    const expiringSoonCount = inventory.filter((item) =>
      isExpiringSoon(item.nearestExpiryDate)
    ).length;

    return [
      {
        label: "จำนวนสินค้า",
        value: formatNumber(inventory.length),
        unit: "รายการ",
        helper: "นับตามชื่อสินค้าและรหัสสินค้า",
        tone: "sky" as const,
      },
      {
        label: "คงเหลือรวม",
        value: formatNumber(totalBalance),
        unit: "หน่วย",
        helper: "รวมสต๊อกที่พร้อมขายหรือใช้งาน",
        tone: "emerald" as const,
      },
      {
        label: "ใกล้หมดอายุ",
        value: formatNumber(expiringSoonCount),
        unit: "รายการ",
        helper: "ภายใน 90 วันจากวันนี้",
        tone: "amber" as const,
      },
      {
        label: "รับเข้าวันนี้",
        value: formatNumber(receivedToday),
        unit: "หน่วย",
        helper: "อ้างอิงจากวันที่รายการ",
        tone: "sky" as const,
      },
      {
        label: "มูลค่าสต๊อก",
        value: formatCurrency(totalValue),
        helper: "คำนวณจากคงเหลือ x ราคาล่าสุด",
        tone: "violet" as const,
      },
      {
        label: "จ่ายออกวันนี้",
        value: formatNumber(issuedToday),
        unit: "หน่วย",
        helper: "อ้างอิงจากวันที่รายการ",
        tone: "amber" as const,
      },
    ];
  }, [inventory, transactions]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const quantity = Number(form.quantity);
    const price = Number(form.price || 0);
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      sku: form.sku.trim(),
      category: form.category.trim() || "-",
      unit: form.unit.trim(),
      type: form.type,
      quantity,
      price,
      date: form.date,
      expiryDate: form.expiryDate,
      note: form.note.trim(),
      createdAt: Date.now(),
    };

    if (!transaction.name || !transaction.unit || quantity <= 0) {
      window.alert("กรอกข้อมูลสินค้า หน่วยนับ และจำนวนให้ครบก่อนบันทึก");
      return;
    }

    if (transaction.type === "out") {
      const currentItem = buildInventoryMap(transactions).get(buildItemKey(transaction));
      const available = currentItem?.balance ?? 0;

      if (quantity > available) {
        window.alert(`จ่ายออกไม่ได้ เพราะคงเหลือเพียง ${available} ${transaction.unit}`);
        return;
      }
    }

    setTransactions((current) => [transaction, ...current]);
    setForm(createEmptyForm());
  }

  function handleReset() {
    if (!window.confirm("ต้องการล้างข้อมูลทั้งหมดใช่หรือไม่")) {
      return;
    }

    setTransactions([]);
    setForm(createEmptyForm());
  }

  function handleSeedData() {
    if (
      transactions.length > 0 &&
      !window.confirm("มีข้อมูลอยู่แล้ว ต้องการเติมข้อมูลตัวอย่างเพิ่มใช่หรือไม่")
    ) {
      return;
    }

    setTransactions((current) => [...createSampleTransactions(), ...current]);
  }

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
  }

  function handleNavigationClick(sectionId: string) {
    setActiveSection(sectionId);
    closeMobileMenu();
  }

  const sidebarContent = (
    <>
      <div className="dashboard-sidebar-brand">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-sky-50 text-sky-700">
          <PackageCheck aria-hidden="true" size={20} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--text-strong)]">
            Stock Flow Manager
          </p>
          <p className="mt-0.5 text-[12px] font-semibold text-[var(--text-muted)]">
            Inventory Control
          </p>
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

          return (
            <a
              key={item.href}
              className={`dashboard-nav-item ${
                activeSection === item.href.slice(1) ? "dashboard-nav-item-active" : ""
              }`}
              href={item.href}
              onClick={() => handleNavigationClick(item.href.slice(1))}
              aria-current={activeSection === item.href.slice(1) ? "page" : undefined}
            >
              <Icon aria-hidden="true" className="dashboard-nav-icon" size={17} strokeWidth={2.1} />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      <div className="dashboard-sidebar-status">
        <p className="text-[12px] font-semibold text-[var(--text-muted)]">สถานะข้อมูล</p>
        <p className="mt-2 text-sm font-bold text-[var(--text-strong)]">
          {formatNumber(transactions.length)} รายการ
        </p>
        <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
          บันทึกไว้ในเครื่องนี้อัตโนมัติ และพร้อมกลับมาใช้งานต่อ
        </p>
      </div>
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-600">
                Dashboard
              </p>
              <h1 className="truncate text-lg font-bold text-[var(--text-strong)] md:text-xl">
                Stock Flow Manager
              </h1>
            </div>
          </div>

          <div className="dashboard-header-actions">
            <button type="button" onClick={handleSeedData} className="secondary-button">
              โหลดข้อมูลตัวอย่าง
            </button>
            <button type="button" onClick={handleReset} className="danger-button">
              ล้างข้อมูลทั้งหมด
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="dashboard-intro">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-sky-600">
              Inventory Dashboard
            </p>
            <h2 className="dashboard-title">แดชบอร์ดสต๊อก</h2>
            <p className="dashboard-subtitle mt-2 max-w-3xl">
              บันทึกรับเข้า จ่ายออก ติดตามสต๊อกคงเหลือ และหยิบสินค้าที่ใกล้หมดอายุขึ้นมา
              จัดการได้เร็วจากหน้าเดียว
            </p>
          </section>

          <section
            id="overview"
            className="grid gap-3 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]"
          >
            <div id="form">
              <StockForm
                form={form}
                inputClassName={inputClassName}
                onSubmit={handleSubmit}
                onChange={updateForm}
              />
            </div>

            <section className="grid gap-3">
              <StatsGrid stats={stats} />

              <div id="priority">
                <DataPanel
                  title="สินค้าที่ควรเร่งขายก่อน"
                  description="แสดงสินค้าคงเหลือที่ใกล้หมดอายุภายใน 90 วัน เพื่อให้นำออกมาขายก่อน"
                >
                  <Table
                    headers={["สินค้า", "วันหมดอายุ", "เหลืออีก", "คงเหลือ", "คำแนะนำ"]}
                    emptyMessage="ยังไม่มีสินค้าที่ใกล้หมดอายุภายใน 90 วัน"
                    columnCount={5}
                  >
                    {priorityItems.map((item) => {
                      const daysLeft = getDaysUntil(item.nearestExpiryDate);

                      return (
                        <tr key={`${item.key}-priority`}>
                          <td>
                            <strong className="font-semibold text-[var(--text-strong)]">
                              {item.name}
                            </strong>
                            <div className="text-[12px] text-[var(--text-muted)]">
                              {item.sku || "-"}
                            </div>
                          </td>
                          <td>{formatDate(item.nearestExpiryDate)}</td>
                          <td>
                            <StatusBadge tone={daysLeft <= 30 ? "urgent" : "warn"}>
                              {formatDaysLeft(daysLeft)}
                            </StatusBadge>
                          </td>
                          <td className="text-right">
                            {formatNumber(item.balance)} {item.unit}
                          </td>
                          <td>
                            {daysLeft <= 30
                              ? "เร่งจัดโปรหรือวางหน้าร้าน"
                              : "นำล็อตนี้ออกขายก่อน"}
                          </td>
                        </tr>
                      );
                    })}
                  </Table>
                </DataPanel>
              </div>

              <div id="inventory">
                <DataPanel
                  title="ภาพรวมคงเหลือสินค้า"
                  description="จำนวนคงเหลือแยกตามสินค้า พร้อมมูลค่าโดยประมาณ"
                  action={
                    <input
                      type="search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="ค้นหาชื่อสินค้าหรือรหัสสินค้า"
                      className={`${inputClassName} min-w-[240px]`}
                    />
                  }
                >
                  <Table
                    headers={[
                      "สินค้า",
                      "หมวดหมู่",
                      "หมดอายุใกล้สุด",
                      "คงเหลือ",
                      "รับเข้า",
                      "จ่ายออก",
                      "มูลค่าคงเหลือ",
                    ]}
                    emptyMessage="ยังไม่มีข้อมูล ลองเพิ่มรายการแรกได้เลย"
                    columnCount={7}
                  >
                    {filteredInventory
                      .sort((a, b) => a.name.localeCompare(b.name, "th"))
                      .map((item) => (
                        <tr key={item.key}>
                          <td>
                            <strong className="font-semibold text-[var(--text-strong)]">
                              {item.name}
                            </strong>
                            <div className="text-[12px] text-[var(--text-muted)]">
                              {item.sku || "-"}
                            </div>
                          </td>
                          <td>{item.category}</td>
                          <td>
                            {item.nearestExpiryDate ? formatDate(item.nearestExpiryDate) : "-"}
                          </td>
                          <td
                            className={`text-right ${
                              item.balance <= LOW_STOCK_THRESHOLD
                                ? "font-semibold text-amber-700"
                                : ""
                            }`}
                          >
                            {formatNumber(item.balance)}{" "}
                            <span className="text-[12px] text-[var(--text-subtle)]">
                              {item.unit}
                            </span>
                          </td>
                          <td className="text-right">
                            {formatNumber(item.totalIn)}{" "}
                            <span className="text-[12px] text-[var(--text-subtle)]">
                              {item.unit}
                            </span>
                          </td>
                          <td className="text-right">
                            {formatNumber(item.totalOut)}{" "}
                            <span className="text-[12px] text-[var(--text-subtle)]">
                              {item.unit}
                            </span>
                          </td>
                          <td className="text-right">
                            {formatCurrency(item.balance * item.price)}
                          </td>
                        </tr>
                      ))}
                  </Table>
                </DataPanel>
              </div>

              <div id="transactions">
                <DataPanel title="รายการล่าสุด" description="เรียงจากรายการใหม่สุดไปเก่าสุด">
                  <Table
                    headers={[
                      "วันที่รายการ",
                      "สินค้า",
                      "ประเภท",
                      "จำนวน",
                      "วันหมดอายุ",
                      "ราคาต่อหน่วย",
                      "หมายเหตุ",
                    ]}
                    emptyMessage="ยังไม่มีข้อมูล ลองเพิ่มรายการแรกได้เลย"
                    columnCount={7}
                  >
                    {transactions
                      .slice()
                      .sort((a, b) => b.createdAt - a.createdAt)
                      .map((item) => (
                        <tr key={item.id}>
                          <td>{formatDate(item.date)}</td>
                          <td>
                            <strong className="font-semibold text-[var(--text-strong)]">
                              {item.name}
                            </strong>
                            <div className="text-[12px] text-[var(--text-muted)]">
                              {item.sku || "-"}
                            </div>
                          </td>
                          <td>
                            <StatusBadge tone={item.type === "in" ? "in" : "out"}>
                              {item.type === "in" ? "รับเข้า" : "จ่ายออก"}
                            </StatusBadge>
                          </td>
                          <td className="text-right">
                            {formatNumber(item.quantity)}{" "}
                            <span className="text-[12px] text-[var(--text-subtle)]">
                              {item.unit}
                            </span>
                          </td>
                          <td>{item.expiryDate ? formatDate(item.expiryDate) : "-"}</td>
                          <td className="text-right">{formatCurrency(item.price)}</td>
                          <td className="text-[12px] text-[var(--text-muted)]">
                            {item.note || "-"}
                          </td>
                        </tr>
                      ))}
                  </Table>
                </DataPanel>
              </div>
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
