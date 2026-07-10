import { sql } from "@/lib/db";
import { defaultAppSettings, normalizeAppSettings, type AppSettings } from "@/lib/app-settings-shared";

export { defaultAppSettings, type AppSettings } from "@/lib/app-settings-shared";

const SETTINGS_KEY = "global";

let settingsTableSetup: Promise<void> | null = null;

async function ensureSettingsTable() {
  if (settingsTableSetup) return settingsTableSetup;

  settingsTableSetup = sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      id VARCHAR(50) PRIMARY KEY,
      settings JSON NOT NULL,
      updated_at BIGINT
    )
  `.then(() => undefined).catch((error) => {
    settingsTableSetup = null;
    throw error;
  });

  return settingsTableSetup;
}

export async function getAppSettings(): Promise<AppSettings> {
  await ensureSettingsTable();
  const rows = await sql`SELECT settings FROM app_settings WHERE id = ${SETTINGS_KEY} LIMIT 1`;
  if (!rows[0]?.settings) return defaultAppSettings;

  try {
    const raw = typeof rows[0].settings === "string" ? JSON.parse(rows[0].settings) : rows[0].settings;
    return normalizeAppSettings(raw);
  } catch {
    return defaultAppSettings;
  }
}

export async function saveAppSettings(nextSettings: Partial<AppSettings>) {
  await ensureSettingsTable();
  const settings = normalizeAppSettings(nextSettings);
  await sql`
    INSERT INTO app_settings (id, settings, updated_at)
    VALUES (${SETTINGS_KEY}, ${JSON.stringify(settings)}, ${Date.now()})
    ON DUPLICATE KEY UPDATE settings = VALUES(settings), updated_at = VALUES(updated_at)
  `;
  return settings;
}
