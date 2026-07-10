import nodemailer from "nodemailer";
import { sql } from "@/lib/db";
import { resolveEmailRecipients } from "@/lib/email-routing";
import { getRequisitionStatusLabel } from "@/lib/stock-flow/status";
import type { TransactionStatus } from "@/types/stock-flow";

type RequisitionNotice = {
  issueKey: string;
  status: TransactionStatus;
  actorName: string;
  requester?: string;
  createdBy?: string;
  approver?: string;
};

export async function sendRequisitionNotice(input: RequisitionNotice) {
  const host = process.env.MAIL_HOST;
  const username = process.env.MAIL_USERNAME;
  const password = process.env.MAIL_PASSWORD;
  const from = process.env.MAIL_FROM_ADDRESS || username;
  if (!host || !username || !password || !from) return;

  const names = [input.requester, input.createdBy, input.approver]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const users = await sql`
    SELECT DISTINCT email, display_name, role
    FROM users
    WHERE email IS NOT NULL AND email <> ''
  `;
  const recipients = users.filter((user) => user.role === "admin" || names.includes(String(user.display_name || ""))).map((user) => ({
    address: String(user.email),
    name: String(user.display_name || user.email),
  }));
  if (recipients.length === 0) return;
  const routedRecipients = resolveEmailRecipients(recipients);

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
    to: routedRecipients.recipients,
    subject: `${routedRecipients.enabled ? "[SIMULATION] " : ""}[${statusLabel}] ใบเบิกสินค้า ${input.issueKey}`,
    text: `ใบเบิก ${input.issueKey}\nสถานะ: ${statusLabel}\nดำเนินการโดย: ${input.actorName}\nผู้ขอเบิก: ${input.requester || "-"}\n${
      routedRecipients.enabled ? `ผู้รับปลายทางจริง: ${routedRecipients.summary}\n` : ""
    }${requisitionUrl ? `เปิดใบเบิกนี้: ${requisitionUrl}` : ""}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#0f172a"><h2>ใบเบิกสินค้า ${input.issueKey}</h2><p><strong>สถานะ:</strong> ${statusLabel}</p><p><strong>ดำเนินการโดย:</strong> ${input.actorName}</p><p><strong>ผู้ขอเบิก:</strong> ${input.requester || "-"}</p>${
      routedRecipients.enabled
        ? `<p><strong>โหมดจำลองส่งอีเมล:</strong> ขณะนี้อีเมลฉบับนี้ถูกส่งเข้า mailbox ทดสอบของศศิธรแทนผู้รับจริง</p><p><strong>ผู้รับปลายทางจริง:</strong> ${routedRecipients.summary}</p>`
        : ""
    }${requisitionUrl ? `<p><a href="${requisitionUrl}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#0b63bd;color:#fff;text-decoration:none;font-weight:700">${input.status === "pending" ? "ตรวจสอบและอนุมัติใบเบิก" : "เปิดใบเบิกนี้"}</a></p>` : ""}<p style="color:#64748b;font-size:12px">อีเมลนี้ส่งโดยอัตโนมัติจากระบบ</p></div>`,
  });
}
