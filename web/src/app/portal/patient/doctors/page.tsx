"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PortalShell from "@/components/portal-shell";
import UiCard from "@/components/ui-card";
import StatusChip from "@/components/status-chip";
import SectionHeader from "@/components/section-header";
import EmptyState from "@/components/empty-state";
import Spinner from "@/components/spinner";
import ErrorBox from "@/components/error-box";
import PrimaryButton from "@/components/primary-button";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { PATIENT_NAV } from "@/lib/patient-nav";
import { Search, Stethoscope } from "lucide-react";

type Doctor = {
  id: string;
  name: string;
  specialty?: string;
  specialization?: string;
  registrationNumber?: string;
  consultationFee?: string | number;
};

export default function DoctorSearchPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<Doctor[] | { items?: Doctor[] }>("/doctors?limit=50", user.token);
      setDoctors(Array.isArray(res) ? res : (res.items ?? []));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load doctors");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [user?.token]);

  const specialties = useMemo(() => {
    const set = new Set<string>();
    for (const d of doctors) {
      const s = d.specialty ?? d.specialization;
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [doctors]);

  const filtered = doctors.filter((d) => {
    const spec = d.specialty ?? d.specialization ?? "";
    if (specialty && spec !== specialty) return false;
    if (!q.trim()) return true;
    const hay = `${d.name} ${spec}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  function book(d: Doctor) {
    const reg = d.registrationNumber ?? d.id;
    const params = new URLSearchParams({
      doctorId: reg,
      name: d.name,
      specialty: d.specialty ?? d.specialization ?? "",
      fee: String(d.consultationFee ?? ""),
    });
    router.push(`/portal/patient/book?${params.toString()}`);
  }

  return (
    <PortalShell
      nav={PATIENT_NAV}
      title="Find a doctor"
      requireRole="patient"
      hospitalSubtitle={user?.hospitalName}
    >
      {loading ? (
        <Spinner text="Loading doctors…" />
      ) : error ? (
        <ErrorBox message={error} retry={load} />
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-soft" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or specialty"
              className="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSpecialty(null)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                specialty === null ? "bg-brand text-white" : "bg-white border border-border text-muted"
              }`}
            >
              All
            </button>
            {specialties.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpecialty(s)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  specialty === s ? "bg-brand text-white" : "bg-white border border-border text-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <SectionHeader title={`${filtered.length} doctors`} />
          {filtered.length === 0 ? (
            <EmptyState title="No matching doctors" />
          ) : (
            <div className="space-y-3">
              {filtered.map((d) => (
                <UiCard key={d.id}>
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                      <Stethoscope size={18} className="text-brand" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{d.name}</p>
                      <p className="text-sm text-muted">
                        {d.specialty ?? d.specialization ?? "General"}
                        {d.consultationFee != null && d.consultationFee !== ""
                          ? ` · ₹${d.consultationFee}`
                          : ""}
                      </p>
                    </div>
                    <PrimaryButton onClick={() => book(d)}>Book</PrimaryButton>
                  </div>
                </UiCard>
              ))}
            </div>
          )}
        </div>
      )}
    </PortalShell>
  );
}
