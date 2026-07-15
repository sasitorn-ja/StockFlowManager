type EmailRecipient = {
  address: string;
  name?: string;
};

type EmailRoutingResult = {
  recipients: EmailRecipient[];
  summary: string;
};

function normalizeRecipient(recipient: EmailRecipient) {
  return {
    address: recipient.address.trim(),
    name: recipient.name?.trim() || recipient.address.trim(),
  };
}

export function resolveEmailRecipients(recipients: EmailRecipient[]): EmailRoutingResult {
  const normalizedRecipients = recipients
    .map(normalizeRecipient)
    .filter((recipient) => Boolean(recipient.address));

  return {
    recipients: normalizedRecipients,
    summary:
      normalizedRecipients.length > 0
        ? normalizedRecipients.map((recipient) => `${recipient.name} <${recipient.address}>`).join(", ")
        : "ไม่พบผู้รับอีเมล",
  };
}
