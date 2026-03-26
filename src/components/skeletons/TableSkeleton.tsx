type TableSkeletonProps = {
  rows?: number;
  cols?: number;
};

export default function TableSkeleton({
  rows = 6,
  cols = 5,
}: TableSkeletonProps) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="tms-table">
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i}>
                  <div className="h-3 w-20 rounded bg-[color:var(--surface-2)] animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: cols }).map((_, j) => (
                  <td key={j}>
                    <div className="h-3 w-full rounded bg-[color:var(--surface-2)] animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}