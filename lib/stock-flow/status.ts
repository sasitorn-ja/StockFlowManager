import type { TransactionStatus } from "@/types/stock-flow";

export const REQUISITION_STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: "รอผู้จัดการอนุมัติ",
  approved: "อนุมัติแล้ว · รอจ่ายสินค้า",
  employee_confirmed: "ผู้ขอรับสินค้าแล้ว · รอปิดงาน",
  completed: "จ่ายสินค้าแล้ว",
  cancelled: "ยกเลิกแล้ว",
};

export function getRequisitionStatusLabel(status?: TransactionStatus) {
  return REQUISITION_STATUS_LABELS[status ?? "completed"];
}

export function getRequisitionStatusClass(status?: TransactionStatus) {
  if (status === "pending") return "stock-pill-warn";
  if (status === "cancelled") return "stock-pill-danger";
  return "stock-pill-ok";
}

export const RECEIVE_STATUS_LABEL = "รับเข้าสต็อกแล้ว";
