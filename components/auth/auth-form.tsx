"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useRef, type FormEvent, type ChangeEvent, type DragEvent } from "react";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Landmark,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import {
  INDIAN_STATES,
  PAN_REGEX,
  GSTIN_REGEX,
  IFSC_REGEX,
  formatAadhaarDisplay,
  sanitizeAadhaar,
} from "@/lib/indian-states";

type AuthFormProps =
  | { mode: "signin" }
  | { mode: "admin"; adminEmail: string }
  | { mode: "signup" };

const inputClassName =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10";

export function AuthForm(props: AuthFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  // Optional form state
  const [pan, setPan] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [branch, setBranch] = useState("");

  // Logo state
  const [logoData, setLogoData] = useState<string>("");
  const [logoFileName, setLogoFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  // Inline format warnings
  const [panError, setPanError] = useState("");
  const [aadhaarError, setAadhaarError] = useState("");
  const [gstinError, setGstinError] = useState("");
  const [ifscError, setIfscError] = useState("");

  const isSignup = props.mode === "signup";
  const isAdmin = props.mode === "admin";

  // Handle PAN input
  const handlePanChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().slice(0, 10);
    setPan(val);
    if (val && !PAN_REGEX.test(val)) {
      setPanError("Format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)");
    } else {
      setPanError("");
    }
  };

  // Handle Aadhaar input
  const handleAadhaarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeAadhaar(e.target.value).slice(0, 12);
    setAadhaar(raw);
    if (raw && raw.length !== 12) {
      setAadhaarError("Aadhaar must be a 12-digit number");
    } else {
      setAadhaarError("");
    }
  };

  // Handle GSTIN input
  const handleGstinChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().slice(0, 15);
    setGstin(val);
    if (val && !GSTIN_REGEX.test(val)) {
      setGstinError("Format: 15 characters (e.g. 27ABCDE1234F1Z5)");
    } else {
      setGstinError("");
    }
  };

  // Handle IFSC input
  const handleIfscChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().slice(0, 11);
    setIfsc(val);
    if (val && !IFSC_REGEX.test(val)) {
      setIfscError("Format: 4 letters, 0, 6 alphanumeric (e.g. HDFC0001234)");
    } else {
      setIfscError("");
    }
  };

  // Handle Logo file upload
  const processLogoFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, WEBP, or SVG).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Company logo size must be under 5MB.");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setLogoData(result);
      setLogoFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processLogoFile(file);
    }
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
    if (file) {
      processLogoFile(file);
    }
  };

  const removeLogo = () => {
    setLogoData("");
    setLogoFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    // Validate optional fields only if provided
    if (pan && !PAN_REGEX.test(pan)) {
      setError("Please provide a valid PAN format (e.g. ABCDE1234F) or leave it empty.");
      return;
    }
    if (aadhaar && aadhaar.length !== 12) {
      setError("Please provide a valid 12-digit Aadhaar number or leave it empty.");
      return;
    }
    if (gstin && !GSTIN_REGEX.test(gstin)) {
      setError("Please provide a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5) or leave it empty.");
      return;
    }
    if (ifsc && !IFSC_REGEX.test(ifsc)) {
      setError("Please provide a valid IFSC code (e.g. HDFC0001234) or leave it empty.");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = isAdmin ? props.adminEmail : String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      if (isSignup) {
        const payload: Record<string, unknown> = {
          name: formData.get("name"),
          organizationName: formData.get("organizationName"),
          email,
          password,
        };

        if (pan) payload.pan = pan;
        if (aadhaar) payload.aadhaar = aadhaar;
        if (gstin) payload.gstin = gstin;
        if (logoData) payload.logo = logoData;
        if (address) payload.address = address;
        if (selectedState) payload.state = selectedState;

        if (accountHolderName || accountNumber || ifsc || bankName || branch) {
          payload.bankDetails = {
            accountHolderName: accountHolderName || undefined,
            accountNumber: accountNumber || undefined,
            ifsc: ifsc || undefined,
            bankName: bankName || undefined,
            branch: branch || undefined,
          };
        }

        const response = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = (await response.json()) as { error?: string; pendingApproval?: boolean };
        if (!response.ok) {
          setError(result.error ?? "Unable to create your account.");
          return;
        }
        setSuccess(
          result.pendingApproval
            ? "Your organization request was submitted with all provided details. An administrator must approve it before you can sign in."
            : "Your account is ready. Sign in to continue.",
        );
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!result || result.error) {
        setError("The email or password is incorrect.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError(isSignup ? "Unable to create your account right now." : "Unable to sign in right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = isSignup ? "Create your account" : isAdmin ? "Admin sign in" : "Welcome back";
  const description = isSignup
    ? "Set up your organization and start managing your finances."
    : isAdmin
      ? "Sign in to the BharatGodam administration dashboard."
      : "Sign in to continue to your BharatGodam dashboard.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section
        className={`w-full ${
          isSignup ? "max-w-2xl" : "max-w-md"
        } rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9 transition-all duration-300`}
      >
        <Link
          href="/"
          className="inline-block transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg"
          title="BharatGodam"
          aria-label="BharatGodam Home"
        >
          <Image
            src="/bharatgodam-logo.jpg"
            alt="BharatGodam Logo"
            width={200}
            height={90}
            className="h-12 sm:h-14 w-auto max-w-[200px] object-contain"
            style={{ objectFit: "contain", aspectRatio: "1024 / 458" }}
            priority
          />
        </Link>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {/* Required Fields for Signup */}
          {isSignup && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Your name <span className="text-rose-500">*</span>
                <input
                  className={inputClassName}
                  name="name"
                  placeholder="e.g. Suresh Agarwal"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Organization name <span className="text-rose-500">*</span>
                <input
                  className={inputClassName}
                  name="organizationName"
                  placeholder="e.g. BharatGodam Foods Ltd"
                  autoComplete="organization"
                  required
                  minLength={2}
                  maxLength={120}
                />
              </label>
            </div>
          )}

          {/* Account Credentials */}
          <div className={`grid grid-cols-1 ${isSignup ? "sm:grid-cols-2" : ""} gap-4`}>
            {isAdmin ? (
              <label className="block text-sm font-medium text-slate-700">
                Admin email
                <input
                  className={`${inputClassName} bg-slate-50`}
                  type="email"
                  value={props.adminEmail}
                  readOnly
                  aria-readonly="true"
                />
              </label>
            ) : (
              <label className="block text-sm font-medium text-slate-700">
                Email {isSignup && <span className="text-rose-500">*</span>}
                <input
                  className={inputClassName}
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </label>
            )}

            <label className="block text-sm font-medium text-slate-700">
              Password {isSignup && <span className="text-rose-500">*</span>}
              <input
                className={inputClassName}
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={isSignup ? 8 : undefined}
                maxLength={128}
              />
            </label>
          </div>

          {/* Optional Business Details Collapsible Section for Signup */}
          {isSignup && (
            <div className="mt-6 pt-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition-all">
                <button
                  type="button"
                  onClick={() => setShowOptionalFields((prev) => !prev)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          Business Verification & Banking Details
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                          Optional
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {showOptionalFields
                          ? "All fields below are optional. You can also complete them later in Profile."
                          : "Add PAN, Aadhaar, GSTIN, Company Logo, Address, State & Bank Details now."}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition">
                    {showOptionalFields ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </button>

                {showOptionalFields && (
                  <div className="mt-5 space-y-5 border-t border-slate-200/80 pt-4">
                    {/* Section 1: Statutory & Tax Identification */}
                    <div>
                      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        <FileText className="h-3.5 w-3.5 text-emerald-600" />
                        Statutory Identification (Optional)
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600">
                            PAN Number
                            <input
                              className={`${inputClassName} uppercase`}
                              placeholder="ABCDE1234F"
                              value={pan}
                              onChange={handlePanChange}
                              maxLength={10}
                            />
                          </label>
                          {panError && <p className="mt-1 text-xs text-rose-600">{panError}</p>}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600">
                            Aadhaar Number
                            <input
                              className={inputClassName}
                              placeholder="1234 5678 9012"
                              value={formatAadhaarDisplay(aadhaar)}
                              onChange={handleAadhaarChange}
                              maxLength={14}
                            />
                          </label>
                          {aadhaarError && <p className="mt-1 text-xs text-rose-600">{aadhaarError}</p>}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600">
                            GSTIN
                            <input
                              className={`${inputClassName} uppercase`}
                              placeholder="27ABCDE1234F1Z5"
                              value={gstin}
                              onChange={handleGstinChange}
                              maxLength={15}
                            />
                          </label>
                          {gstinError && <p className="mt-1 text-xs text-rose-600">{gstinError}</p>}
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Branding & Address */}
                    <div>
                      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                        Company Branding & Location (Optional)
                      </div>

                      {/* Logo Upload Zone */}
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Company Logo</label>
                        {logoData ? (
                          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5">
                            <div className="flex items-center gap-3">
                              <Image
                                src={logoData}
                                alt="Company logo preview"
                                width={40}
                                height={40}
                                unoptimized
                                className="h-10 w-10 rounded-lg object-contain border border-slate-200 bg-white"
                              />
                              <div>
                                <p className="text-xs font-medium text-slate-800">{logoFileName || "Uploaded logo"}</p>
                                <p className="text-[11px] text-emerald-700 flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Ready to save with account
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={removeLogo}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                              title="Remove logo"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-center transition ${
                              isDragging
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-slate-300 hover:border-slate-400 bg-white"
                            }`}
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                              <Upload className="h-4 w-4" />
                            </div>
                            <div className="text-xs text-slate-600">
                              <span className="font-semibold text-emerald-700">Click to upload</span> or drag and drop
                              logo (PNG, JPG, SVG up to 5MB)
                            </div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleFileInput}
                            />
                          </div>
                        )}
                      </div>

                      {/* Address & State */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-600">
                            Registered Address
                            <input
                              className={inputClassName}
                              placeholder="e.g. Plot 42, Sector 18, APMC Market"
                              value={address}
                              onChange={(e) => setAddress(e.target.value)}
                              maxLength={500}
                            />
                          </label>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600">
                            State
                            <select
                              className={`${inputClassName} cursor-pointer`}
                              value={selectedState}
                              onChange={(e) => setSelectedState(e.target.value)}
                            >
                              <option value="">Select State / UT</option>
                              {INDIAN_STATES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Bank Details */}
                    <div>
                      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        <Landmark className="h-3.5 w-3.5 text-emerald-600" />
                        Settlement Bank Account (Optional)
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-medium text-slate-600">
                            Account Holder Name
                            <input
                              className={inputClassName}
                              placeholder="e.g. BharatGodam Foods Ltd"
                              value={accountHolderName}
                              onChange={(e) => setAccountHolderName(e.target.value)}
                              maxLength={100}
                            />
                          </label>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600">
                            Account Number
                            <input
                              className={inputClassName}
                              placeholder="e.g. 50200012345678"
                              value={accountNumber}
                              onChange={(e) => setAccountNumber(e.target.value)}
                              maxLength={35}
                            />
                          </label>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600">
                            IFSC Code
                            <input
                              className={`${inputClassName} uppercase`}
                              placeholder="e.g. HDFC0000042"
                              value={ifsc}
                              onChange={handleIfscChange}
                              maxLength={11}
                            />
                          </label>
                          {ifscError && <p className="mt-1 text-xs text-rose-600">{ifscError}</p>}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600">
                            Bank Name
                            <input
                              className={inputClassName}
                              placeholder="e.g. HDFC Bank"
                              value={bankName}
                              onChange={(e) => setBankName(e.target.value)}
                              maxLength={100}
                            />
                          </label>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-600">
                            Branch Name
                            <input
                              className={inputClassName}
                              placeholder="e.g. Vashi APMC Commercial Branch"
                              value={branch}
                              onChange={(e) => setBranch(e.target.value)}
                              maxLength={100}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700" role="status">
              {success}
            </p>
          )}

          <button
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
            type="submit"
            disabled={isSubmitting || (isAdmin && !props.adminEmail)}
          >
            {isSubmitting ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
          </button>
          {isAdmin && !props.adminEmail && (
            <p className="text-sm text-rose-700" role="alert">
              Admin login is not configured. Set ADMIN_EMAIL in the server environment.
            </p>
          )}
        </form>

        <div className="mt-6 space-y-3 text-center text-sm text-slate-500">
          {isSignup ? (
            <p>
              Already have an account?{" "}
              <Link className="font-semibold text-emerald-700 hover:text-emerald-800" href="/signin">
                Sign in
              </Link>
            </p>
          ) : (
            <p>
              {isAdmin ? "Not an admin?" : "New to BharatGodam?"}{" "}
              <Link
                className="font-semibold text-emerald-700 hover:text-emerald-800"
                href={isAdmin ? "/signin" : "/signup"}
              >
                {isAdmin ? "User sign in" : "Create an account"}
              </Link>
            </p>
          )}
          {!isSignup && !isAdmin && (
            <p>
              <Link className="text-slate-500 underline underline-offset-4 hover:text-slate-700" href="/admin/login">
                Admin login
              </Link>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
