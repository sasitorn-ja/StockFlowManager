"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DataPanel } from "@/components/stock-flow/DataPanel";
import { Table } from "@/components/stock-flow/Table";
import { LOW_STOCK_THRESHOLD } from "@/lib/stock-flow/constants";
import {
  buildInventoryLotMap,
  formatCurrency,
  formatCurrencyWithLabel,
  formatDate,
  formatNumber,
  getProductImportTypeLabel,
} from "@/lib/stock-flow/utils";
import type { InventoryLotItem } from "@/types/stock-flow";
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
  productImportType: InventoryLotItem["productImportType"];
  unit: string;
  balance: number;
  totalBalanceValue: number;
  firstReceivedDate: string;
  nearestExpiryDate: string;
  lots: InventoryLotWithLabel[];
};

type ItemsSectionProps = {
  inventory: GroupedInventoryItem[];
};

function ItemsSection({ inventory }: ItemsSectionProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  function toggleRow(itemKey: string) {
    setExpandedRows((current) => ({
      ...current,
      [itemKey]: !current[itemKey],
    }));
  }

  return (
    <section id="items" className="grid gap-3 items-clean-table">
      <DataPanel
        title="รายการสินค้าทั้งหมด"
        description="แสดงสรุปสินค้าแบบสั้นก่อน แล้วกดเปิดดูรายละเอียดล็อตของสินค้าแต่ละรายการได้"
      >
        <Table
          headers={[
            "สินค้า",
            "หมวด",
            "รายละเอียดล็อต",
            "คงเหลือรวม",
            "วันหมดอายุใกล้สุด",
            "มูลค่าขายรวม",
          ]}
          emptyMessage="ยังไม่มีรายการสินค้า"
          columnCount={6}
        >
          {inventory
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
            })
            .flatMap((item) => {
              const isExpanded = Boolean(expandedRows[item.key]);

              const summaryRow = (
                <tr key={`${item.key}-summary`}>
                  <td className="align-top">
                    <div className="grid gap-1.5 min-w-[120px]">
                      <strong className="font-semibold text-[var(--text-strong)]">{item.name}</strong>
                      <span className="text-[12px] text-[var(--text-muted)] break-words">{item.sku || "-"}</span>
                    </div>
                  </td>
                  <td className="align-top">
                    <div className="grid gap-1.5 min-w-[110px]">
                      <span className="items-clean-primary-text">{getProductImportTypeLabel(item.productImportType)}</span>
                      <span className="text-[12px] text-[var(--text-muted)] break-words">{item.category}</span>
                    </div>
                  </td>
                  <td className="align-top">
                    <div className="grid gap-2 min-w-[220px]">
                      <button
                        type="button"
                        onClick={() => toggleRow(item.key)}
                        className="inline-flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-left text-sm font-semibold text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
                      >
                        <span className="whitespace-nowrap">{`เปิดดู ${formatNumber(item.lots.length)} ล็อต`}</span>
                        {isExpanded ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />}
                      </button>
                      <div className="text-[12px] text-[var(--text-muted)] whitespace-nowrap">
                        รับเข้าครั้งแรก {item.firstReceivedDate ? formatDate(item.firstReceivedDate) : "-"}
                      </div>
                    </div>
                  </td>
                  <td
                    className={`align-top text-right whitespace-nowrap ${
                      item.balance <= LOW_STOCK_THRESHOLD ? "font-semibold text-amber-700" : ""
                    }`}
                  >
                    <strong className="text-base">{formatNumber(item.balance)}</strong>
                    <div className="text-[12px] text-[var(--text-subtle)] whitespace-nowrap">{item.unit}</div>
                  </td>
                  <td className="align-top whitespace-nowrap">
                    <span className="items-clean-primary-text">
                      {item.nearestExpiryDate ? formatDate(item.nearestExpiryDate) : "-"}
                    </span>
                  </td>
                  <td className="align-top text-right whitespace-nowrap">
                    <div className="grid gap-1.5 min-w-[150px]">
                      <strong>{formatCurrency(item.totalBalanceValue)}</strong>
                      <span className="text-[12px] text-[var(--text-muted)] whitespace-nowrap">
                        ต้นทุนดูในรายละเอียดล็อต
                      </span>
                    </div>
                  </td>
                </tr>
              );

              const detailRow = isExpanded ? (
                <tr key={`${item.key}-detail`}>
                  <td colSpan={6} className="bg-slate-50/70">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <strong className="text-sm text-[var(--text-strong)]">
                            รายละเอียดล็อตของ {item.name}
                          </strong>
                          <div className="text-[12px] text-[var(--text-muted)]">
                            ดูวันรับเข้า วันหมดอายุ คงเหลือ และต้นทุนของแต่ละล็อต
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-left text-[12px] font-semibold text-[var(--text-muted)]">
                              <th className="px-3 py-2">ล็อต</th>
                              <th className="px-3 py-2">วันรับเข้า</th>
                              <th className="px-3 py-2">วันหมดอายุ</th>
                              <th className="px-3 py-2 text-right">คงเหลือ</th>
                              <th className="px-3 py-2 text-right">ต้นทุน/หน่วย</th>
                              <th className="px-3 py-2 text-right">ต้นทุนคงเหลือ</th>
                              <th className="px-3 py-2 text-right">มูลค่าขายคงเหลือ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.lots.map((lot) => (
                              <tr key={lot.key} className="border-b border-slate-100 last:border-b-0">
                                <td className="px-3 py-3 font-semibold text-[var(--text-strong)] whitespace-nowrap">
                                  {lot.lotLabel}
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                  {lot.receivedDate ? formatDate(lot.receivedDate) : "-"}
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                  {lot.expiryDate ? formatDate(lot.expiryDate) : "-"}
                                </td>
                                <td
                                  className={`px-3 py-3 text-right whitespace-nowrap ${
                                    lot.balance <= LOW_STOCK_THRESHOLD ? "font-semibold text-amber-700" : ""
                                  }`}
                                >
                                  {formatNumber(lot.balance)}{" "}
                                  <span className="text-[12px] text-[var(--text-subtle)]">{lot.unit}</span>
                                </td>
                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                  {formatCurrencyWithLabel(lot.costPrice ?? 0, lot.costCurrency)}
                                </td>
                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                  {formatCurrencyWithLabel(lot.balance * (lot.costPrice ?? 0), lot.costCurrency)}
                                </td>
                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                  {formatCurrency(lot.balance * lot.price)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null;

              return detailRow ? [summaryRow, detailRow] : [summaryRow];
            })}
        </Table>
      </DataPanel>
    </section>
  );
}

export default function ItemsPage() {
  const { transactions } = useTransactions();
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
          productImportType: item.productImportType,
          unit: item.unit,
          balance: item.balance,
          totalBalanceValue: item.balance * item.price,
          firstReceivedDate: item.receivedDate,
          nearestExpiryDate: item.expiryDate,
          lots: [item],
        });
        return;
      }

      existing.balance += item.balance;
      existing.totalBalanceValue += item.balance * item.price;
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

  return <ItemsSection inventory={inventory} />;
}
