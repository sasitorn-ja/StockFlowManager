import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/users";

export async function GET() {
  const user = await getCurrentUser();
  return user ? NextResponse.json({ user }) : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
