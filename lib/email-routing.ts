type EmailRecipient = {
  address: string;
  name?: string;
};

type EmailSimulationResult = {
  enabled: boolean;
  recipients: EmailRecipient[];
  originalRecipients: EmailRecipient[];
  summary: string;
};

const DEFAULT_SIMULATION_RECIPIENT = {
  address: "SASITOJA@SCG.COM",
  name: "ศศิธร จรุงจรรยาพงศ์",
};

function normalizeRecipient(recipient: EmailRecipient) {
  return {
    address: recipient.address.trim(),
    name: recipient.name?.trim() || recipient.address.trim(),
  };
}

export function resolveEmailRecipients(recipients: EmailRecipient[]): EmailSimulationResult {
  const originalRecipients = recipients
    .map(normalizeRecipient)
    .filter((recipient) => Boolean(recipient.address));

  const simulationDisabled = process.env.MAIL_SIMULATION_ENABLED?.trim().toLowerCase() === "false";
  const simulationAddress = simulationDisabled
    ? ""
    : process.env.MAIL_SIMULATION_TO_ADDRESS?.trim() || DEFAULT_SIMULATION_RECIPIENT.address;
  const simulationName = simulationDisabled
    ? ""
    : process.env.MAIL_SIMULATION_TO_NAME?.trim() || DEFAULT_SIMULATION_RECIPIENT.name;

  if (!simulationAddress) {
    return {
      enabled: false,
      recipients: originalRecipients,
      originalRecipients,
      summary: originalRecipients.map((recipient) => recipient.name || recipient.address).join(", "),
    };
  }

  const simulatedRecipient = {
    address: simulationAddress,
    name: simulationName || DEFAULT_SIMULATION_RECIPIENT.name,
  };

  return {
    enabled: true,
    recipients: [simulatedRecipient],
    originalRecipients,
    summary:
      originalRecipients.length > 0
        ? originalRecipients.map((recipient) => `${recipient.name} <${recipient.address}>`).join(", ")
        : "ไม่พบผู้รับปลายทางเดิม",
  };
}
