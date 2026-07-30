"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HOME, useAuth } from "@/lib/auth-context";

function readable(e: unknown): string {
  const code = typeof e === "object" && e !== null && "code" in e ? String(e.code) : "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address is not valid.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes.";
    case "auth/network-request-failed":
      return "Cannot reach the sign-in service. Check your connection.";
    default:
      return e instanceof Error && e.message ? e.message : "Sign-in failed.";
  }
}

export default function LoginPage() {
  const { login, user, ready, error: authError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState("");

  useEffect(() => {
    if (user) router.replace(HOME[user.role]);
  }, [user, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFailure("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      setFailure(readable(e));
      setLoading(false);
    }
  }

  const message = failure || authError;
  // The provider signs out accounts the API rejects, and that path never returns here, so
  // its message is also what tells us to stop showing progress.
  const busy = loading && !authError;

  return (
    <div className="min-h-screen flex items-stretch">
      {/* Left — brand */}
      <div className="hidden lg:flex flex-col justify-between w-[42%] bg-brand-dark px-14 py-12">
        <div>
          <div className="size-10 rounded-xl bg-brand flex items-center justify-center mb-10">
            <span className="text-white font-bold">CF</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-5">
            PharmaStore
            <br />
            CareFlow
          </h1>
          <p className="text-white/70 text-base leading-relaxed max-w-xs">
            Unified hospital operations — EMR, pharmacy, front desk, and billing in one workspace.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {["Inventory", "Appointments", "Billing", "Prescriptions"].map((f) => (
            <div key={f} className="bg-white/5 rounded-xl px-4 py-3 text-sm text-white/70">
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center bg-surface px-6 py-12">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-ink mb-1">Sign in</h2>
          <p className="text-sm text-muted mb-8">
            Use your CareFlow account. Your role decides which portal opens.
          </p>

          <label htmlFor="email" className="block text-xs font-medium text-muted mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            placeholder="you@hospital.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-white text-ink placeholder:text-muted-soft outline-none focus:ring-2 focus:ring-brand/30 mb-5"
          />

          <label htmlFor="password" className="block text-xs font-medium text-muted mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-white text-ink placeholder:text-muted-soft outline-none focus:ring-2 focus:ring-brand/30 mb-5"
          />

          {message && (
            <p
              role="alert"
              className="text-sm text-danger bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5"
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !ready}
            className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-xs text-center text-muted mt-6">
            Accounts are created by your hospital administrator.
          </p>
        </form>
      </div>
    </div>
  );
}
