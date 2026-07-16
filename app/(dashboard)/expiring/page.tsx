"use client";

import { useEffect, useMemo, useState } from "react";
import { withBasePath } from "@/lib/base-path";
import { getClientAppSettings, getClientSession } from "@/lib/dashboard-client-cache";
import { Button } from "@/components/ui/button";
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
import { defaultAppSettings, type AppSettings } from "@/lib/app-settings-shared";

export default function ExpiringPage() {
  const { transactions } = useTransactions();
  const [selectedImportType, setSelectedImportType] = useState<ProductImportType>("resale");
  const [canViewExpiring, setCanViewExpiring] = useState<boolean | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);

  useEffect(() => {
    getClientSession()
      .then((data) => {
        const role = data?.user?.role;
        setCanViewExpiring(role === "admin" || role === "manager");
      })
      .catch(() => setCanViewExpiring(false));
    getClientAppSettings()
      .then((settings) => setAppSettings(settings))
      .catch(() => setAppSettings(defaultAppSettings));
  }, []);

  const inventory = useMemo(() => [...buildInventoryMap(transactions).values()], [transactions]);

  const groupData = useMemo(() => {
    const groupLabel = selectedImportType === "resale" ? "ซื้อมาขายไป" : "สินค้าเข้าสต็อก";
    const groupInventory = inventory.filter(
      (item) => (item.productImportType ?? "resale") === selectedImportType
    );
    const priorityItems = groupInventory
      .filter((item) => item.balance > 0 && isExpiringSoon(item.nearestExpiryDate, Number(appSettings.expiryWarningDays || 90)))
      .sort((a, b) => compareExpiryDate(a.nearestExpiryDate, b.nearestExpiryDate));

    return {
      label: groupLabel,
      priorityItems,
    };
  }, [appSettings.expiryWarningDays, inventory, selectedImportType]);

  if (canViewExpiring === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--text-muted)]">
        กำลังตรวจสอบสิทธิ์...
      </div>
    );
  }

  if (!canViewExpiring) {
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

  return (
    <div className="grid gap-4">
      {/* Category selector */}
      <div className="flex justify-end">
        <div className="dashboard-category-switch flex gap-1 rounded-lg bg-[var(--sky-soft)] p-1 border border-sky-100">
          <button
            type="button"
            className={`min-h-11 px-3 py-1.5 rounded text-xs font-semibold ${
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
            className={`min-h-11 px-3 py-1.5 rounded text-xs font-semibold ${
              selectedImportType === "stable"
                ? "bg-sky-600 text-white"
                : "text-sky-700 hover:bg-sky-100"
            }`}
            onClick={() => setSelectedImportType("stable")}
          >
            สินค้าเข้าสต็อก
          </button>
        </div>
      </div>

      <section id="expiring" className="grid gap-3">
        <DataPanel
          title={`${groupData.label}: สินค้าที่ควรเร่งขายก่อน`}
          description={`แสดงสินค้าคงเหลือที่ใกล้หมดอายุภายใน ${formatNumber(Number(appSettings.expiryWarningDays || 90))} วัน เฉพาะกลุ่มนี้`}
        >
          <Table
            headers={["สินค้า", "วันหมดอายุ", "เหลือเวลา", "คงเหลือ"]}
            emptyMessage={`ยังไม่มีสินค้า ${groupData.label} ที่ใกล้หมดอายุภายใน ${formatNumber(Number(appSettings.expiryWarningDays || 90))} วัน`}
            columnCount={4}
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
                </tr>
              );
            })}
          </Table>
        </DataPanel>
      </section>
    </div>
  );
}
