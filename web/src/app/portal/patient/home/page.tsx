"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  FileText,
  Pill,
  Receipt,
  Search,
  Stethoscope,
} from "lucide-react";
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

type Appt = {
  id: string;
  doctorName?: string;
  date?: string;
  timeSlot?: string;
  status?: string;
};

type Doctor = {
  id: string;
  name: string;
  specialty?: string;
  specialization?: string;
  registrationNumber?: string;
  consultationFee?: string | number;
};

export default function PatientHomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [appts, setAppts] = useState<Appt[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user?.patientId) return;
    setLoading(true);
    setError("");
    try {
      const [apptRes, docRes] = await Promise.all([
        api.get<Appt[] | { items?: Appt[] }>(
          `/appointments?patientId=${encodeURIComponent(user.patientId)}&limit=10`,
          user.token,
        ),
        api.get<Doctor[] | { items?: Doctor[] }>("/doctors?limit=12", user.token),
      ]);
      setAppts(Array.isArray(apptRes) ? apptRes : (apptRes.items ?? []));
      setDoctors(Array.isArray(docRes) ? docRes : (docRes.items ?? []));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [user?.patientId, user?.token]);

  const upcoming = useMemo(
    () =>
      appts.find((a) => a.status !== "cancelled" && a.status !== "completed") ??
      null,
    [appts],
  );

  const actions = [
    { href: "/portal/patient/doctors", label: "Find doctor", icon: Search },
    { href: "/portal/patient/appointments", label: "Bookings", icon: CalendarDays },
    { href: "/portal/patient/reminders", label: "Reminders", icon: Pill },
    { href: "/portal/patient/invoices", label: "Invoices", icon: Receipt },
  ];

  return (
    <PortalShell
      nav={PATIENT_NAV}
      title="My Health"
      requireRole="patient"
      hospitalSubtitle={user?.hospitalName}
    >
      {loading ? (
        <Spinner text="Loading…" />
      ) : error ? (
        <ErrorBox message={error} retry={load} />
      ) : !user?.patientId ? (
        <EmptyState title="No patient record linked" hint="Ask reception to link your account." />
      ) : (
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <p className="text-sm text-muted">Welcome back</p>
            <h2 className="text-xl font-semibold text-ink">
              {user.displayName ?? user.email}
            </h2>
            {user.hospitalName ? (
              <p className="text-sm text-muted mt-0.5">{user.hospitalName}</p>
            ) : null}
          </div>

          <section>
            <SectionHeader
              title="Upcoming appointment"
              action={
                <Link href="/portal/patient/doctors" className="text-sm font-semibold text-brand">
                  Book visit
                </Link>
              }
            />
            {upcoming ? (
              <UiCard>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{upcoming.doctorName ?? "Doctor"}</p>
                    <p className="text-sm text-muted mt-1">
                      {upcoming.date} · {upcoming.timeSlot}
                    </p>
                  </div>
                  <StatusChip label={upcoming.status ?? "booked"} />
                </div>
              </UiCard>
            ) : (
              <EmptyState title="No upcoming visits" hint="Find a doctor to book your next appointment." />
            )}
          </section>

          <section>
            <SectionHeader title="Quick actions" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {actions.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-2xl border border-border bg-white p-4 hover:border-brand/40 transition-colors"
                >
                  <div className="size-9 rounded-xl bg-brand/10 flex items-center justify-center mb-3">
                    <Icon size={18} className="text-brand" />
                  </div>
                  <p className="text-sm font-semibold text-ink">{label}</p>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <SectionHeader
              title="Recommended doctors"
              action={
                <Link href="/portal/patient/doctors" className="text-sm font-semibold text-brand">
                  See all
                </Link>
              }
            />
            {doctors.length === 0 ? (
              <EmptyState title="No doctors listed yet" />
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {doctors.slice(0, 8).map((d) => {
                  const reg = d.registrationNumber ?? d.id;
                  return (
                    <div
                      key={d.id}
                      className="min-w-[200px] rounded-2xl border border-border bg-white p-4"
                    >
                      <div className="size-10 rounded-full bg-brand/10 flex items-center justify-center mb-3">
                        <Stethoscope size={18} className="text-brand" />
                      </div>
                      <p className="font-semibold text-ink text-sm">{d.name}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {d.specialty ?? d.specialization ?? "General"}
                      </p>
                      <PrimaryButton
                        className="mt-3 w-full"
                        onClick={() => {
                          const params = new URLSearchParams({
                            doctorId: reg,
                            name: d.name,
                            specialty: d.specialty ?? d.specialization ?? "",
                            fee: String(d.consultationFee ?? ""),
                          });
                          router.push(`/portal/patient/book?${params.toString()}`);
                        }}
                      >
                        Book
                      </PrimaryButton>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <Link
              href="/portal/patient/prescriptions"
              className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 hover:border-brand/40"
            >
              <FileText size={18} className="text-brand" />
              <div>
                <p className="text-sm font-semibold text-ink">Your prescriptions</p>
                <p className="text-xs text-muted">View active Rx and refill history</p>
              </div>
            </Link>
          </section>
        </div>
      )}
    </PortalShell>
  );
}
