export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Organization</p>
        <h2 className="text-3xl font-semibold text-slate-900">Company settings</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Business profile</h3>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="flex justify-between"><span>Legal name</span><span className="font-medium text-slate-900">BharatGodam Foods</span></div>
            <div className="flex justify-between"><span>GSTIN</span><span className="font-medium text-slate-900">27ABCDE1234F1Z7</span></div>
            <div className="flex justify-between"><span>Currency</span><span className="font-medium text-slate-900">INR</span></div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Tax & numbering</h3>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="flex justify-between"><span>Financial year</span><span className="font-medium text-slate-900">2026-27</span></div>
            <div className="flex justify-between"><span>Invoice prefix</span><span className="font-medium text-slate-900">INV-</span></div>
            <div className="flex justify-between"><span>Sequence</span><span className="font-medium text-slate-900">1029</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
