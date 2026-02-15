import { NextResponse } from "next/server";

export function badRequest(message: string, details?: unknown): NextResponse {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function internalError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function parsePlateList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
