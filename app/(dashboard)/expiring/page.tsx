"use client";

import { useMemo, useState } from "react";
import { DataPanel } from "@/components/stock-flow/DataPanel";
import { StatusBadge } from "@/components/stock-flow/StatusBadge";
import { Table } from "@/components/stock-flow/Table";
import {
  buildInventoryMap,
  compareExpiryDate,
  isExpiringSoon,
  formatDate,
  formatDaysLeft,
  formatNumber,
  getDaysUntil,
} from "@/lib/stock-flow/utils";
import type { ProductImportType } from "@/types/stock-flow";
import { useTransactions } from "../TransactionContext";

export default function ExpiringPage() {
  const { transactions } = useTransactions();
  const [selectedImportType, setSelectedImportType] = useState<ProductImportType>("resale");

  const inventory = useMemo(() => [...buildInventoryMap(transactions).values()], [transactions]);

  const groupData = useMemo(() => {
    const groupLabel = selectedImportType === "resale" ? "ซื้อมาขายไป" : "สินค้า stable";
    const groupInventory = inventory.filter(
      (item) => (item.productImportType ?? "resale") === selectedImportType
    );
    const priorityItems = groupInventory
      .filter((item) => item.balance > 0 && isExpiringSoon(item.nearestExpiryDate))
      .sort((a, b) => compareExpiryDate(a.nearestExpiryDate, b.nearestExpiryDate));

    return {
      label: groupLabel,
      priorityItems,
    };
  }, [inventory, selectedImportType]);

  return (
    <div className="grid gap-4">
      {/* Category selector */}
      <div className="flex justify-end">
        <div className="dashboard-category-switch flex gap-1 rounded-lg bg-[var(--sky-soft)] p-1 border border-sky-100">
          <button
            type="button"
            className={`px-3 py-1.5 rounded text-xs font-semibold ${
              selectedImportType === "resale"
                ? "bg-sky-600 text-white"
                : "text-sky-700 hover:bg-sky-100"
            }`}
            onClick={() => setSelectedImportType("resale")}
          >
            ซื้อมาขายไป
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded text-xs font-semibold ${
              selectedImportType === "stable"
                ? "bg-sky-600 text-white"
                : "text-sky-700 hover:bg-sky-100"
            }`}
            onClick={() => setSelectedImportType("stable")}
          >
            สินค้า stable
          </button>
        </div>
      </div>

      <section id="expiring" className="grid gap-3">
        <DataPanel
          title={`${groupData.label}: สินค้าที่ควรเร่งขายก่อน`}
          description="แสดงสินค้าคงเหลือที่ใกล้หมดอายุภายใน 90 วัน เฉพาะกลุ่มนี้"
        >
          <Table
            headers={["สินค้า", "วันหมดอายุ", "เหลืออีก", "คงเหลือ", "คำแนะนำ"]}
            emptyMessage={`ยังไม่มีสินค้า ${groupData.label} ที่ใกล้หมดอายุภายใน 90 วัน`}
            columnCount={5}
          >
            {groupData.priorityItems.map((item) => {
              const daysLeft = getDaysUntil(item.nearestExpiryDate);

              return (
                <tr key={`${item.key}-priority`}>
                  <td>
                    <strong className="font-semibold text-[var(--text-strong)]">{item.name}</strong>
                    <div className="text-[12px] text-[var(--text-muted)]">{item.sku || "-"}</div>
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
                  <td>{daysLeft <= 30 ? "เร่งจัดโปรหรือวางหน้าร้าน" : "นำล็อตนี้ออกขายก่อน"}</td>
                </tr>
              );
            })}
          </Table>
        </DataPanel>
      </section>
    </div>
  );
}
