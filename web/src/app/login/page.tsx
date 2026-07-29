"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/api";

const ROLES: { id: Role; label: string; emoji: string; home: string }[] = [
  { id: "patient",       label: "Patient",        emoji: "🧑", home: "/portal/patient/home" },
  { id: "doctor",        label: "Doctor",          emoji: "🩺", home: "/portal/doctor/dashboard" },
  { id: "receptionist",  label: "Receptionist",    emoji: "🖥️", home: "/portal/reception/patients" },
  { id: "pharmacist",    label: "Pharmacist",      emoji: "💊", home: "/portal/pharmacy/dispense" },
  { id: "hospital_admin",label: "Hospital Admin",  emoji: "🏥", home: "/portal/admin/overview" },
  { id: "super_admin",   label: "Super Admin",     emoji: "🔑", home: "/portal/admin/overview" },
];

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<Role>("patient");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    const home = ROLES.find(r => r.id === user.role)?.home ?? "/portal/admin/overview";
    router.replace(home);
    return null;
  }

  function handleLogin() {
    setLoading(true);
    const e = email.trim() || `demo_${selected}@pharmastore.com`;
    login(selected, e);
    const home = ROLES.find(r => r.id === selected)?.home ?? "/portal/admin/overview";
    router.push(home);
  }

  return (
    <div className="min-h-screen flex items-stretch">
      {/* Left — brand */}
      <div className="hidden lg:flex flex-col justify-between w-[42%] bg-[#0D1B35] px-14 py-12">
        <div>
          <div className="size-10 rounded-xl bg-[#0C6EFD] flex items-center justify-center mb-10">
            <span className="text-white font-bold">CF</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-5">
            PharmaStore<br />CareFlow
          </h1>
          <p className="text-[#8FA3C4] text-base leading-relaxed max-w-xs">
            Unified hospital operations — EMR, pharmacy, front desk, and billing in one workspace.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {["Inventory", "Appointments", "Billing", "Prescriptions"].map(f => (
            <div key={f} className="bg-white/5 rounded-xl px-4 py-3 text-sm text-[#8FA3C4]">{f}</div>
          ))}
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center bg-[#F8F9FB] px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-[#0D1B35] mb-1">Sign in</h2>
          <p className="text-sm text-[#6B7891] mb-8">Select your role for demo access</p>

          <div className="grid grid-cols-2 gap-2 mb-6">
            {ROLES.map(r => (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
                  selected === r.id
                    ? "border-[#0C6EFD] bg-[#0C6EFD]/10 text-[#0C6EFD]"
                    : "border-[#E5E8EF] bg-white text-[#6B7891] hover:border-[#0C6EFD]/40"
                }`}
              >
                <span>{r.emoji}</span>
                {r.label}
              </button>
            ))}
          </div>

          <label className="block text-xs font-medium text-[#6B7891] mb-1.5">
            Email (optional)
          </label>
          <input
            type="email"
            placeholder={`demo_${selected}@pharmastore.com`}
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-[#E5E8EF] rounded-xl px-4 py-3 text-sm bg-white text-[#0D1B35] placeholder:text-[#A0AEC0] outline-none focus:ring-2 focus:ring-[#0C6EFD]/30 mb-5"
          />

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-[#0C6EFD] hover:bg-[#0952d6] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Enter portal"}
          </button>

          <p className="text-xs text-center text-[#6B7891] mt-6">
            Demo mode — no real credentials needed
          </p>
        </div>
      </div>
    </div>
  );
}
