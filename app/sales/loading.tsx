export default function SalesLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading sales section">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="h-3 w-28 rounded-md bg-slate-200" />
          <div className="h-8 w-48 rounded-xl bg-slate-300" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 rounded-xl bg-slate-200" />
          <div className="h-9 w-32 rounded-xl bg-slate-200" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="mt-3 h-6 w-28 rounded bg-slate-300" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-9 w-64 rounded-xl bg-slate-100" />
          <div className="h-9 w-32 rounded-xl bg-slate-100" />
        </div>
        <div className="space-y-3 pt-4">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="h-4 w-24 rounded bg-slate-100" />
              <div className="h-4 w-20 rounded bg-slate-200" />
              <div className="h-4 w-16 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
