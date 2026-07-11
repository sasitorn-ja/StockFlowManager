"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search, Package, Boxes } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import { Button } from "@/components/ui/button";
import {
  buildInventoryLotMap,
  formatCurrencyWithLabel,
  formatDate,
  formatNumber,
  getProductImportTypeLabel,
} from "@/lib/stock-flow/utils";
import type { InventoryLotItem } from "@/types/stock-flow";
import { useTransactions } from "../TransactionContext";
import { defaultAppSettings, type AppSettings } from "@/lib/app-settings-shared";

type InventoryLotWithLabel = InventoryLotItem & {
  lotLabel: string;
  lotSequence: number;
};

type GroupedInventoryItem = {
  key: string;
  baseItemKey: string;
  name: string;
  sku: string;
  category: string;
  imageDataUrl?: string;
  productImportType: InventoryLotItem["productImportType"];
  unit: string;
  balance: number;
  totalCostValue: number;
  costCurrency: InventoryLotItem["costCurrency"];
  firstReceivedDate: string;
  nearestExpiryDate: string;
  lots: InventoryLotWithLabel[];
};

type ItemsSectionProps = {
  inventory: GroupedInventoryItem[];
  lowStockThreshold: number;
};

function ItemsSection({ inventory, lowStockThreshold }: ItemsSectionProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [lotSearchByItem, setLotSearchByItem] = useState<Record<string, string>>({});
  const [lotPageByItem, setLotPageByItem] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "resale" | "stable">("all");
  const lotsPerPage = 8;

  function toggleRow(itemKey: string) {
    setExpandedRows((current) => ({
      ...current,
      [itemKey]: !current[itemKey],
    }));
  }

  function updateLotSearch(itemKey: string, value: string) {
    setLotSearchByItem((current) => ({ ...current, [itemKey]: value }));
    setLotPageByItem((current) => ({ ...current, [itemKey]: 1 }));
  }

  function changeLotPage(itemKey: string, nextPage: number) {
    setLotPageByItem((current) => ({ ...current, [itemKey]: nextPage }));
  }

  const filteredInventory = inventory
    .filter((item) => typeFilter === "all" || item.productImportType === typeFilter)
    .filter((item) => `${item.name} ${item.sku} ${item.category}`.toLowerCase().includes(search.trim().toLowerCase()))
    .slice()
            .sort((a, b) => {
              const typeCompare = getProductImportTypeLabel(a.productImportType).localeCompare(
                getProductImportTypeLabel(b.productImportType),
                "th"
              );

              return (
                typeCompare ||
                a.name.localeCompare(b.name, "th") ||
                a.firstReceivedDate.localeCompare(b.firstReceivedDate) ||
                a.nearestExpiryDate.localeCompare(b.nearestExpiryDate)
              );
            });

  return <section id="items" className="inventory-shop-page">
    <div className="inventory-shop-hero">
      <div><span>INVENTORY CATALOG</span><h2>รายการสินค้าในคลัง</h2></div>
      <div className="inventory-shop-total"><Boxes size={22} /><b>{formatNumber(filteredInventory.length)}</b><small>รายการสินค้า</small></div>
    </div>
    <div className="inventory-shop-controls">
      <label><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อสินค้า รหัส หรือหมวดหมู่..." /></label>
      <div>{([['all','ทั้งหมด'],['resale','สินค้าซื้อมาขายไป'],['stable','สินค้าเข้าสต็อก']] as const).map(([value,label]) => <button key={value} type="button" className={typeFilter === value ? "active" : ""} onClick={() => setTypeFilter(value)}>{label}</button>)}</div>
    </div>
    <div className="inventory-card-grid">
      {filteredInventory.map((item) => {
        const expanded = Boolean(expandedRows[item.key]);
        const lotSearch = lotSearchByItem[item.key]?.trim().toLowerCase() || "";
        const filteredLots = item.lots.filter((lot) =>
          `${lot.lotLabel} ${lot.receivedDate} ${lot.expiryDate || ""} ${lot.balance}`
            .toLowerCase()
            .includes(lotSearch)
        );
        const totalLotPages = Math.max(1, Math.ceil(filteredLots.length / lotsPerPage));
        const currentLotPage = Math.min(lotPageByItem[item.key] || 1, totalLotPages);
        const visibleLots = filteredLots.slice(
          (currentLotPage - 1) * lotsPerPage,
          currentLotPage * lotsPerPage
        );

        return <article key={item.key} className={`inventory-product-card ${expanded ? "expanded" : ""}`}>
          <div className="inventory-product-image">{item.imageDataUrl ? <img src={item.imageDataUrl} alt={item.name} /> : <Package size={42} />}<span>{getProductImportTypeLabel(item.productImportType)}</span></div>
          <div className="inventory-product-content"><small>{item.sku || "ไม่มีรหัสสินค้า"}</small><h3>{item.name}</h3><p>{item.category}</p>
            <div className="inventory-balance"><span>คงเหลือ</span><strong className={item.balance <= lowStockThreshold ? "low" : ""}>{formatNumber(item.balance)} <small>{item.unit}</small></strong></div>
            <dl><div><dt>ล็อต</dt><dd>{formatNumber(item.lots.length)}</dd></div><div><dt>หมดอายุใกล้สุด</dt><dd>{item.nearestExpiryDate ? formatDate(item.nearestExpiryDate) : "-"}</dd></div><div><dt>ต้นทุนรวม</dt><dd>{formatCurrencyWithLabel(item.totalCostValue, item.costCurrency)}</dd></div></dl>
            <button type="button" className="inventory-lot-toggle" onClick={() => toggleRow(item.key)}><span>{expanded ? "ซ่อนรายละเอียดล็อต" : `ดูรายละเอียด ${formatNumber(item.lots.length)} ล็อต`}</span>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
          </div>
          {expanded ? (
            <div className="inventory-lot-panel">
              <div className="inventory-lot-toolbar">
                <div>
                  <b>{formatNumber(filteredLots.length)} ล็อตที่พบ</b>
                  <span>แสดงครั้งละ {formatNumber(lotsPerPage)} ล็อต</span>
                </div>
                <label>
                  <Search size={14} />
                  <input
                    value={lotSearchByItem[item.key] || ""}
                    onChange={(event) => updateLotSearch(item.key, event.target.value)}
                    placeholder="ค้นหาล็อต วันที่ หรือจำนวน..."
                  />
                </label>
              </div>
              <div className="inventory-lot-list">
                {visibleLots.map((lot) => (
                  <div key={lot.key}>
                    <span>
                      <b>{lot.lotLabel}</b>
                      <small>รับเข้า {formatDate(lot.receivedDate)} · หมดอายุ {lot.expiryDate ? formatDate(lot.expiryDate) : "-"}</small>
                    </span>
                    <strong>{formatNumber(lot.balance)} {lot.unit}</strong>
                  </div>
                ))}
                {visibleLots.length === 0 ? (
                  <div className="inventory-lot-empty">ไม่พบล็อตที่ตรงกับคำค้นหา</div>
                ) : null}
              </div>
              {filteredLots.length > lotsPerPage ? (
                <div className="inventory-lot-pagination">
                  <button
                    type="button"
                    disabled={currentLotPage <= 1}
                    onClick={() => changeLotPage(item.key, currentLotPage - 1)}
                  >
                    ก่อนหน้า
                  </button>
                  <span>หน้า {formatNumber(currentLotPage)} / {formatNumber(totalLotPages)}</span>
                  <button
                    type="button"
                    disabled={currentLotPage >= totalLotPages}
                    onClick={() => changeLotPage(item.key, currentLotPage + 1)}
                  >
                    ถัดไป
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </article>;
      })}
      {filteredInventory.length === 0 ? <div className="issue-shop-empty"><Package size={44} /><h3>ไม่พบสินค้า</h3><p>ลองเปลี่ยนคำค้นหาหรือประเภทสินค้า</p></div> : null}
    </div>
  </section>;
}

export default function ItemsPage() {
  const { transactions } = useTransactions();
  const [canViewInventory, setCanViewInventory] = useState<boolean | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);
  const lowStockThreshold = Number(appSettings.lowStockThreshold || defaultAppSettings.lowStockThreshold);

  useEffect(() => {
    fetch(withBasePath("/api/auth/session"), { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const role = data?.user?.role;
        setCanViewInventory(role === "admin");
      })
      .catch(() => setCanViewInventory(false));
    fetch(withBasePath("/api/settings"), { cache: "no-store" })
      .then((response) => response.ok ? response.json() : defaultAppSettings)
      .then((settings) => setAppSettings({ ...defaultAppSettings, ...settings }))
      .catch(() => setAppSettings(defaultAppSettings));
  }, []);

  const inventory = useMemo(() => {
    const lots = [...buildInventoryLotMap(transactions).values()]
      .filter((item) => item.totalIn > 0)
      .sort((a, b) => {
        const typeCompare = getProductImportTypeLabel(a.productImportType).localeCompare(
          getProductImportTypeLabel(b.productImportType),
          "th"
        );

        return (
          typeCompare ||
          a.name.localeCompare(b.name, "th") ||
          a.receivedDate.localeCompare(b.receivedDate) ||
          a.expiryDate.localeCompare(b.expiryDate) ||
          a.createdAt - b.createdAt
        );
      });

    const lotCounter = new Map<string, number>();
    const labeledLots: InventoryLotWithLabel[] = lots.map((item) => {
      const nextSequence = (lotCounter.get(item.baseItemKey) ?? 0) + 1;
      lotCounter.set(item.baseItemKey, nextSequence);

      return {
        ...item,
        lotSequence: nextSequence,
        lotLabel: `ล็อต ${nextSequence}`,
      };
    });

    const groupedInventory = new Map<string, GroupedInventoryItem>();

    labeledLots.forEach((item) => {
      // ล็อตที่ถูกเบิกหมดแล้วคงอยู่ในประวัติ แต่ไม่ใช่สินค้าคงเหลือ
      // จึงไม่แสดงในหน้ารายการสินค้าและไม่นับจำนวนล็อตที่ยังใช้งาน
      if (item.balance <= 0) {
        return;
      }

      const existing = groupedInventory.get(item.baseItemKey);

      if (!existing) {
        groupedInventory.set(item.baseItemKey, {
          key: item.baseItemKey,
          baseItemKey: item.baseItemKey,
          name: item.name,
          sku: item.sku,
          category: item.category,
          imageDataUrl: item.imageDataUrl,
          productImportType: item.productImportType,
          unit: item.unit,
          balance: item.balance,
          totalCostValue: item.balance * (item.costPrice ?? 0),
          costCurrency: item.costCurrency,
          firstReceivedDate: item.receivedDate,
          nearestExpiryDate: item.expiryDate,
          lots: [item],
        });
        return;
      }

      existing.balance += item.balance;
      existing.totalCostValue += item.balance * (item.costPrice ?? 0);
      existing.lots.push(item);

      if (
        item.receivedDate &&
        (!existing.firstReceivedDate || item.receivedDate < existing.firstReceivedDate)
      ) {
        existing.firstReceivedDate = item.receivedDate;
      }

      if (
        item.expiryDate &&
        (!existing.nearestExpiryDate || item.expiryDate < existing.nearestExpiryDate)
      ) {
        existing.nearestExpiryDate = item.expiryDate;
      }
    });

    return Array.from(groupedInventory.values()).map((item) => ({
      ...item,
      lots: item.lots.sort(
        (a, b) =>
          a.receivedDate.localeCompare(b.receivedDate) ||
          a.expiryDate.localeCompare(b.expiryDate) ||
          a.createdAt - b.createdAt
      ),
    }));
  }, [transactions]);

  if (canViewInventory === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--text-muted)]">
        กำลังตรวจสอบสิทธิ์...
      </div>
    );
  }

  if (!canViewInventory) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="dashboard-card max-w-[480px] p-8 text-center shadow-xl backdrop-blur-xl">
          <h3 className="text-lg font-bold text-[var(--text-strong)]">ปฏิเสธการเข้าถึง</h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            พนักงานมีหน้าที่เบิกสินค้าและติดตามใบเบิกของตัวเองเท่านั้น
          </p>
          <div className="mt-6">
            <Button type="button" onClick={() => window.location.assign(withBasePath("/issue"))}>
              ไปหน้าเบิกจ่ายสินค้า
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <ItemsSection inventory={inventory} lowStockThreshold={lowStockThreshold} />;
}
