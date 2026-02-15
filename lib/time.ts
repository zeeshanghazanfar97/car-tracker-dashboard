import { z } from "zod";
import type { DateRange } from "@/lib/types";

const ISO_DATE = z.string().datetime();
const MAX_RANGE_MS = 7 * 24 * 60 * 60 * 1000;

export function parseDateRange(fromRaw: string | null, toRaw: string | null): DateRange {
  const toIso = toRaw ? ISO_DATE.parse(toRaw) : new Date().toISOString();
  const fromIso = fromRaw
    ? ISO_DATE.parse(fromRaw)
    : new Date(new Date(toIso).getTime() - 24 * 60 * 60 * 1000).toISOString();

  const from = new Date(fromIso);
  const to = new Date(toIso);

  if (to <= from) {
    throw new Error("Invalid date range: to must be greater than from");
  }

  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    throw new Error("Date range too large. Maximum allowed is 7 days.");
  }

  return { from, to };
}

export function secondsBetween(startIso: string, endIso: string): number {
  const sec = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000);
  return sec > 0 ? sec : 0;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return [hh, mm, ss].map((n) => String(n).padStart(2, "0")).join(":");
}

export function toIsoLocalInput(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

export function fromLocalInput(localValue: string): string {
  if (!localValue) return new Date().toISOString();
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}
