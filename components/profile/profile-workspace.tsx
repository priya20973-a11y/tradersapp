"use client";

import Image from "next/image";
import { useEffect, useState, useRef, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Upload,
  User,
  X,
} from "lucide-react";
import {
  INDIAN_STATES,
  PAN_REGEX,
  GSTIN_REGEX,
  IFSC_REGEX,
  formatAadhaarDisplay,
  maskAadhaar,
  maskAccountNumber,
  sanitizeAadhaar,
} from "@/lib/indian-states";
import { getFinancialYear } from "@/lib/financial-year";

interface BankDetails {
  accountHolderName?: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
  branch?: string;
}

interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  organizationName: string;
  tradeName?: string;
  status: string;
  currency?: string;
  financialYear?: string;
  pan: string;
  aadhaar: string;
  gstin: string;
  logo: string;
  address: string;
  city?: string;
  state: string;
  pincode?: string;
  country?: string;
  bankDetails: BankDetails;
  mustChangePassword?: boolean;
  createdAt: string;
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10";

export function ProfileWorkspace() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form edit states (all editable)
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editOrgName, setEditOrgName] = useState("");
  const [editTradeName, setEditTradeName] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [editCurrency, setEditCurrency] = useState("INR");
  const [editFinancialYear, setEditFinancialYear] = useState(() => getFinancialYear());
  const [editPan, setEditPan] = useState("");
  const [editAadhaar, setEditAadhaar] = useState("");
  const [editGstin, setEditGstin] = useState("");
  const [editLogo, setEditLogo] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editPincode, setEditPincode] = useState("");
  const [editCountry, setEditCountry] = useState("India");
  const [editHolderName, setEditHolderName] = useState("");
  const [editAccNumber, setEditAccNumber] = useState("");
  const [editIfsc, setEditIfsc] = useState("");
  const [editBankName, setEditBankName] = useState("");
  const [editBranch, setEditBranch] = useState("");

  // Masking toggles
  const [showAadhaarRaw, setShowAadhaarRaw] = useState(false);
  const [showAccountRaw, setShowAccountRaw] = useState(false);

  // File drag & drop
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        setLoading(true);
        const res = await fetch("/api/profile");
        const data = await res.json();
        if (!active) return;
        if (data.ok && data.profile) {
          setProfile(data.profile);
          initFormState(data.profile);
        }
      } catch {
        if (active) {
          setStatusMessage({ text: "Unable to load profile data.", type: "error" });
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadProfile();
    return () => {
      active = false;
    };
  }, [refreshIndex]);

  function initFormState(p: ProfileData) {
    setEditName(p.name || "");
    setEditEmail(p.email || "");
    setEditPhone(p.phone || "");
    setEditRole(p.role || "Organization Owner");
    setEditOrgName(p.organizationName || "");
    setEditTradeName(p.tradeName || "");
    setEditStatus(p.status || "active");
    setEditCurrency(p.currency || "INR");
    setEditFinancialYear(p.financialYear || getFinancialYear());
    setEditPan(p.pan || "");
    setEditAadhaar(p.aadhaar || "");
    setEditGstin(p.gstin || "");
    setEditLogo(p.logo || "");
    setEditAddress(p.address || "");
    setEditCity(p.city || "");
    setEditState(p.state || "");
    setEditPincode(p.pincode || "");
    setEditCountry(p.country || "India");
    setEditHolderName(p.bankDetails?.accountHolderName || "");
    setEditAccNumber(p.bankDetails?.accountNumber || "");
    setEditIfsc(p.bankDetails?.ifsc || "");
    setEditBankName(p.bankDetails?.bankName || "");
    setEditBranch(p.bankDetails?.branch || "");
  }

  const handleStartEdit = (_section: string = "all") => {
    if (profile) initFormState(profile);
    setIsEditing(true);
    setStatusMessage(null);
  };

  const handleCancelEdit = () => {
    if (profile) initFormState(profile);
    setIsEditing(false);
    setStatusMessage(null);
  };

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleLogoUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setStatusMessage({ text: "Please upload an image file (PNG, JPG, SVG, WEBP).", type: "error" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({ text: "Logo size must be under 5MB.", type: "error" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setEditLogo(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleLogoUpload(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    // Format validation if provided
    if (editPan && !PAN_REGEX.test(editPan.toUpperCase())) {
      setStatusMessage({ text: "Invalid PAN format. Must be 10 characters (e.g. ABCDE1234F).", type: "error" });
      return;
    }
    if (editAadhaar && sanitizeAadhaar(editAadhaar).length !== 12) {
      setStatusMessage({ text: "Invalid Aadhaar format. Must be 12 digits.", type: "error" });
      return;
    }
    if (editGstin && !GSTIN_REGEX.test(editGstin.toUpperCase())) {
      setStatusMessage({ text: "Invalid GSTIN format. Must be 15 characters (e.g. 27ABCDE1234F1Z5).", type: "error" });
      return;
    }
    if (editIfsc && !IFSC_REGEX.test(editIfsc.toUpperCase())) {
      setStatusMessage({ text: "Invalid IFSC Code format (e.g. HDFC0001234).", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: editName,
        email: editEmail,
        phone: editPhone,
        role: editRole,
        organizationName: editOrgName,
        tradeName: editTradeName,
        status: editStatus,
        currency: editCurrency,
        financialYear: editFinancialYear,
        pan: editPan.toUpperCase(),
        aadhaar: editAadhaar ? sanitizeAadhaar(editAadhaar) : "",
        gstin: editGstin.toUpperCase(),
        logo: editLogo,
        address: editAddress,
        city: editCity,
        state: editState,
        pincode: editPincode,
        country: editCountry,
        bankDetails: {
          accountHolderName: editHolderName,
          accountNumber: editAccNumber,
          ifsc: editIfsc.toUpperCase(),
          bankName: editBankName,
          branch: editBranch,
        },
      };

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatusMessage({ text: data.error || "Failed to update profile.", type: "error" });
        return;
      }

      setProfile(data.profile);
      setIsEditing(false);
      setStatusMessage({ text: "All details updated successfully!", type: "success" });
    } catch {
      setStatusMessage({ text: "An error occurred while saving profile.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (!currentPassword) {
      setPasswordStatus({ text: "Please enter your current password.", type: "error" });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordStatus({ text: "New password must be at least 8 characters long.", type: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ text: "New password and confirmation do not match.", type: "error" });
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordStatus({ text: "New password cannot be the same as your current password.", type: "error" });
      return;
    }

    setPasswordSubmitting(true);
    try {
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordStatus({ text: data.error || "Failed to change password.", type: "error" });
        return;
      }

      // Clear all fields on success
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setPasswordStatus({
        text: data.message || "Password changed successfully! Redirecting to sign in...",
        type: "success",
      });

      if (profile) {
        setProfile({ ...profile, mustChangePassword: false });
      }

      if (data.requireReauth) {
        setTimeout(async () => {
          const { signOut } = await import("next-auth/react");
          await signOut({ callbackUrl: "/signin?message=password-changed" });
        }, 1800);
      }
    } catch {
      setPasswordStatus({ text: "An error occurred while changing password. Please try again.", type: "error" });
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleCancelPasswordChange = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordStatus(null);
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-sm font-medium">Loading profile details...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800">
        <p className="font-semibold">Unable to load profile</p>
        <button
          onClick={() => setRefreshIndex((v) => v + 1)}
          className="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Top Banner / Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Account</span>
            <span>/</span>
            <span className="text-emerald-700 font-bold">Profile & Organization</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {profile.organizationName || "My Profile"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View and edit all your personal, company, branding, statutory KYC, and banking details.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/settings/preferences/items"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            Preferences
          </Link>
          <a
            href="#change-password-section"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <KeyRound className="h-4 w-4 text-emerald-600" />
            Security
          </a>
          {!isEditing && (
            <button
              onClick={() => handleStartEdit("all")}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
            >
              <Edit3 className="h-4 w-4" />
              Edit All Details
            </button>
          )}
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`flex items-center justify-between rounded-xl p-4 text-sm font-medium ${
            statusMessage.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="rounded p-1 hover:bg-slate-200/50">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Temporary Password Alert Banner */}
      {profile.mustChangePassword && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm flex items-start gap-3">
          <div className="rounded-lg bg-amber-100 p-2 text-amber-800">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Action Required: Temporary Password Detected</h3>
            <p className="text-xs text-amber-800 mt-0.5">
              An administrator recently reset your password. For your security, please update your personal password below.
            </p>
          </div>
        </div>
      )}

      {/* VIEW MODE */}
      {!isEditing ? (
        <div className="space-y-6">
          {/* Main Organization Hero Card */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                {/* Logo */}
                <div className="relative group flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-100 bg-slate-50 overflow-hidden shadow-inner">
                  {profile.logo ? (
                    <Image
                      src={profile.logo}
                      alt={profile.organizationName}
                      width={96}
                      height={96}
                      unoptimized
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <span className="text-4xl font-bold text-emerald-700">
                      {profile.organizationName?.charAt(0) || profile.name?.charAt(0) || "L"}
                    </span>
                  )}
                  <button
                    onClick={() => handleStartEdit("branding")}
                    className="absolute inset-0 bg-slate-900/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs font-semibold"
                  >
                    <Edit3 className="h-4 w-4 mb-1" />
                    Change
                  </button>
                </div>

                {/* Identity Info */}
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-2xl font-bold text-slate-900">{profile.organizationName}</h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        profile.status === "active"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {profile.status === "active" ? "Active" : profile.status || "Pending Approval"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                      {profile.role}
                    </span>
                  </div>
                  {profile.tradeName && (
                    <p className="text-sm font-medium text-slate-600">Trade Name: {profile.tradeName}</p>
                  )}
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      {profile.name}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      {profile.email}
                    </span>
                    {profile.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {profile.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleStartEdit("company")}
                className="self-start inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 border border-emerald-200 bg-emerald-50/50 rounded-lg px-3 py-1.5 transition"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit Company
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Card 1: Personal & Account Details */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <User className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">Personal & Account Details</h3>
                </div>
                <button
                  onClick={() => handleStartEdit("personal")}
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Edit
                </button>
              </div>
              <dl className="space-y-3.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Full Name</dt>
                  <dd className="font-semibold text-slate-900">{profile.name}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Email Address</dt>
                  <dd className="font-mono text-xs font-medium text-slate-900">{profile.email}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Mobile / Phone</dt>
                  <dd className="font-medium text-slate-900">
                    {profile.phone || <span className="text-slate-400 italic">Not set</span>}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Role / Designation</dt>
                  <dd className="font-medium text-slate-900">{profile.role}</dd>
                </div>
              </dl>
            </div>

            {/* Card 2: Company & Financial Profile */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">Company & Financial Info</h3>
                </div>
                <button
                  onClick={() => handleStartEdit("company")}
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Edit
                </button>
              </div>
              <dl className="space-y-3.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Organization Name</dt>
                  <dd className="font-semibold text-slate-900">{profile.organizationName}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Trade / Legal Name</dt>
                  <dd className="font-medium text-slate-900">
                    {profile.tradeName || <span className="text-slate-400 italic">Not set</span>}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Financial Year</dt>
                  <dd className="font-semibold text-slate-900">{profile.financialYear || getFinancialYear()}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Base Currency</dt>
                  <dd className="font-semibold text-slate-900">{profile.currency || "INR"}</dd>
                </div>
              </dl>
            </div>

            {/* Card 3: Statutory & KYC Identification */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">Statutory & KYC Documents</h3>
                </div>
                <button
                  onClick={() => handleStartEdit("kyc")}
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Edit
                </button>
              </div>
              <dl className="space-y-3.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">PAN Number</dt>
                  <dd className="flex items-center gap-2 font-mono font-semibold text-slate-900">
                    {profile.pan ? (
                      <>
                        <span>{profile.pan}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(profile.pan, "pan")}
                          className="text-slate-400 hover:text-slate-600 p-1"
                          title="Copy PAN"
                        >
                          {copiedKey === "pan" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-400 font-sans italic">Not provided</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Aadhaar Number</dt>
                  <dd className="flex items-center gap-2 font-mono font-semibold text-slate-900">
                    {profile.aadhaar ? (
                      <>
                        <span>{showAadhaarRaw ? formatAadhaarDisplay(profile.aadhaar) : maskAadhaar(profile.aadhaar)}</span>
                        <button
                          type="button"
                          onClick={() => setShowAadhaarRaw((v) => !v)}
                          className="text-slate-400 hover:text-slate-600 p-1"
                          title={showAadhaarRaw ? "Hide" : "Reveal"}
                        >
                          {showAadhaarRaw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-400 font-sans italic">Not provided</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">GSTIN</dt>
                  <dd className="flex items-center gap-2 font-mono font-semibold text-slate-900">
                    {profile.gstin ? (
                      <>
                        <span>{profile.gstin}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(profile.gstin, "gstin")}
                          className="text-slate-400 hover:text-slate-600 p-1"
                          title="Copy GSTIN"
                        >
                          {copiedKey === "gstin" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-400 font-sans italic">Not provided</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Card 4: Registered Address & Location */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">Registered Office & Jurisdiction</h3>
                </div>
                <button
                  onClick={() => handleStartEdit("address")}
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Edit
                </button>
              </div>
              <dl className="space-y-3.5 text-sm">
                <div>
                  <dt className="text-slate-500">Street Address</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {profile.address || <span className="text-slate-400 italic">Not set</span>}
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-slate-500">City</dt>
                    <dd className="font-medium text-slate-900">{profile.city || <span className="text-slate-400 italic">Not set</span>}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Pincode</dt>
                    <dd className="font-mono font-medium text-slate-900">{profile.pincode || <span className="text-slate-400 italic">Not set</span>}</dd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">State / Union Territory</dt>
                  <dd className="font-semibold text-slate-900">
                    {profile.state || <span className="text-slate-400 italic">Not set</span>}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Country</dt>
                  <dd className="font-semibold text-slate-900">{profile.country || "India"}</dd>
                </div>
              </dl>
            </div>

            {/* Card 5: Settlement Bank Account */}
            <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Landmark className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">Settlement Bank Account</h3>
                </div>
                <button
                  onClick={() => handleStartEdit("banking")}
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Edit
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Account Holder Name</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {profile.bankDetails?.accountHolderName || <span className="text-slate-400 italic">Not set</span>}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Account Number</p>
                  <div className="mt-1 flex items-center gap-2 font-mono font-semibold text-slate-900">
                    {profile.bankDetails?.accountNumber ? (
                      <>
                        <span>
                          {showAccountRaw
                            ? profile.bankDetails.accountNumber
                            : maskAccountNumber(profile.bankDetails.accountNumber)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAccountRaw((v) => !v)}
                          className="text-slate-400 hover:text-slate-600 p-1"
                          title={showAccountRaw ? "Hide" : "Reveal"}
                        >
                          {showAccountRaw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(profile.bankDetails?.accountNumber || "", "acc")}
                          className="text-slate-400 hover:text-slate-600 p-1"
                          title="Copy Account Number"
                        >
                          {copiedKey === "acc" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-400 font-sans italic">Not set</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">IFSC Code</p>
                  <p className="mt-1 font-mono font-semibold text-slate-900">
                    {profile.bankDetails?.ifsc || <span className="text-slate-400 font-sans italic">Not set</span>}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Bank Name</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {profile.bankDetails?.bankName || <span className="text-slate-400 italic">Not set</span>}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-slate-500 text-xs">Branch Name</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {profile.bankDetails?.branch || <span className="text-slate-400 italic">Not set</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Card 6: Change Password */}
            <div id="change-password-section" className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Change Password</h3>
                    <p className="text-xs text-slate-500">Update your personal password to keep your BharatGodam account secure.</p>
                  </div>
                </div>
              </div>

              {passwordStatus && (
                <div
                  className={`mb-4 flex items-center justify-between rounded-xl p-3.5 text-sm font-medium ${
                    passwordStatus.type === "success"
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {passwordStatus.type === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    <span>{passwordStatus.text}</span>
                  </div>
                  <button type="button" onClick={() => setPasswordStatus(null)} className="rounded p-1 hover:bg-slate-200/50">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                    Current Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      autoComplete="current-password"
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white pl-3.5 pr-10 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      title={showCurrentPassword ? "Hide password" : "Show password"}
                      aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                      New Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        className="w-full rounded-xl border border-slate-200 bg-white pl-3.5 pr-10 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        title={showNewPassword ? "Hide password" : "Show password"}
                        aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                      Confirm New Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type new password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        className="w-full rounded-xl border border-slate-200 bg-white pl-3.5 pr-10 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        title={showConfirmPassword ? "Hide password" : "Show password"}
                        aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  Password must be at least 8 characters long and cannot be identical to your current password.
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={passwordSubmitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-60"
                  >
                    <KeyRound className="h-4 w-4" />
                    {passwordSubmitting ? "Changing Password..." : "Change Password"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelPasswordChange}
                    disabled={passwordSubmitting}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : (
        /* EDIT ALL DETAILS FORM MODE */
        <form onSubmit={handleSave} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Edit Profile & Organization Details</h2>
              <p className="text-sm text-slate-500">Every detail can be edited and saved to your account in real-time.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Section 1: Personal & Contact */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
              <User className="h-4 w-4 text-emerald-600" />
              1. Personal & Contact Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  className={inputClass}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Suresh Agarwal"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  className={inputClass}
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile / Phone Number</label>
                <input
                  className={inputClass}
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role / Designation</label>
                <input
                  className={inputClass}
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  placeholder="Organization Owner / Director"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Company & Branding */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
              <Building2 className="h-4 w-4 text-emerald-600" />
              2. Company Identity & Branding
            </div>

            {/* Company Logo Upload & Preview */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Company Logo</label>
              {editLogo ? (
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-4">
                    <Image
                      src={editLogo}
                      alt="Logo preview"
                      width={64}
                      height={64}
                      unoptimized
                      className="h-16 w-16 rounded-xl object-contain bg-white border border-slate-200 p-1"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Active Company Logo</p>
                      <p className="text-xs text-slate-500">Displayed on company headers, invoices, and documents.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Replace Logo
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditLogo("")}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${
                    isDragging ? "border-emerald-500 bg-emerald-50" : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    <span className="text-emerald-700">Click to upload</span> or drag and drop logo
                  </p>
                  <p className="text-xs text-slate-400">PNG, JPG, SVG or WEBP up to 5MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Organization Name</label>
                <input
                  className={inputClass}
                  value={editOrgName}
                  onChange={(e) => setEditOrgName(e.target.value)}
                  placeholder="e.g. BharatGodam Foods Ltd"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Trade / Legal Name</label>
                <input
                  className={inputClass}
                  value={editTradeName}
                  onChange={(e) => setEditTradeName(e.target.value)}
                  placeholder="e.g. BharatGodam Foods"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Financial Year</label>
                <input
                  className={inputClass}
                  value={editFinancialYear}
                  onChange={(e) => setEditFinancialYear(e.target.value)}
                  placeholder={getFinancialYear()}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Base Currency</label>
                <select
                  className={`${inputClass} cursor-pointer`}
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                >
                  <option value="INR">INR (₹ Indian Rupee)</option>
                  <option value="USD">USD ($ US Dollar)</option>
                  <option value="EUR">EUR (€ Euro)</option>
                  <option value="AED">AED (د.إ UAE Dirham)</option>
                  <option value="GBP">GBP (£ British Pound)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Statutory & KYC Documents */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              3. Statutory & Identification (PAN, Aadhaar, GSTIN)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">PAN Number</label>
                <input
                  className={`${inputClass} uppercase font-mono`}
                  value={editPan}
                  onChange={(e) => setEditPan(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Aadhaar Number</label>
                <input
                  className={`${inputClass} font-mono`}
                  value={formatAadhaarDisplay(editAadhaar)}
                  onChange={(e) => setEditAadhaar(sanitizeAadhaar(e.target.value).slice(0, 12))}
                  placeholder="1234 5678 9012"
                  maxLength={14}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN</label>
                <input
                  className={`${inputClass} uppercase font-mono`}
                  value={editGstin}
                  onChange={(e) => setEditGstin(e.target.value.toUpperCase().slice(0, 15))}
                  placeholder="27ABCDE1234F1Z5"
                  maxLength={15}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Registered Address & Location */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
              <MapPin className="h-4 w-4 text-emerald-600" />
              4. Registered Office & Jurisdiction
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address</label>
                <input
                  className={inputClass}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Plot 42, Sector 18, APMC Market"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                <input
                  className={inputClass}
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  placeholder="Navi Mumbai"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">State / Union Territory</label>
                <select
                  className={`${inputClass} cursor-pointer`}
                  value={editState}
                  onChange={(e) => setEditState(e.target.value)}
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pincode / Postal Code</label>
                <input
                  className={`${inputClass} font-mono`}
                  value={editPincode}
                  onChange={(e) => setEditPincode(e.target.value.slice(0, 10))}
                  placeholder="400703"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
                <input
                  className={inputClass}
                  value={editCountry}
                  onChange={(e) => setEditCountry(e.target.value)}
                  placeholder="India"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Settlement Bank Details */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
              <Landmark className="h-4 w-4 text-emerald-600" />
              5. Settlement Bank Account Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Holder Name</label>
                <input
                  className={inputClass}
                  value={editHolderName}
                  onChange={(e) => setEditHolderName(e.target.value)}
                  placeholder="BharatGodam Foods Ltd"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Number</label>
                <input
                  className={`${inputClass} font-mono`}
                  value={editAccNumber}
                  onChange={(e) => setEditAccNumber(e.target.value)}
                  placeholder="50200012345678"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">IFSC Code</label>
                <input
                  className={`${inputClass} uppercase font-mono`}
                  value={editIfsc}
                  onChange={(e) => setEditIfsc(e.target.value.toUpperCase().slice(0, 11))}
                  placeholder="HDFC0000042"
                  maxLength={11}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name</label>
                <input
                  className={inputClass}
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  placeholder="HDFC Bank"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Branch Name</label>
                <input
                  className={inputClass}
                  value={editBranch}
                  onChange={(e) => setEditBranch(e.target.value)}
                  placeholder="Vashi APMC Commercial Branch"
                />
              </div>
            </div>
          </div>

          {/* Sticky Actions Footer */}
          <div className="sticky bottom-0 -mx-6 -mb-6 sm:-mx-8 sm:-mb-8 flex items-center justify-between border-t border-slate-200 bg-white/95 px-6 py-4 sm:px-8 backdrop-blur-md rounded-b-3xl">
            <span className="text-xs text-slate-500">
              All 20 fields are directly editable and stored in your database account.
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save All Changes"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
