// src/hooks/usePagination.ts
// Pagination hook + PaginationBar component used across all TMS tables
import { useState, useMemo, useEffect } from "react";

const PAGE_SIZE = 10;

export function usePagination<T>(items: T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever items change
  useEffect(() => { setPage(1); }, [items.length]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage   = Math.min(page, totalPages);

  const slice = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  return {
    page:       safePage,
    totalPages,
    slice,
    total:      items.length,
    start:      items.length === 0 ? 0 : (safePage - 1) * pageSize + 1,
    end:        Math.min(safePage * pageSize, items.length),
    hasPrev:    safePage > 1,
    hasNext:    safePage < totalPages,
    prev:       () => setPage(p => Math.max(1, p - 1)),
    next:       () => setPage(p => Math.min(totalPages, p + 1)),
    reset:      () => setPage(1),
    goTo:       (n: number) => setPage(Math.max(1, Math.min(totalPages, n))),
  };
}

// ── PaginationBar component ───────────────────────────────────────────────────
type PaginationProps = ReturnType<typeof usePagination>;

export function PaginationBar({
  page, totalPages, total, start, end,
  hasPrev, hasNext, prev, next,
}: PaginationProps) {
  if (total === 0 || totalPages <= 1) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 16px", borderTop: "1px solid var(--border)",
      background: "var(--surface)",
    }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {start}–{end} of {total}
      </span>
      <div style={{ display: "flex", gap: 4 }}>
        <button
          onClick={prev}
          disabled={!hasPrev}
          className="btn btn-ghost btn-sm"
          style={{ minWidth: 32, opacity: hasPrev ? 1 : 0.35 }}
        >
          ←
        </button>
        <span style={{
          fontSize: 12, color: "var(--text-muted)", padding: "0 8px",
          display: "flex", alignItems: "center",
        }}>
          {page} / {totalPages}
        </span>
        <button
          onClick={next}
          disabled={!hasNext}
          className="btn btn-ghost btn-sm"
          style={{ minWidth: 32, opacity: hasNext ? 1 : 0.35 }}
        >
          →
        </button>
      </div>
    </div>
  );
}