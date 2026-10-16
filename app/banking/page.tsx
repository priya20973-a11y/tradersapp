export default function BankingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Banking</p>
          <h2 className="text-3xl font-semibold text-slate-900">Bank accounts & reconciliation</h2>
        </div>
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Add account</button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Bank balance</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">₹32,40,000</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Cash in hand</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">₹8,50,000</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Reconciled</p>
          <p className="mt-3 text-2xl font-semibold text-emerald-600">94.2%</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Balance</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
            <tr>
              <td className="px-4 py-3 font-medium text-slate-900">HDFC Current A/C</td>
              <td className="px-4 py-3">Bank</td>
              <td className="px-4 py-3">₹18,20,500</td>
              <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Matched</span></td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-medium text-slate-900">Cash Drawer</td>
              <td className="px-4 py-3">Cash</td>
              <td className="px-4 py-3">₹2,35,000</td>
              <td className="px-4 py-3"><span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">Open</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
