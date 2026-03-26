export default function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-5 w-32 rounded bg-[color:var(--surface-2)]" />
          <div className="h-3 w-24 rounded bg-[color:var(--surface-2)]" />
        </div>
        <div className="h-9 w-24 rounded-xl bg-[color:var(--surface-2)]" />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat-card space-y-2">
            <div className="h-3 w-20 rounded bg-[color:var(--surface-2)]" />
            <div className="h-6 w-16 rounded bg-[color:var(--surface-2)]" />
          </div>
        ))}
      </div>

      {/* Secondary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="stat-card space-y-2">
            <div className="h-3 w-24 rounded bg-[color:var(--surface-2)]" />
            <div className="h-5 w-20 rounded bg-[color:var(--surface-2)]" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-3">
            <div className="h-4 w-32 rounded bg-[color:var(--surface-2)]" />
            <div className="h-24 w-full rounded-xl bg-[color:var(--surface-2)]" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card p-4 space-y-3">
        <div className="h-4 w-40 rounded bg-[color:var(--surface-2)]" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-full rounded-lg bg-[color:var(--surface-2)]" />
        ))}
      </div>

    </div>
  );
}