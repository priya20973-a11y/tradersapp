export default function FindBuyersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-xl bg-slate-200" />
          <div className="h-4 w-72 rounded-lg bg-slate-200" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-slate-200" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-slate-200 bg-white p-4" />
        ))}
      </div>

      <div className="h-28 rounded-2xl border border-slate-200 bg-white p-4" />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 rounded-2xl border border-slate-200 bg-white p-5" />
        ))}
      </div>
    </div>
  );
}
