export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Reports</p>
          <h2 className="text-3xl font-semibold text-slate-900">Profit & loss</h2>
        </div>
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Export CSV</button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Revenue</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">₹1,48,50,000</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Expenses</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">₹1,13,60,000</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Net profit</p>
          <p className="mt-3 text-2xl font-semibold text-emerald-600">₹34,90,000</p>
        </div>
      </div>
    </div>
  );
}
