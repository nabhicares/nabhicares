"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

const HISTORY = new Set(["cancelled", "completed"]);

export default function PatientAppointmentsPage() {
  const { user } = useAuth();
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);

  async function load() {
    if (!user?.patientId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<Appt[] | { items?: Appt[] }>(
        `/appointments?patientId=${encodeURIComponent(user.patientId)}&limit=50`,
        user.token,
      );
      setAppts(Array.isArray(res) ? res : (res.items ?? []));
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
    () => appts.filter((a) => !HISTORY.has(a.status ?? "")),
    [appts],
  );
  const history = useMemo(
    () => appts.filter((a) => HISTORY.has(a.status ?? "")),
    [appts],
  );

  async function cancel(id: string) {
    if (!user) return;
    if (!window.confirm("Cancel this appointment?")) return;
    setCancelling(id);
    try {
      await api.patch(`/appointments/${id}/status`, user.token, { status: "cancelled" });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancelling(null);
    }
  }

  function list(rows: Appt[], canCancel: boolean) {
    if (rows.length === 0) return <EmptyState title="Nothing here yet" />;
    return (
      <div className="space-y-3">
        {rows.map((a) => (
          <UiCard key={a.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{a.doctorName ?? "Doctor"}</p>
                <p className="text-sm text-muted mt-1">
                  {a.date} · {a.timeSlot}
                </p>
              </div>
              <StatusChip label={a.status ?? "booked"} />
            </div>
            {canCancel ? (
              <PrimaryButton
                variant="danger"
                className="mt-3"
                disabled={cancelling === a.id}
                onClick={() => void cancel(a.id)}
              >
                {cancelling === a.id ? "Cancelling…" : "Cancel booking"}
              </PrimaryButton>
            ) : null}
          </UiCard>
        ))}
      </div>
    );
  }

  return (
    <PortalShell
      nav={PATIENT_NAV}
      title="Bookings"
      requireRole="patient"
      hospitalSubtitle={user?.hospitalName}
    >
      {loading ? (
        <Spinner text="Loading…" />
      ) : error ? (
        <ErrorBox message={error} retry={load} />
      ) : (
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex justify-end">
            <Link href="/portal/patient/doctors" className="text-sm font-semibold text-brand">
              Book a visit
            </Link>
          </div>
          <section>
            <SectionHeader title="Upcoming" />
            {list(upcoming, true)}
          </section>
          <section>
            <SectionHeader title="History" />
            {list(history, false)}
          </section>
        </div>
      )}
    </PortalShell>
  );
}
