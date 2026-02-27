import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function statusBadge(status: string) {
  return `badge badge-${status.toLowerCase().replace(/ /g, "_")}`;
}

export function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtMoney(n?: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(n);
}
