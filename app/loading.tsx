export default function RootLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading page content">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded-md bg-slate-200" />
          <div className="h-8 w-64 rounded-xl bg-slate-300" />
        </div>
        <div className="h-10 w-28 rounded-xl bg-slate-200" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="mt-4 h-6 w-32 rounded bg-slate-300" />
          </div>
        ))}
      </div>

      <div className="h-72 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-4 w-40 rounded bg-slate-200 mb-6" />
        <div className="h-48 w-full rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}
