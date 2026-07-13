"use client";

import { withBasePath } from "@/lib/base-path";
import { defaultAppSettings, type AppSettings } from "@/lib/app-settings-shared";
import type { ProductMaster } from "@/types/stock-flow";

type SessionUser = {
  email?: string;
  name?: string;
  role?: string;
  userId?: string;
};

type SessionResponse = {
  user?: SessionUser;
} | null;

let sessionPromise: Promise<SessionResponse> | null = null;
let settingsPromise: Promise<AppSettings> | null = null;
let masterProductsPromise: Promise<ProductMaster[]> | null = null;

export function getClientSession() {
  if (!sessionPromise) {
    sessionPromise = fetch(withBasePath("/api/auth/session"), { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
  }

  return sessionPromise;
}

export function getClientAppSettings() {
  if (!settingsPromise) {
    settingsPromise = fetch(withBasePath("/api/settings"), { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : defaultAppSettings))
      .then((settings) => ({ ...defaultAppSettings, ...settings }))
      .catch(() => defaultAppSettings);
  }

  return settingsPromise;
}

export function getClientMasterProducts() {
  if (!masterProductsPromise) {
    masterProductsPromise = fetch(withBasePath("/api/master-products"), { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((products) => (Array.isArray(products) ? (products as ProductMaster[]) : []))
      .catch(() => []);
  }

  return masterProductsPromise;
}

export function invalidateClientSessionCache() {
  sessionPromise = null;
}

export function invalidateClientAppSettingsCache() {
  settingsPromise = null;
}

export function invalidateClientMasterProductsCache() {
  masterProductsPromise = null;
}
