type CardListSkeletonProps = {
  count?: number;
  showHeaderMeta?: boolean;
  showExpandedPreview?: boolean;
};

export default function CardListSkeleton({
  count = 4,
  showHeaderMeta = true,
  showExpandedPreview = true,
}: CardListSkeletonProps) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "12px 16px" }}>
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-[color:var(--surface-2)]" />
                {showHeaderMeta && (
                  <div className="h-3 w-52 rounded bg-[color:var(--surface-2)]" />
                )}
              </div>
              <div className="h-5 w-16 rounded-full bg-[color:var(--surface-2)]" />
            </div>
          </div>

          {showExpandedPreview && (
            <div
              className="grid grid-cols-2 gap-2"
              style={{
                borderTop: "1px solid var(--border)",
                padding: "12px 16px",
              }}
            >
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="space-y-1">
                  <div className="h-2 w-16 rounded bg-[color:var(--surface-2)]" />
                  <div className="h-3 w-20 rounded bg-[color:var(--surface-2)]" />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}