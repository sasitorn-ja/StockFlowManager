"use client";

import { useEffect, useMemo, useState } from "react";
import { DataPanel } from "@/components/stock-flow/DataPanel";
import { Table } from "@/components/stock-flow/Table";
import {
  buildInventoryMap,
  normalizeTransactions,
  buildItemKey,
  formatDate,
  formatNumber,
  getProductImportTypeLabel,
} from "@/lib/stock-flow/utils";
import type { Transaction, InventoryItem } from "@/types/stock-flow";

type ItemsSectionProps = {
  inventory: InventoryItem[];
  transactions: Transaction[];
};

function ItemsSection({ inventory, transactions }: ItemsSectionProps) {
  return (
    <section id="items" className="grid gap-3">
      <section className="dashboard-card">
        <div className="dashboard-panel-header">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-sky-600">
              Product Catalog
            </p>
            <h3 className="dashboard-section-title">รายการสินค้าทั้งหมด</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              ใช้ดูข้อมูลสินค้า คงเหลือ หน่วยนับ และวันหมดอายุแบบรวมในหน้าเดียว
            </p>
          </div>
        </div>
      </section>

      <DataPanel
        title="คลังรายการสินค้า"
        description="หน้ารายการสินค้าแยกจากหน้าตั้งค่า เพื่อใช้ดูข้อมูลอย่างเดียว"
      >
        <Table
          headers={[
            "สินค้า",
            "ประเภทสินค้า",
            "หมวดหมู่",
            "คงเหลือ",
            "หน่วย",
            "รับเข้า",
            "จ่ายออก",
            "หมดอายุใกล้สุด",
            "อัปเดตล่าสุด",
          ]}
          emptyMessage="ยังไม่มีรายการสินค้า"
          columnCount={9}
        >
          {inventory
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, "th"))
            .map((item) => {
              const latestTransaction = transactions
                .filter((transaction) => buildItemKey(transaction) === item.key)
                .sort((a, b) => b.createdAt - a.createdAt)[0];

              return (
                <tr key={`${item.key}-items`}>
                  <td>
                    <strong className="font-semibold text-[var(--text-strong)]">{item.name}</strong>
                    <div className="text-[12px] text-[var(--text-muted)]">{item.sku || "-"}</div>
                  </td>
                  <td>{getProductImportTypeLabel(item.productImportType)}</td>
                  <td>{item.category}</td>
                  <td className="text-right font-semibold">{formatNumber(item.balance)}</td>
                  <td>{item.unit}</td>
                  <td className="text-right">{formatNumber(item.totalIn)}</td>
                  <td className="text-right">{formatNumber(item.totalOut)}</td>
                  <td>{item.nearestExpiryDate ? formatDate(item.nearestExpiryDate) : "-"}</td>
                  <td>
                    {latestTransaction ? (
                      <>
                        <strong>{formatDate(latestTransaction.date)}</strong>
                        <span>
                          {new Date(latestTransaction.createdAt).toLocaleTimeString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}
        </Table>
      </DataPanel>
    </section>
  );
}

export default function ItemsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  async function fetchTransactions() {
    try {
      const res = await fetch("/api/transactions");
      if (res.ok) {
        const data = await res.json();
        setTransactions(normalizeTransactions(data));
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    }
  }

  useEffect(() => {
    fetchTransactions();
  }, []);

  const inventory = useMemo(() => [...buildInventoryMap(transactions).values()], [transactions]);

  return <ItemsSection inventory={inventory} transactions={transactions} />;
}

