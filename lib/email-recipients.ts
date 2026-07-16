import { ensureSsoUsersSchema } from "@/lib/auth/users";
import { sql } from "@/lib/db";

export type EmailRecipient = {
  address: string;
  name: string;
};

function uniqueRecipients(recipients: EmailRecipient[]) {
  const seen = new Set<string>();
  return recipients.filter((recipient) => {
    const normalizedAddress = recipient.address.trim().toLowerCase();
    if (!normalizedAddress || seen.has(normalizedAddress)) return false;
    seen.add(normalizedAddress);
    return true;
  });
}

export async function getAdminEmailRecipients() {
  await ensureSsoUsersSchema();
  const users = await sql`
    SELECT DISTINCT email, display_name
    FROM users
    WHERE email IS NOT NULL AND email <> '' AND role = 'admin'
  `;

  return uniqueRecipients(
    users.map((user) => ({
      address: String(user.email || "").trim(),
      name: String(user.display_name || user.email || "ผู้ดูแลระบบ").trim(),
    }))
  );
}

export async function findUserEmailRecipient(displayName: string) {
  const normalizedName = displayName.trim();
  if (!normalizedName) return null;

  await ensureSsoUsersSchema();
  const users = await sql`
    SELECT email, display_name
    FROM users
    WHERE email IS NOT NULL AND email <> ''
      AND (display_name = ${normalizedName} OR sso_user_id = ${normalizedName} OR email = ${normalizedName})
    ORDER BY last_login_at DESC
    LIMIT 1
  `;
  const user = users[0];
  if (!user?.email) return null;

  return {
    address: String(user.email).trim(),
    name: String(user.display_name || normalizedName).trim(),
  } satisfies EmailRecipient;
}
