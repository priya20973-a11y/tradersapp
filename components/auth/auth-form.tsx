"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type AuthFormProps =
  | { mode: "signin" }
  | { mode: "admin"; adminEmail: string }
  | { mode: "signup" };

const inputClassName =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10";

export function AuthForm(props: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignup = props.mode === "signup";
  const isAdmin = props.mode === "admin";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = isAdmin ? props.adminEmail : String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      if (isSignup) {
        const response = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.get("name"),
            organizationName: formData.get("organizationName"),
            email,
            password,
          }),
        });
        const result = (await response.json()) as { error?: string; pendingApproval?: boolean };
        if (!response.ok) {
          setError(result.error ?? "Unable to create your account.");
          return;
        }
        setSuccess(result.pendingApproval
          ? "Your organization request was submitted. An administrator must approve it before you can sign in."
          : "Your account is ready. Sign in to continue.");
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
      ? "Sign in to the LedgerFlow administration dashboard."
      : "Sign in to continue to your LedgerFlow dashboard.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-base">L</span>
          LedgerFlow
        </Link>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>

        <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
          {isSignup && (
            <>
              <label className="block text-sm font-medium text-slate-700">
                Your name
                <input className={inputClassName} name="name" autoComplete="name" required minLength={2} maxLength={100} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Organization name
                <input
                  className={inputClassName}
                  name="organizationName"
                  autoComplete="organization"
                  required
                  minLength={2}
                  maxLength={120}
                />
              </label>
            </>
          )}

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
              Email
              <input
                className={inputClassName}
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
          )}

          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              className={inputClassName}
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={isSignup ? 8 : undefined}
              maxLength={128}
            />
          </label>

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
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
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
              {isAdmin ? "Not an admin?" : "New to LedgerFlow?"}{" "}
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
