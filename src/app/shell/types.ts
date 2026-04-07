import { ReactNode } from "react";

export type ClickNavItem = { label: string; icon?: ReactNode; badge?: number; onClick: () => void };
export type ElementNavItem = { label: string; icon?: ReactNode; badge?: number; element: ReactNode };
export type RouteNavItem = { label: string; icon?: ReactNode; badge?: number; path: string };
export type NavItem = ClickNavItem | ElementNavItem | RouteNavItem;

export function isElementItem(item: NavItem): item is ElementNavItem {
  return "element" in item;
}

export function isRouteItem(item: NavItem): item is RouteNavItem {
  return "path" in item;
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  corporate_approver: "Corporate Approver",
  finance_manager: "Finance Manager",
  transport_supervisor: "Transport Supervisor",
  driver: "Driver",
  unit_head: "Unit Head",
  staff: "Staff",
};

export const ROLE_COLORS: Record<string, string> = {
  admin: "bg-[color:var(--purple)]",
  corporate_approver: "bg-[color:var(--accent)]",
  finance_manager: "bg-[color:var(--green)]",
  transport_supervisor: "bg-[color:var(--green)]",
  driver: "bg-[color:var(--cyan)]",
  unit_head: "bg-[color:var(--amber)]",
  staff: "bg-[color:var(--text-muted)]",
};
