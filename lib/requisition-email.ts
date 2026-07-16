import nodemailer from "nodemailer";
import { resolveEmailRecipients } from "@/lib/email-routing";
import { findUserEmailRecipient, getAdminEmailRecipients } from "@/lib/email-recipients";
import { getRequisitionStatusLabel } from "@/lib/stock-flow/status";
import type { TransactionStatus } from "@/types/stock-flow";

type RequisitionNotice = {
  issueKey: string;
  status: TransactionStatus;
  actorName: string;
  requester?: string;
  requesterEmail?: string;
  createdBy?: string;
  approver?: string;
};

export async function sendRequisitionNotice(input: RequisitionNotice) {
  if (input.status !== "approved") return;

  const host = process.env.MAIL_HOST;
  const username = process.env.MAIL_USERNAME;
  const password = process.env.MAIL_PASSWORD;
  const from = process.env.MAIL_FROM_ADDRESS || username;
  if (!host || !username || !password || !from) return;

  const adminRecipients = await getAdminEmailRecipients();
  const requesterRecipient = input.requesterEmail?.trim()
    ? { address: input.requesterEmail.trim(), name: input.requester?.trim() || input.requesterEmail.trim() }
    : await findUserEmailRecipient(input.requester || "");
  if (!requesterRecipient && adminRecipients.length === 0) return;
  const toRecipients = resolveEmailRecipients(requesterRecipient ? [requesterRecipient] : adminRecipients).recipients;
  const adminBcc = requesterRecipient
    ? resolveEmailRecipients(adminRecipients).recipients.filter(
        (recipient) => recipient.address.toLowerCase() !== requesterRecipient.address.toLowerCase()
      )
    : [];

  const port = Number(process.env.MAIL_PORT || 465);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const normalizedAppUrl = appUrl.replace(/\/$/, "");
  const requisitionUrl = normalizedAppUrl
    ? `${normalizedAppUrl}/approve?issueKey=${encodeURIComponent(input.issueKey)}`
    : "";
  const statusLabel = getRequisitionStatusLabel(input.status);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465 || (process.env.MAIL_ENCRYPTION || "SSL").toUpperCase() === "SSL",
    auth: { user: username, pass: password },
  });

  await transporter.sendMail({
    from: { name: process.env.MAIL_FROM_NAME || "Stock Flow Manager", address: from },
    to: toRecipients,
    bcc: adminBcc,
    subject: `[ผู้จัดการอนุมัติแล้ว] ใบเบิกสินค้า ${input.issueKey} รอแอดมินจ่ายสินค้า`,
    text: `ใบเบิก ${input.issueKey}\nสถานะ: ${statusLabel}\nผู้จัดการอนุมัติแล้วโดย: ${input.actorName}\nผู้ขอเบิก: ${input.requester || "-"}\nผู้ขอเบิกไม่ต้องดำเนินการเพิ่มเติม ขั้นตอนถัดไปคือแอดมินจ่ายสินค้าและปิดงาน\n${requisitionUrl ? `ดูสถานะใบเบิก: ${requisitionUrl}` : ""}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#0f172a"><h2>ใบเบิกสินค้า ${input.issueKey} ได้รับอนุมัติแล้ว</h2><p><strong>สถานะ:</strong> ${statusLabel}</p><p><strong>ผู้จัดการอนุมัติโดย:</strong> ${input.actorName}</p><p><strong>ผู้ขอเบิก:</strong> ${input.requester || "-"}</p><p>ผู้ขอเบิกไม่ต้องดำเนินการเพิ่มเติม ขั้นตอนถัดไปคือแอดมินจ่ายสินค้าและปิดงาน</p>${requisitionUrl ? `<p><a href="${requisitionUrl}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#0b63bd;color:#fff;text-decoration:none;font-weight:700">ดูสถานะใบเบิก</a></p>` : ""}<p style="color:#64748b;font-size:12px">อีเมลนี้ส่งโดยอัตโนมัติจากระบบ</p></div>`,
  });
}
