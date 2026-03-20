// src/hooks/usePagination.ts
// Shared pagination hook – PAGE_SIZE = 10 rows per page
import { useMemo, useState } from "react";

export const PAGE_SIZE = 10;

export function usePagination<T>(items: T[]) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);

  const slice = useMemo(
    () => items.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [items, safePage]
  );

  const prev = () => setPage(p => Math.max(0, p - 1));
  const next = () => setPage(p => Math.min(totalPages - 1, p + 1));
  const reset = () => setPage(0);

  return {
    page: safePage,
    totalPages,
    slice,
    prev,
    next,
    reset,
    hasPrev: safePage > 0,
    hasNext: safePage < totalPages - 1,
    start: safePage * PAGE_SIZE + 1,
    end: Math.min(safePage * PAGE_SIZE + PAGE_SIZE, items.length),
    total: items.length,
  };
}

// ─── Pagination Bar UI component ─────────────────────────────────────────────
import React from "react";

export function PaginationBar({
  page, totalPages, hasPrev, hasNext, prev, next, start, end, total,
}: ReturnType<typeof usePagination<unknown>>) {
  if (total === 0 || totalPages <= 1) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 16px", borderTop: "1px solid var(--border)",
      fontSize: 12, color: "var(--text-muted)",
    }}>
      <span>{start}–{end} of {total}</span>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={prev}
          disabled={!hasPrev}
          style={{
            padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500,
            background: hasPrev ? "var(--surface-2)" : "transparent",
            border: "1px solid var(--border)",
            color: hasPrev ? "var(--text)" : "var(--text-dim)",
            cursor: hasPrev ? "pointer" : "not-allowed",
          }}
        >← Prev</button>
        <span style={{ padding: "4px 8px", color: "var(--text-muted)" }}>
          {page + 1} / {totalPages}
        </span>
        <button
          onClick={next}
          disabled={!hasNext}
          style={{
            padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500,
            background: hasNext ? "var(--surface-2)" : "transparent",
            border: "1px solid var(--border)",
            color: hasNext ? "var(--text)" : "var(--text-dim)",
            cursor: hasNext ? "pointer" : "not-allowed",
          }}
        >Next →</button>
      </div>
    </div>
  );
}