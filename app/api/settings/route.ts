import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/users";
import { defaultAppSettings, getAppSettings, saveAppSettings } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getAppSettings());
}

export async function PUT(request: Request) {
  const actor = await getCurrentUser();
  if (actor?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
  }
  return NextResponse.json(await saveAppSettings(body));
}

export async function DELETE() {
  const actor = await getCurrentUser();
  if (actor?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await saveAppSettings(defaultAppSettings));
}
