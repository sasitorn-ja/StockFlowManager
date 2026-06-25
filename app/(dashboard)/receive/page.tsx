"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Plus, Search, Filter, ChevronDown, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildInventoryMap,
  createEmptyForm,
  createTransactionId,
  getLocalDateValue,
  formatDate,
  normalizeTransactions,
  formatNumber,
  formatCurrency,
} from "@/lib/stock-flow/utils";
import type { Transaction, CostCurrency, ProductImportType } from "@/types/stock-flow";
import type { FormState } from "./types";

type OverviewFilter = "all" | ProductImportType;

const costCurrencyOptions: { value: CostCurrency; label: string }[] = [
  { value: "THB", label: "🇹🇭 THB" },
  { value: "JPY", label: "🇯🇵 JPY" },
  { value: "CNY", label: "🇨🇳 CNY" },
  { value: "USD", label: "🇺🇸 USD" },
];

const filterOptions: { value: OverviewFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "resale", label: "สินค้าซื้อมาขายไป" },
  { value: "stable", label: "สินค้า stable" },
];

export default function ReceivePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [receiveFilter, setReceiveFilter] = useState<OverviewFilter>("all");
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [isReceivePanelOpen, setIsReceivePanelOpen] = useState(false);
  const [receiveImagePreview, setReceiveImagePreview] = useState<{ src: string; title: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const receiveTransactions = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return transactions
      .filter((item) => {
        if (item.type !== "in") {
          return false;
        }

        if (receiveFilter !== "all" && item.productImportType !== receiveFilter) {
          return false;
        }

        const haystack = `${item.name} ${item.sku} ${item.category} ${item.note}`.toLowerCase();
        return haystack.includes(normalizedSearchTerm);
      })
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [receiveFilter, searchTerm, transactions]);

  const receiveProductSuggestions = useMemo(() => {
    return inventory.slice().sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [inventory]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleProductImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      updateForm("imageDataUrl", "");
      return;
    }

    if (!file.type.startsWith("image/")) {
      window.alert("อัปโหลดได้เฉพาะไฟล์รูปภาพ");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      updateForm("imageDataUrl", result);
    };
    reader.readAsDataURL(file);
  }

  function handleReceiveProductNameChange(value: string) {
    const normalizedValue = value.trim().toLowerCase();

    if (!normalizedValue) {
      setForm((current) => ({
        ...current,
        name: value,
        sku: "",
        category: "",
        imageDataUrl: "",
        unit: "",
        price: "0",
        costPrice: "0",
        costCurrency: "THB",
      }));
      return;
    }

    const matchedItem = receiveProductSuggestions.find(
      (item) => item.name.trim().toLowerCase() === normalizedValue
    );

    setForm((current) => {
      const prevNormalized = current.name.trim().toLowerCase();
      const prevMatchedItem = receiveProductSuggestions.find(
        (item) => item.name.trim().toLowerCase() === prevNormalized
      );

      let updatedFields = {};

      if (!matchedItem && prevMatchedItem) {
        const isSkuUnchanged = current.sku === prevMatchedItem.sku;
        const isCategoryUnchanged = current.category === prevMatchedItem.category;
        const isUnitUnchanged = current.unit === prevMatchedItem.unit;
        const isCostPriceUnchanged = current.costPrice === String(prevMatchedItem.costPrice ?? 0);
        const isPriceUnchanged = current.price === String(prevMatchedItem.price);
        const isCurrencyUnchanged = current.costCurrency === (prevMatchedItem.costCurrency ?? "THB");
        const isImageUnchanged = (current.imageDataUrl || "") === (prevMatchedItem.imageDataUrl || "");

        updatedFields = {
          sku: isSkuUnchanged ? "" : current.sku,
          category: isCategoryUnchanged ? "" : current.category,
          unit: isUnitUnchanged ? "" : current.unit,
          costPrice: isCostPriceUnchanged ? "0" : current.costPrice,
          price: isPriceUnchanged ? "0" : current.price,
          costCurrency: isCurrencyUnchanged ? "THB" : current.costCurrency,
          imageDataUrl: isImageUnchanged ? "" : current.imageDataUrl,
        };
      }

      if (matchedItem) {
        return {
          ...current,
          ...updatedFields,
          name: value,
          sku: matchedItem.sku,
          category: matchedItem.category,
          imageDataUrl: matchedItem.imageDataUrl || "",
          productImportType: matchedItem.productImportType,
          unit: matchedItem.unit,
          price: String(matchedItem.price),
          costPrice: String(matchedItem.costPrice ?? 0),
          costCurrency: matchedItem.costCurrency ?? "THB",
        };
      }

      return {
        ...current,
        ...updatedFields,
        name: value,
      };
    });
  }

  function openReceiveDialog() {
    setForm({
      ...createEmptyForm(),
      productImportType: "resale",
      type: "in",
      date: getLocalDateValue(),
    });
    setIsReceivePanelOpen(true);
  }

  function closeReceiveDialog() {
    setIsReceivePanelOpen(false);
    setForm(createEmptyForm());
  }

  function handleReceiveExport() {
    const rows = receiveTransactions.map((item, index) => ({
      "เลขที่รับเข้า": `IN-${item.date.replaceAll("-", "")}-${String(index + 1).padStart(3, "0")}`,
      "วันที่รับเข้า": formatDate(item.date),
      "เวลา": new Date(item.createdAt).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      "จุดเก็บ / คลังย่อย": item.requester || "-",
      "รายการสินค้า": item.name,
      "รหัสสินค้า": item.sku || "-",
      "จำนวน": item.quantity,
      "หน่วย": item.unit,
      "มูลค่ารวม": item.quantity * (item.costPrice || item.price || 0),
      "หมายเหตุ": item.note || "-",
      "สถานะ": "เสร็จสิ้น",
    }));

    if (rows.length === 0) {
      window.alert("ยังไม่มีรายการรับเข้าสินค้าที่พร้อมส่งออก");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Receive");
    XLSX.writeFile(workbook, `receive-transactions-${getLocalDateValue()}.xlsx`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const quantity = Number(form.quantity);
    const price = Number(form.price || 0);
    const costPrice = Number(form.costPrice || 0);

    if (!Number.isFinite(quantity) || !Number.isFinite(price) || !Number.isFinite(costPrice)) {
      window.alert("กรอกจำนวน ราคา และราคาต้นทุนเป็นตัวเลขที่ถูกต้องก่อนบันทึก");
      return;
    }

    const transaction: Transaction = {
      id: createTransactionId(),
      name: form.name.trim(),
      sku: form.sku.trim(),
      category: form.category.trim() || "-",
      imageDataUrl: form.imageDataUrl,
      productImportType: form.productImportType,
      unit: form.unit.trim(),
      type: "in",
      quantity,
      price: Math.max(0, price),
      costPrice: Math.max(0, costPrice),
      costCurrency: form.costCurrency,
      date: form.date,
      expiryDate: form.expiryDate,
      issueKey: "",
      requester: form.requester.trim(),
      note: form.note.trim(),
      createdAt: Date.now(),
    };

    if (!transaction.name || !transaction.unit || quantity <= 0) {
      window.alert("กรอกข้อมูลสินค้า หน่วยนับ และจำนวนให้ครบก่อนบันทึก");
      return;
    }

    setIsSubmitting(true);

    // Pessimistically update UI & database
    fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transaction),
    })
      .then((res) => {
        if (res.ok) {
          fetchTransactions();
          closeReceiveDialog();
        } else {
          window.alert("ไม่สามารถบันทึกรายการสินค้าเข้าฐานข้อมูล Neon ได้");
        }
      })
      .catch((err) => {
        console.error("Submit error:", err);
        window.alert("เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }

  const currentReceiveFilterLabel =
    filterOptions.find((item) => item.value === receiveFilter)?.label ?? "ทั้งหมด";

  return (
    <>
      <section id="receive" className="receive-page">
        <div className="receive-main">
          <div className="receive-header">
            <div>
              <h2>รับเข้าสินค้า</h2>
              <p>บันทึกรายการรับเข้าและอัปเดตสต๊อกคงเหลือ</p>
            </div>
            <div className="receive-header-actions">
              <Button type="button" onClick={openReceiveDialog}>
                <Plus size={17} />
                บันทึกรับเข้า
              </Button>
            </div>
          </div>

          <section className="receive-table-card">
            <div className="receive-table-toolbar">
              <label className="overview-search">
                <Search size={17} />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="ค้นหาเลขที่รับเข้า, รหัสสินค้า, หมวดหมู่..."
                />
              </label>
              <div className="overview-table-actions">
                <details className="overview-filter-menu">
                  <summary>
                    <Filter size={15} />
                    <span>ตัวกรอง: {currentReceiveFilterLabel}</span>
                    <ChevronDown size={14} />
                  </summary>
                  <div className="overview-filter-dropdown">
                    {filterOptions.map((item) => (
                      <button
                        key={`receive-filter-${item.value}`}
                        type="button"
                        className={receiveFilter === item.value ? "active" : ""}
                        onClick={(event) => {
                          setReceiveFilter(item.value);
                          event.currentTarget.closest("details")?.removeAttribute("open");
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </details>
                <Button type="button" variant="secondary" size="sm" onClick={handleReceiveExport}>
                  <FileText size={15} />
                  ส่งออก
                  <ChevronDown size={14} />
                </Button>
              </div>
            </div>

            <div className="overview-table-wrap">
              <table className="overview-table receive-table">
                <thead>
                  <tr>
                    <th>เลขที่รับเข้า</th>
                    <th>รูปภาพสินค้า</th>
                    <th>วันที่รับเข้า</th>
                    <th>จุดเก็บ / คลังย่อย</th>
                    <th>รายการสินค้า</th>
                    <th>จำนวนรายการ</th>
                    <th>มูลค่ารวม</th>
                    <th>หมายเหตุ</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {receiveTransactions.length > 0 ? (
                    receiveTransactions.map((item, index) => {
                      const receiveNo = `IN-${item.date.replaceAll("-", "")}-${String(
                        index + 1
                      ).padStart(3, "0")}`;
                      const totalValue = item.quantity * (item.costPrice || item.price || 0);

                      return (
                        <tr key={`receive-${item.id}`}>
                          <td className="sku-cell">{receiveNo}</td>
                          <td>
                            {item.imageDataUrl ? (
                              <button
                                type="button"
                                className="receive-image-trigger"
                                onClick={() =>
                                  setReceiveImagePreview({
                                    src: item.imageDataUrl as string,
                                    title: item.name || receiveNo,
                                  })
                                }
                              >
                                <ImageIcon size={15} />
                                ดูรูป
                              </button>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td>
                            <strong>{formatDate(item.date)}</strong>
                            <span>
                              {new Date(item.createdAt).toLocaleTimeString("th-TH", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </td>
                          <td>{item.requester || "-"}</td>
                          <td>
                            <strong>{item.name}</strong>
                            <span>{item.sku || "-"}</span>
                          </td>
                          <td>{formatNumber(item.quantity)}</td>
                          <td>{formatCurrency(totalValue)}</td>
                          <td>{item.note || "-"}</td>
                          <td>
                            <span className="stock-pill stock-pill-ok">เสร็จสิ้น</span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9}>
                        <div className="empty-state">ยังไม่มีรายการรับเข้าสินค้า</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="overview-pagination">
              <span>
                แสดง 1 - {Math.min(receiveTransactions.length, 10)} จาก{" "}
                {formatNumber(receiveTransactions.length)} รายการ
              </span>
              <div>
                <button type="button">‹</button>
                <button type="button" className="active">
                  1
                </button>
                <button type="button">2</button>
                <button type="button">3</button>
                <button type="button">›</button>
              </div>
            </div>
          </section>
        </div>
      </section>

      <Dialog open={Boolean(receiveImagePreview)} onOpenChange={(open) => { if (!open) setReceiveImagePreview(null); }}>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>{receiveImagePreview?.title || "รูปภาพสินค้า"}</DialogTitle>
            <DialogDescription>รูปสินค้าที่แนบไว้ตอนบันทึกรับเข้า</DialogDescription>
          </DialogHeader>

          {receiveImagePreview ? (
            <div className="receive-dialog-image">
              <img src={receiveImagePreview.src} alt={receiveImagePreview.title} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isReceivePanelOpen} onOpenChange={(open) => { if (!open) closeReceiveDialog(); }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>บันทึกรับเข้า</DialogTitle>
            <DialogDescription>เพิ่มรายการรับเข้าโดยไม่บังพื้นที่ตารางหลัก</DialogDescription>
          </DialogHeader>

          <form className="receive-form" onSubmit={handleSubmit}>
            <div className="receive-form-grid">
              <label>
                <span>หมวดหลัก *</span>
                <select
                  value={form.productImportType}
                  onChange={(event) =>
                    updateForm("productImportType", event.target.value as ProductImportType)
                  }
                >
                  <option value="resale">ซื้อมาขายไป</option>
                  <option value="stable">สินค้า stable</option>
                </select>
              </label>

              <label>
                <span>หมวดหมู่ *</span>
                <input
                  value={form.category}
                  onChange={(event) => updateForm("category", event.target.value)}
                  placeholder="เช่น แผ่นพื้นกลวง"
                />
              </label>
            </div>

            <div className="receive-form-grid">
              <label>
                <span>รายการสินค้า *</span>
                <input
                  value={form.name}
                  onChange={(event) => handleReceiveProductNameChange(event.target.value)}
                  placeholder="ชื่อรายการสินค้า"
                  list="receive-product-suggestions"
                  required
                />
                <datalist id="receive-product-suggestions">
                  {receiveProductSuggestions.map((item) => (
                    <option key={`receive-product-${item.key}`} value={item.name} />
                  ))}
                </datalist>
              </label>

              <label>
                <span>รหัสสินค้า</span>
                <input
                  value={form.sku}
                  onChange={(event) => updateForm("sku", event.target.value)}
                  placeholder="เช่น PC-HLD350-300"
                />
              </label>
            </div>

            <div className="receive-form-grid">
              <label>
                <span>จำนวน *</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={(event) => updateForm("quantity", event.target.value)}
                  required
                />
              </label>

              <label>
                <span>หน่วย *</span>
                <input
                  value={form.unit}
                  onChange={(event) => updateForm("unit", event.target.value)}
                  placeholder="เช่น แผ่น / ถุง / ชิ้น"
                  required
                />
              </label>
            </div>

            <div className="receive-form-grid">
              <label>
                <span>ต้นทุนต่อหน่วย *</span>
                <div className="cost-currency-control">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.costPrice}
                    onChange={(event) => updateForm("costPrice", event.target.value)}
                  />
                  <select
                    value={form.costCurrency}
                    onChange={(event) =>
                      updateForm("costCurrency", event.target.value as CostCurrency)
                    }
                  >
                    {costCurrencyOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label>
                <span>จุดเก็บ / คลังย่อย</span>
                <input
                  value={form.requester}
                  onChange={(event) => updateForm("requester", event.target.value)}
                  placeholder="เช่น A01 - ลานวางแผ่นพื้น"
                />
              </label>
            </div>

            <div className="receive-form-grid">
              <label>
                <span>วันที่ผลิต</span>
                <input
                  type="date"
                  value={form.issueKey}
                  onChange={(event) => updateForm("issueKey", event.target.value)}
                />
              </label>

              <label>
                <span>วันหมดอายุ</span>
                <input
                  type="date"
                  value={form.expiryDate}
                  onChange={(event) => updateForm("expiryDate", event.target.value)}
                />
              </label>
            </div>

            <div className="receive-form-grid">
              <label>
                <span>วันที่รับเข้า *</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => updateForm("date", event.target.value)}
                  required
                />
              </label>

              <label>
                <span>หมายเหตุ</span>
                <input
                  value={form.note}
                  onChange={(event) => updateForm("note", event.target.value)}
                  placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
                />
              </label>
            </div>

            <label>
              <span>รูปสินค้า</span>
              <input type="file" accept="image/*" onChange={handleProductImageChange} className="cursor-pointer file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
            </label>

            {form.imageDataUrl ? (
              <div className="receive-image-preview mt-1">
                <img src={form.imageDataUrl} alt={form.name || "รูปสินค้า"} className="rounded-lg object-cover max-h-48 w-full border" />
              </div>
            ) : null}

            <div className="receive-panel-actions">
              <Button type="button" variant="secondary" onClick={closeReceiveDialog} disabled={isSubmitting}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "กำลังบันทึก..." : "บันทึกรายการ"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

