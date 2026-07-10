export type AppSettings = {
  lowStockThreshold: string;
  expiryWarningDays: string;
  issuePrefix: string;
  receivePrefix: string;
  approvalMode: "required" | "manager_only" | "off";
  allocationMode: "fefo" | "fifo";
  requireEmployeeConfirmation: boolean;
  allowNegativeStock: boolean;
};

export const defaultAppSettings: AppSettings = {
  lowStockThreshold: "5",
  expiryWarningDays: "90",
  issuePrefix: "REQ",
  receivePrefix: "IN",
  approvalMode: "required",
  allocationMode: "fefo",
  requireEmployeeConfirmation: true,
  allowNegativeStock: false,
};

export function normalizeAppSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  const settings = { ...defaultAppSettings, ...(value || {}) };
  const approvalMode = ["required", "manager_only", "off"].includes(settings.approvalMode)
    ? settings.approvalMode
    : defaultAppSettings.approvalMode;
  const allocationMode = settings.allocationMode === "fifo" ? "fifo" : "fefo";

  return {
    lowStockThreshold: String(Math.max(0, Math.floor(Number(settings.lowStockThreshold || 0)))),
    expiryWarningDays: String(Math.max(1, Math.floor(Number(settings.expiryWarningDays || 1)))),
    issuePrefix: String(settings.issuePrefix || defaultAppSettings.issuePrefix).trim().toUpperCase() || defaultAppSettings.issuePrefix,
    receivePrefix: String(settings.receivePrefix || defaultAppSettings.receivePrefix).trim().toUpperCase() || defaultAppSettings.receivePrefix,
    approvalMode,
    allocationMode,
    requireEmployeeConfirmation: settings.requireEmployeeConfirmation !== false,
    allowNegativeStock: settings.allowNegativeStock === true,
  };
}
