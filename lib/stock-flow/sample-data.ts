import type { Transaction } from "@/types/stock-flow";
import { addDays, getLocalDateValue } from "@/lib/stock-flow/utils";

export function createSampleTransactions(): Transaction[] {
  const today = getLocalDateValue();

  const samples: Omit<Transaction, "id" | "createdAt">[] = [
    {
      name: "น้ำดื่ม 600 มล.",
      sku: "DRINK-001",
      category: "เครื่องดื่ม",
      productImportType: "resale",
      unit: "แพ็ค",
      type: "in",
      quantity: 24,
      price: 55,
      costPrice: 42,
      date: today,
      expiryDate: addDays(today, 75),
      issueKey: "",
      requester: "",
      note: "รับเข้าจากซัพพลายเออร์ A",
    },
    {
      name: "น้ำดื่ม 600 มล.",
      sku: "DRINK-001",
      category: "เครื่องดื่ม",
      productImportType: "resale",
      unit: "แพ็ค",
      type: "out",
      quantity: 6,
      price: 55,
      costPrice: 42,
      date: today,
      expiryDate: addDays(today, 75),
      issueKey: "REQ-0001",
      requester: "ฝ่ายขาย",
      note: "ขายหน้าร้าน",
    },
    {
      name: "บะหมี่กึ่งสำเร็จรูป",
      sku: "FOOD-013",
      category: "อาหารแห้ง",
      productImportType: "resale",
      unit: "กล่อง",
      type: "in",
      quantity: 15,
      price: 125,
      costPrice: 98,
      date: today,
      expiryDate: addDays(today, 28),
      issueKey: "",
      requester: "",
      note: "เติมสต๊อกรอบเช้า",
    },
    {
      name: "ถุงหูหิ้ว",
      sku: "PACK-004",
      category: "บรรจุภัณฑ์",
      productImportType: "stable",
      unit: "มัด",
      type: "in",
      quantity: 10,
      price: 40,
      costPrice: 32,
      date: today,
      expiryDate: "",
      issueKey: "",
      requester: "",
      note: "สั่งซื้อสำหรับแพ็กสินค้า",
    },
  ];

  return samples.map((item, index) => ({
    ...item,
    id: crypto.randomUUID(),
    createdAt: Date.now() - index * 1000,
  }));
}
