import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

type IssueEmailRow = {
  name: string;
  productImportTypeLabel: string;
  quantity: number;
  sku: string;
  unit: string;
};

type IssueEmailPayload = {
  approverEmail?: string;
  approverName?: string;
  issueDate?: string;
  issueKey?: string;
  items?: IssueEmailRow[];
  note?: string;
  requester?: string;
  createdBy?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatThaiDate(value: string) {
  const date = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildEmailHtml(input: {
  appUrl: string;
  approverName: string;
  issueDate: string;
  issueKey: string;
  items: IssueEmailRow[];
  note: string;
  requester: string;
  createdBy: string;
}) {
  const rows = input.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.name)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.sku || "-")}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.productImportTypeLabel)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${item.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.unit)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div style="background:#f8fafc;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 28px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;color:#0284c7;">ระบบบริหารสินค้าคงคลัง CPAC SB&amp;M</p>
          <h1 style="margin:0;font-size:24px;line-height:1.3;">มีใบเบิกสินค้ารอการอนุมัติ</h1>
        </div>
        <div style="padding:24px 28px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">เรียน คุณ${escapeHtml(
            input.approverName
          )}</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;">คุณ${escapeHtml(input.createdBy)} ได้คีย์ใบเบิกสินค้าเพื่อขออนุมัติ กรุณาตรวจสอบรายการและจำนวนสินค้าด้านล่างก่อนดำเนินการ</p>
          <div style="margin-bottom:20px;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
            <p style="margin:0 0 8px;"><strong>เลขที่ใบเบิก:</strong> ${escapeHtml(input.issueKey)}</p>
            <p style="margin:0 0 8px;"><strong>วันที่ยื่นคำขอ:</strong> ${escapeHtml(formatThaiDate(input.issueDate))}</p>
            <p style="margin:0 0 8px;"><strong>ผู้ขอเบิก:</strong> ${escapeHtml(input.requester)}</p>
            <p style="margin:0;"><strong>คนคีย์ข้อมูล:</strong> ${escapeHtml(input.createdBy)}</p>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:10px 12px;text-align:left;font-size:12px;border-bottom:1px solid #e2e8f0;">สินค้า</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;border-bottom:1px solid #e2e8f0;">รหัส</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;border-bottom:1px solid #e2e8f0;">ประเภท</th>
                <th style="padding:10px 12px;text-align:right;font-size:12px;border-bottom:1px solid #e2e8f0;">จำนวน</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;border-bottom:1px solid #e2e8f0;">หน่วย</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="margin-bottom:24px;padding:16px;border:1px solid #e2e8f0;border-radius:12px;">
            <p style="margin:0 0 8px;font-weight:700;">หมายเหตุ</p>
            <p style="margin:0;color:#475569;">${escapeHtml(input.note || "-")}</p>
          </div>
          <a href="${escapeHtml(
            `${input.appUrl}/approve`
          )}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#0284c7;color:#ffffff;text-decoration:none;font-weight:700;">ตรวจสอบและอนุมัติใบเบิก</a>
          <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#64748b;">อีเมลฉบับนี้ส่งโดยอัตโนมัติจากระบบ กรุณาไม่ตอบกลับอีเมลนี้</p>
        </div>
      </div>
    </div>
  `;
}

export async function POST(request: Request) {
  const mailHost = process.env.MAIL_HOST;
  const mailPort = Number(process.env.MAIL_PORT || 465);
  const mailUsername = process.env.MAIL_USERNAME;
  const mailPassword = process.env.MAIL_PASSWORD;
  const fromEmail = process.env.MAIL_FROM_ADDRESS || mailUsername;
  const fromName = process.env.MAIL_FROM_NAME || "Stock Flow Manager";
  const mailEncryption = (process.env.MAIL_ENCRYPTION || "SSL").toUpperCase();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  if (!mailHost || !mailUsername || !mailPassword || !fromEmail) {
    return NextResponse.json(
      { error: "Email service is not configured. Check MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD and MAIL_FROM_ADDRESS." },
      { status: 500 }
    );
  }

  let payload: IssueEmailPayload;

  try {
    payload = (await request.json()) as IssueEmailPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const approverEmail = payload.approverEmail?.trim() || "";
  const approverName = payload.approverName?.trim() || "";
  const requester = payload.requester?.trim() || "";
  const createdBy = payload.createdBy?.trim() || requester;
  const issueKey = payload.issueKey?.trim() || "";
  const issueDate = payload.issueDate?.trim() || "";
  const note = payload.note?.trim() || "";
  const items = payload.items ?? [];

  if (!approverEmail || !approverName || !requester || !issueKey || !issueDate || items.length === 0) {
    return NextResponse.json({ error: "Missing required request email fields." }, { status: 400 });
  }

  const transporter = nodemailer.createTransport({
    host: mailHost,
    port: mailPort,
    secure: mailPort === 465 || mailEncryption === "SSL",
    auth: {
      user: mailUsername,
      pass: mailPassword,
    },
  });

  try {
    const result = await transporter.sendMail({
      from: {
        name: fromName,
        address: fromEmail,
      },
      to: {
        name: approverName,
        address: approverEmail,
      },
      subject: `[รออนุมัติ] ใบเบิกสินค้า ${issueKey}`,
      html: buildEmailHtml({
        appUrl,
        approverName,
        issueDate,
        issueKey,
        items,
        note,
        requester,
        createdBy,
      }),
      text: `เรียน คุณ${approverName}\n\nคุณ${createdBy} ได้คีย์ใบเบิกสินค้า ${issueKey} ให้ผู้ขอเบิก ${requester} เมื่อวันที่ ${formatThaiDate(issueDate)} เพื่อขออนุมัติ กรุณาตรวจสอบรายการและจำนวนสินค้าที่ ${appUrl}/approve\n\nอีเมลฉบับนี้ส่งโดยอัตโนมัติจากระบบ กรุณาไม่ตอบกลับอีเมลนี้`,
    });

    return NextResponse.json({ ok: true, id: result.messageId });
  } catch (error) {
    console.error("Failed to send approval email via SMTP:", error);
    return NextResponse.json(
      {
        error: "Failed to send approval email.",
        detail: error instanceof Error ? error.message : "Unknown SMTP error",
      },
      { status: 502 }
    );
  }
}
