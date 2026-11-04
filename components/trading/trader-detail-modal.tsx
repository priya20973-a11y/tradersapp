"use client";

import { X } from "lucide-react";
import { type TraderDetail, money } from "./trader-types";

interface TraderDetailModalProps {
  detailLoading: boolean;
  detail: TraderDetail | null;
  onClose: () => void;
  profileEditing: boolean;
  setProfileEditing: React.Dispatch<React.SetStateAction<boolean>>;
  profileForm: {
    legalBusinessName: string;
    tradeName: string;
    gstin: string;
    pan: string;
    commodities: string;
    city: string;
    state: string;
  };
  setProfileForm: React.Dispatch<
    React.SetStateAction<{
      legalBusinessName: string;
      tradeName: string;
      gstin: string;
      pan: string;
      commodities: string;
      city: string;
      state: string;
    }>
  >;
  traderAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  inputClass: string;
  labelClass: string;
  buttonClass: string;
}

export function TraderDetailModal({
  detailLoading,
  detail,
  onClose,
  profileEditing,
  setProfileEditing,
  profileForm,
  setProfileForm,
  traderAction,
  inputClass,
  labelClass,
  buttonClass,
}: TraderDetailModalProps) {
  const primaryBtnClass =
    buttonClass ||
    "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition";

  if (!detailLoading && !detail) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:p-8"
      onClick={onClose}
    >
      {detailLoading ? (
        <div className="my-24 rounded-xl bg-white p-8">Loading trader…</div>
      ) : detail && (
        <section
          className="my-auto w-full max-w-3xl space-y-5 rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {detail.traderCode} · {detail.roles?.join(", ")}
              </p>
              <h2 className="mt-1 text-2xl font-semibold">{detail.legalBusinessName}</h2>
              <p className="text-sm text-slate-500">{detail.tradeName}</p>
            </div>
            <button type="button" aria-label="Close" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-emerald-700 hover:underline"
            onClick={() => {
              setProfileForm({
                legalBusinessName: detail.legalBusinessName,
                tradeName: String(detail.tradeName || ""),
                gstin: String(detail.gstin || ""),
                pan: String(detail.pan || ""),
                commodities: detail.mainCommodities?.join(", ") || "",
                city: detail.billingAddress?.city || "",
                state: detail.billingAddress?.state || "",
              });
              setProfileEditing((value) => !value);
            }}
          >
            {profileEditing ? "Cancel profile edit" : "Edit trader profile"}
          </button>
          {profileEditing && (
            <form
              className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void traderAction("update-profile", {
                  legalBusinessName: profileForm.legalBusinessName,
                  tradeName: profileForm.tradeName,
                  gstin: profileForm.gstin,
                  pan: profileForm.pan,
                  mainCommodities: profileForm.commodities
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                  billingAddress: {
                    ...detail.billingAddress,
                    city: profileForm.city,
                    state: profileForm.state,
                  },
                });
                setProfileEditing(false);
              }}
            >
              {(
                [
                  ["legalBusinessName", "Legal business name"],
                  ["tradeName", "Trade name"],
                  ["gstin", "GSTIN"],
                  ["pan", "PAN"],
                  ["commodities", "Commodities (comma separated)"],
                  ["city", "City"],
                  ["state", "State"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <span className={labelClass}>{label}</span>
                  <input
                    required={key === "legalBusinessName"}
                    className={inputClass}
                    value={profileForm[key]}
                    onChange={(event) =>
                      setProfileForm({ ...profileForm, [key]: event.target.value })
                    }
                  />
                </label>
              ))}
              <button type="submit" className={primaryBtnClass}>
                Save profile
              </button>
            </form>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Receivable</p>
              <p className="mt-1 font-semibold">{money(detail.receivable)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Credit limit</p>
              <p className="mt-1 font-semibold">{money(detail.creditLimit)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">KYC / Trading</p>
              <p className="mt-1 font-semibold">
                {detail.kycStatus} / {detail.tradingStatus}
              </p>
            </div>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <p>
              <span className="text-slate-500">GSTIN:</span> {String(detail.gstin || "—")}
            </p>
            <p>
              <span className="text-slate-500">PAN:</span> {String(detail.pan || "—")}
            </p>
            <p>
              <span className="text-slate-500">Commodities:</span>{" "}
              {detail.mainCommodities?.join(", ") || "—"}
            </p>
            <p>
              <span className="text-slate-500">Location:</span>{" "}
              {[detail.billingAddress?.city, detail.billingAddress?.state]
                .filter(Boolean)
                .join(", ") || "—"}
            </p>
            <p>
              <span className="text-slate-500">Contact:</span>{" "}
              {detail.contacts?.[0]?.name || "—"} {detail.contacts?.[0]?.mobile || ""}
            </p>
            <p>
              <span className="text-slate-500">Credit approval:</span>{" "}
              {String(detail.creditApprovalStatus || "Pending")}
            </p>
          </div>
          {detail.bankAccounts?.length ? (
            <div className="space-y-2">
              <h3 className="font-medium">Bank accounts</h3>
              {detail.bankAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {account.bankName} · {account.maskedAccountNumber} ·{" "}
                    {account.verificationStatus}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-red-700 hover:underline"
                    onClick={() => {
                      if (window.confirm("Remove this bank account?"))
                        void traderAction("remove-bank-account", { accountId: account.id });
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Trading status</h3>
              <div className="flex gap-2">
                <select
                  id="trader-status"
                  className={inputClass}
                  defaultValue={detail.tradingStatus}
                >
                  {["Active", "Inactive", "Blocked"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className={primaryBtnClass}
                  onClick={() =>
                    void traderAction("set-status", {
                      status: (document.getElementById("trader-status") as HTMLSelectElement).value,
                    })
                  }
                >
                  Save
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">KYC review</h3>
              <div className="flex gap-2">
                <select id="trader-kyc" className={inputClass} defaultValue={String(detail.kycStatus)}>
                  {["Pending", "Approved", "Rejected"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className={primaryBtnClass}
                  onClick={() =>
                    void traderAction("review-kyc", {
                      status: (document.getElementById("trader-kyc") as HTMLSelectElement).value,
                    })
                  }
                >
                  Review
                </button>
              </div>
            </div>
          </div>
          <form
            className="grid gap-3 border-t pt-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void traderAction("approve-credit", {
                status: data.get("creditApproval"),
                creditLimit: data.get("creditLimit"),
                reason: data.get("creditReason"),
              });
            }}
          >
            <h3 className="text-sm font-semibold sm:col-span-2">Credit approval</h3>
            <label>
              <span className={labelClass}>Approval status</span>
              <select
                name="creditApproval"
                defaultValue={String(detail.creditApprovalStatus || "Approved")}
                className={inputClass}
              >
                {["Approved", "Rejected", "On Hold"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Credit limit (₹)</span>
              <input
                name="creditLimit"
                type="number"
                min="0"
                required
                defaultValue={detail.creditLimit}
                className={inputClass}
              />
            </label>
            <label className="sm:col-span-2">
              <span className={labelClass}>Reason / hold note</span>
              <input
                name="creditReason"
                className={inputClass}
                defaultValue={String(detail.creditHoldReason || "")}
              />
            </label>
            <button className={primaryBtnClass} type="submit">
              Save credit decision
            </button>
          </form>
          <form
            className="grid gap-3 border-t pt-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void traderAction("add-bank-account", {
                accountHolderName: data.get("holder"),
                bankName: data.get("bank"),
                accountNumber: data.get("account"),
                ifscCode: data.get("ifsc"),
              });
              event.currentTarget.reset();
            }}
          >
            <h3 className="text-sm font-semibold sm:col-span-2">
              Add bank account <span className="font-normal text-slate-500">(encrypted before storage)</span>
            </h3>
            <label>
              <span className={labelClass}>Account holder</span>
              <input required name="holder" className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Bank</span>
              <input required name="bank" className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Account number</span>
              <input required name="account" autoComplete="off" className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>IFSC</span>
              <input name="ifsc" className={inputClass} />
            </label>
            <button type="submit" className={primaryBtnClass}>
              Add bank details
            </button>
          </form>
          <div className="flex justify-end border-t pt-3">
            <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
