import type { FormEvent } from "react";

import { Field } from "@/components/stock-flow/Field";
import { Button } from "@/components/ui/button";
import { getCostCurrencyLabel, getProductImportTypeLabel } from "@/lib/stock-flow/utils";
import type {
  FormState,
  InventoryItem,
  ProductImportType,
  TransactionType,
} from "@/types/stock-flow";

type StockFormProps = {
  form: FormState;
  inputClassName: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  issueInventoryOptions?: InventoryItem[];
  onIssueInventorySelect?: (itemKey: string) => void;
  mode?: "card" | "plain";
};

export function StockForm({
  form,
  inputClassName,
  onSubmit,
  onChange,
  issueInventoryOptions = [],
  onIssueInventorySelect,
  mode = "card",
}: StockFormProps) {
  const costCurrencyLabel = getCostCurrencyLabel(form.costCurrency);

  const formContent = (
    <form className="grid gap-4 p-4" onSubmit={onSubmit}>
        {form.type === "out" ? (
          <Field label="เลือกสินค้าที่จะนำออก">
            <select
              value=""
              onChange={(event) => onIssueInventorySelect?.(event.target.value)}
              className={inputClassName}
            >
              <option value="">
                เลือกจากสินค้า {getProductImportTypeLabel(form.productImportType)} ที่มีคงเหลือ
              </option>
              {issueInventoryOptions.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.name} {item.sku ? `(${item.sku})` : ""} - คงเหลือ {item.balance}{" "}
                  {item.unit}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

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

          <Field label="ประเภทสินค้า">
            {form.type === "out" ? (
              <input
                value={getProductImportTypeLabel(form.productImportType)}
                className={inputClassName}
                readOnly
              />
            ) : (
              <select
                value={form.productImportType}
                onChange={(event) =>
                  onChange("productImportType", event.target.value as ProductImportType)
                }
                className={inputClassName}
              >
                <option value="resale">ซื้อมาขายไป</option>
                <option value="stable">สินค้า stable</option>
              </select>
            )}
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
            <div className={form.type === "out" ? "price-suffix-control" : ""}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => onChange("price", event.target.value)}
                className={inputClassName}
              />
              {form.type === "out" ? <span>{costCurrencyLabel}</span> : null}
            </div>
          </Field>

          <Field label="ราคาต้นทุน">
            <div className={form.type === "out" ? "price-suffix-control" : ""}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.costPrice}
                onChange={(event) => onChange("costPrice", event.target.value)}
                className={inputClassName}
                placeholder="ต้นทุนต่อหน่วย"
              />
              {form.type === "out" ? <span>{costCurrencyLabel}</span> : null}
            </div>
          </Field>

          <Field label={form.type === "out" ? "วันที่จ่ายออก" : "วันที่รับเข้า"}>
            <input
              type="date"
              value={form.date}
              onChange={(event) => onChange("date", event.target.value)}
              className={inputClassName}
              required
            />
          </Field>

          {form.type === "out" ? (
            <Field label="Key เบิกสินค้า">
              <input
                value={form.issueKey}
                onChange={(event) => onChange("issueKey", event.target.value)}
                className={inputClassName}
                placeholder="เช่น REQ-0001"
              />
            </Field>
          ) : null}

          {form.type === "out" ? (
            <Field label="ผู้ขอเบิกสินค้า">
              <input
                value={form.requester}
                onChange={(event) => onChange("requester", event.target.value)}
                className={inputClassName}
                placeholder="พิมพ์ชื่อผู้ขอเบิก เช่น คุณสมชาย / ฝ่ายขาย"
                required
              />
            </Field>
          ) : null}

          <Field label="วันหมดอายุ">
            <input
              type="date"
              value={form.expiryDate}
              onChange={(event) => onChange("expiryDate", event.target.value)}
              className={inputClassName}
            />
          </Field>
        </div>

        {form.type === "out" ? (
          <Field label="หมายเหตุ">
            <textarea
              rows={3}
              value={form.note}
              onChange={(event) => onChange("note", event.target.value)}
              className={`${inputClassName} control-textarea`}
              placeholder="ระบุผู้รับผิดชอบ ลูกค้า หรือรายละเอียดเพิ่มเติม"
            />
          </Field>
        ) : null}

        <Button type="submit" className="w-full sm:w-auto">
          บันทึกรายการ
        </Button>
      </form>
  );

  if (mode === "plain") {
    return formContent;
  }

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

      {formContent}
    </section>
  );
}
