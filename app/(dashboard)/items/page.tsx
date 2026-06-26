"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataPanel } from "@/components/stock-flow/DataPanel";
import { Table } from "@/components/stock-flow/Table";
import { LOW_STOCK_THRESHOLD } from "@/lib/stock-flow/constants";
import {
  buildInventoryMap,
  formatDate,
  formatNumber,
  formatCurrency,
  getProductImportTypeLabel,
} from "@/lib/stock-flow/utils";
import type { InventoryItem } from "@/types/stock-flow";
import { useTransactions } from "../TransactionContext";

type ItemsSectionProps = {
  inventory: InventoryItem[];
};

function ItemsSection({ inventory }: ItemsSectionProps) {
  const router = useRouter();

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
              รวมสินค้าทั้งซื้อมาขายไปและสินค้า stable ในหน้าเดียว
            </p>
          </div>
        </div>
      </section>

      <DataPanel
        title="รายการสินค้าทั้งหมด"
        description="รวมสินค้าทั้งซื้อมาขายไปและสินค้า stable ในหน้าเดียว"
      >
        <Table
          headers={[
            "สินค้า",
            "ประเภทสินค้า",
            "หมวดหมู่",
            "หมดอายุใกล้สุด",
            "คงเหลือ",
            "รับเข้า",
            "จ่ายออก",
            "ราคาต้นทุน",
            "มูลค่าคงเหลือ",
            "มูลค่าต้นทุน",
            "จัดการ",
          ]}
          emptyMessage="ยังไม่มีรายการสินค้า"
          columnCount={11}
        >
          {inventory
            .slice()
            .sort((a, b) => {
              const typeCompare = getProductImportTypeLabel(a.productImportType).localeCompare(
                getProductImportTypeLabel(b.productImportType),
                "th"
              );

              return typeCompare || a.name.localeCompare(b.name, "th");
            })
            .map((item) => (
              <tr key={`${item.key}-items`}>
                <td>
                  <strong className="font-semibold text-[var(--text-strong)]">{item.name}</strong>
                  <div className="text-[12px] text-[var(--text-muted)]">{item.sku || "-"}</div>
                </td>
                <td>{getProductImportTypeLabel(item.productImportType)}</td>
                <td>{item.category}</td>
                <td>{item.nearestExpiryDate ? formatDate(item.nearestExpiryDate) : "-"}</td>
                <td
                  className={`text-right ${
                    item.balance <= LOW_STOCK_THRESHOLD ? "font-semibold text-amber-700" : ""
                  }`}
                >
                  {formatNumber(item.balance)}{" "}
                  <span className="text-[12px] text-[var(--text-subtle)]">{item.unit}</span>
                </td>
                <td className="text-right">
                  {formatNumber(item.totalIn)}{" "}
                  <span className="text-[12px] text-[var(--text-subtle)]">{item.unit}</span>
                </td>
                <td className="text-right">
                  {formatNumber(item.totalOut)}{" "}
                  <span className="text-[12px] text-[var(--text-subtle)]">{item.unit}</span>
                </td>
                <td className="text-right">{formatCurrency(item.costPrice ?? 0)}</td>
                <td className="text-right">{formatCurrency(item.balance * item.price)}</td>
                <td className="text-right">
                  {formatCurrency(item.balance * (item.costPrice ?? 0))}
                </td>
                <td>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push("/settings")}
                    >
                      <Pencil size={14} />
                      แก้ไข
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => router.push("/settings")}
                    >
                      <Trash2 size={14} />
                      ลบ
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
        </Table>
      </DataPanel>
    </section>
  );
}

export default function ItemsPage() {
  const { transactions } = useTransactions();
  const inventory = useMemo(() => [...buildInventoryMap(transactions).values()], [transactions]);

  return <ItemsSection inventory={inventory} />;
}
