"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Package, Boxes } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import { getClientMasterProducts, getClientSession } from "@/lib/dashboard-client-cache";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildInventoryLotMap,
  formatCurrencyWithLabel,
  formatDate,
  formatNumber,
  getStockTargetStatus,
  getProductImportTypeLabel,
  matchesMasterProduct,
} from "@/lib/stock-flow/utils";
import type { InventoryLotItem, ProductMaster } from "@/types/stock-flow";
import { useTransactions } from "../TransactionContext";

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
  minStock: number;
  maxStock: number;
  stockTargetStatus: "missing" | "low" | "normal" | "high";
  lots: InventoryLotWithLabel[];
};

type ItemsSectionProps = {
  inventory: GroupedInventoryItem[];
};

function ItemsSection({ inventory }: ItemsSectionProps) {
  const [selectedLotItem, setSelectedLotItem] = useState<GroupedInventoryItem | null>(null);
  const [lotSearch, setLotSearch] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "resale" | "stable">("all");

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

  const selectedLots = selectedLotItem
    ? selectedLotItem.lots.filter((lot) =>
        `${lot.lotLabel} ${lot.receivedDate} ${lot.expiryDate || ""} ${lot.balance}`
          .toLowerCase()
          .includes(lotSearch.trim().toLowerCase())
      )
    : [];

  function openLotDialog(item: GroupedInventoryItem) {
    setSelectedLotItem(item);
    setLotSearch("");
  }

  return <>
    <Dialog
      open={Boolean(selectedLotItem)}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedLotItem(null);
          setLotSearch("");
        }
      }}
    >
      <DialogContent className="inventory-lot-dialog sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{selectedLotItem?.name || "รายละเอียดล็อต"}</DialogTitle>
          <DialogDescription>
            {selectedLotItem
              ? `${selectedLotItem.sku || "ไม่มีรหัสสินค้า"} · ${selectedLotItem.category} · คงเหลือ ${formatNumber(selectedLotItem.balance)} ${selectedLotItem.unit}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {selectedLotItem ? (
          <div className="inventory-lot-dialog-body">
            <div className="inventory-lot-toolbar">
              <div>
                <b>พบ {formatNumber(selectedLots.length)} ล็อต</b>
                <span>แสดงทุกล็อตที่ตรงกับคำค้นหา</span>
              </div>
              <label>
                <Search size={14} />
                <input
                  value={lotSearch}
                  onChange={(event) => setLotSearch(event.target.value)}
                  placeholder="ค้นหาล็อต วันที่ หรือจำนวน..."
                />
              </label>
            </div>
            <div className="inventory-lot-list inventory-lot-dialog-list">
              {selectedLots.map((lot) => (
                <div key={lot.key}>
                  <span>
                    <b>{lot.lotLabel}</b>
                    <small>รับเข้า {formatDate(lot.receivedDate)} · หมดอายุ {lot.expiryDate ? formatDate(lot.expiryDate) : "-"}</small>
                  </span>
                  <strong>{formatNumber(lot.balance)} {lot.unit}</strong>
                </div>
              ))}
              {selectedLots.length === 0 ? (
                <div className="inventory-lot-empty">ไม่พบล็อตที่ตรงกับคำค้นหา</div>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>

    <section id="items" className="inventory-shop-page">
      <div className="inventory-shop-hero">
        <div className="inventory-shop-title"><span>INVENTORY CATALOG</span><h2>รายการสินค้าในคลัง</h2></div>
        <label className="inventory-shop-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อสินค้า รหัส หรือหมวดหมู่..." /></label>
        <div className="inventory-shop-total"><Boxes size={22} /><b>{formatNumber(filteredInventory.length)}</b><small>รายการสินค้า</small></div>
      </div>
      <div className="inventory-shop-controls">
        <div>{([['all','ทั้งหมด'],['resale','สินค้าซื้อมาขายไป'],['stable','สินค้าเข้าสต็อก']] as const).map(([value,label]) => <button key={value} type="button" className={typeFilter === value ? "active" : ""} onClick={() => setTypeFilter(value)}>{label}</button>)}</div>
      </div>
      <div className="inventory-card-grid">
        {filteredInventory.map((item) => (
          <article key={item.key} className="inventory-product-card">
            <div className="inventory-product-image">{item.imageDataUrl ? <img src={item.imageDataUrl} alt={item.name} /> : <Package size={42} />}<span>{getProductImportTypeLabel(item.productImportType)}</span></div>
            <div className="inventory-product-content"><small>{item.sku || "ไม่มีรหัสสินค้า"}</small><h3>{item.name}</h3><p>{item.category}</p>
              <div className="inventory-balance"><span>คงเหลือ</span><strong className={item.stockTargetStatus}>{formatNumber(item.balance)} <small>{item.unit}</small></strong></div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`stock-pill ${item.stockTargetStatus === "low" ? "stock-pill-warn" : item.stockTargetStatus === "high" ? "stock-pill-danger" : item.stockTargetStatus === "normal" ? "stock-pill-ok" : ""}`}>
                  {item.stockTargetStatus === "low" ? "ต่ำกว่า min" : item.stockTargetStatus === "high" ? "สูงกว่า max" : item.stockTargetStatus === "normal" ? "อยู่ในช่วง" : "ยังไม่ตั้งค่า"}
                </span>
                <span className="text-[var(--text-muted)]">
                  min {formatNumber(item.minStock)} / max {formatNumber(item.maxStock)} {item.unit}
                </span>
              </div>
              <dl><div><dt>ล็อต</dt><dd>{formatNumber(item.lots.length)}</dd></div><div><dt>หมดอายุใกล้สุด</dt><dd>{item.nearestExpiryDate ? formatDate(item.nearestExpiryDate) : "-"}</dd></div><div><dt>ต้นทุนรวม</dt><dd>{formatCurrencyWithLabel(item.totalCostValue, item.costCurrency)}</dd></div></dl>
              <button type="button" className="inventory-lot-toggle" onClick={() => openLotDialog(item)}><span>ดูรายละเอียด {formatNumber(item.lots.length)} ล็อต</span></button>
            </div>
          </article>
        ))}
        {filteredInventory.length === 0 ? <div className="issue-shop-empty"><Package size={44} /><h3>ไม่พบสินค้า</h3><p>ลองเปลี่ยนคำค้นหาหรือประเภทสินค้า</p></div> : null}
      </div>
    </section>
  </>;
}

export default function ItemsPage() {
  const { transactions, loading } = useTransactions();
  const [canViewInventory, setCanViewInventory] = useState<boolean | null>(null);
  const [masterProducts, setMasterProducts] = useState<ProductMaster[]>([]);

  useEffect(() => {
    getClientSession()
      .then((data) => {
        const role = data?.user?.role;
        setCanViewInventory(role === "admin");
      })
      .catch(() => setCanViewInventory(false));
    getClientMasterProducts()
      .then((products) => setMasterProducts(products))
      .catch(() => setMasterProducts([]));
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
          minStock: 0,
          maxStock: 0,
          stockTargetStatus: "missing",
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

    return Array.from(groupedInventory.values()).map((item) => {
      const matchedProduct = masterProducts.find((product) => matchesMasterProduct(item, product));
      const minStock = matchedProduct?.minStock ?? 0;
      const maxStock = matchedProduct?.maxStock ?? 0;

      return {
        ...item,
        minStock,
        maxStock,
        stockTargetStatus: getStockTargetStatus(item.balance, minStock, maxStock),
        lots: item.lots.sort(
          (a, b) =>
            a.receivedDate.localeCompare(b.receivedDate) ||
            a.expiryDate.localeCompare(b.expiryDate) ||
            a.createdAt - b.createdAt
        ),
      };
    });
  }, [masterProducts, transactions]);

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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--text-muted)]">
        กำลังโหลดข้อมูลสินค้า...
      </div>
    );
  }

  return <ItemsSection inventory={inventory} />;
}
