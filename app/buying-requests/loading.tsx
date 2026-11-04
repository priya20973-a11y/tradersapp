export default function BuyingRequestsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-56 rounded-xl bg-slate-200" />
          <div className="h-4 w-80 rounded-lg bg-slate-200" />
        </div>
        <div className="h-10 w-48 rounded-xl bg-slate-200" />
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-28 rounded-xl bg-slate-200" />
        ))}
      </div>

      <div className="h-16 rounded-2xl border border-slate-200 bg-white p-4" />

      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl border border-slate-200 bg-white p-5" />
        ))}
      </div>
    </div>
  );
}
