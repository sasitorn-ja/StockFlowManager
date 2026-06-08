import type { FormEvent } from "react";

import { Field } from "@/components/stock-flow/Field";
import type { FormState, TransactionType } from "@/types/stock-flow";

type StockFormProps = {
  form: FormState;
  inputClassName: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
};

export function StockForm({ form, inputClassName, onSubmit, onChange }: StockFormProps) {
  return (
    <section className="dashboard-card h-fit overflow-hidden">
      <div className="dashboard-panel-header">
        <div>
          <h2 className="dashboard-section-title">เพิ่มรายการสต๊อก</h2>
          <p className="dashboard-subtitle">
          รองรับทั้งรับเข้าและจ่ายออก พร้อมวันหมดอายุเพื่อจัดลำดับขายก่อน
          </p>
        </div>
      </div>

      <form className="grid gap-4 p-4" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ชื่อสินค้า">
            <input
              value={form.name}
              onChange={(event) => onChange("name", event.target.value)}
              className={inputClassName}
              placeholder="เช่น น้ำดื่ม 600 มล."
              required
            />
          </Field>

          <Field label="รหัสสินค้า">
            <input
              value={form.sku}
              onChange={(event) => onChange("sku", event.target.value)}
              className={inputClassName}
              placeholder="เช่น SKU-001"
            />
          </Field>

          <Field label="หมวดหมู่">
            <input
              value={form.category}
              onChange={(event) => onChange("category", event.target.value)}
              className={inputClassName}
              placeholder="เช่น เครื่องดื่ม"
            />
          </Field>

          <Field label="หน่วยนับ">
            <input
              value={form.unit}
              onChange={(event) => onChange("unit", event.target.value)}
              className={inputClassName}
              placeholder="ชิ้น / กล่อง / แพ็ค"
              required
            />
          </Field>

          <Field label="ประเภทรายการ">
            <select
              value={form.type}
              onChange={(event) => onChange("type", event.target.value as TransactionType)}
              className={inputClassName}
            >
              <option value="in">รับเข้า</option>
              <option value="out">จ่ายออก</option>
            </select>
          </Field>

          <Field label="จำนวน">
            <input
              type="number"
              min="1"
              step="1"
              value={form.quantity}
              onChange={(event) => onChange("quantity", event.target.value)}
              className={inputClassName}
              required
            />
          </Field>

          <Field label="ราคาต่อหน่วย">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(event) => onChange("price", event.target.value)}
              className={inputClassName}
            />
          </Field>

          <Field label="วันที่">
            <input
              type="date"
              value={form.date}
              onChange={(event) => onChange("date", event.target.value)}
              className={inputClassName}
              required
            />
          </Field>

          <Field label="วันหมดอายุ">
            <input
              type="date"
              value={form.expiryDate}
              onChange={(event) => onChange("expiryDate", event.target.value)}
              className={inputClassName}
            />
          </Field>
        </div>

        <Field label="หมายเหตุ">
          <textarea
            rows={3}
            value={form.note}
            onChange={(event) => onChange("note", event.target.value)}
            className={`${inputClassName} control-textarea`}
            placeholder="ระบุผู้รับผิดชอบ ลูกค้า หรือรายละเอียดเพิ่มเติม"
          />
        </Field>

        <button
          type="submit"
          className="primary-button w-full sm:w-auto"
        >
          บันทึกรายการ
        </button>
      </form>
    </section>
  );
}
