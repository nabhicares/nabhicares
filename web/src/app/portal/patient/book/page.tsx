"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PortalShell from "@/components/portal-shell";
import UiCard from "@/components/ui-card";
import PrimaryButton from "@/components/primary-button";
import Spinner from "@/components/spinner";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { PATIENT_NAV } from "@/lib/patient-nav";

const SLOTS = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00"];

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function BookForm() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const doctorId = params.get("doctorId") ?? "";
  const doctorName = params.get("name") ?? "Doctor";
  const specialty = params.get("specialty") ?? "";
  const fee = params.get("fee") ?? "";

  const [date, setDate] = useState(tomorrowIso);
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const minDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function submit() {
    if (!user?.patientId || !doctorId || !slot) {
      setError("Pick a time slot to continue.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.post("/appointments", user.token, {
        patientId: user.patientId,
        doctorId,
        date,
        timeSlot: slot,
      });
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <UiCard>
        <p className="font-semibold text-ink">{doctorName}</p>
        <p className="text-sm text-muted mt-1">
          {[specialty, fee ? `₹${fee}` : null].filter(Boolean).join(" · ") || "Consultation"}
        </p>
      </UiCard>

      {!doctorId ? (
        <p className="text-sm text-danger">Missing doctor. Go back and choose one from Find doctor.</p>
      ) : done ? (
        <UiCard>
          <p className="font-semibold text-success">Appointment booked</p>
          <p className="text-sm text-muted mt-1">
            {date} at {slot} with {doctorName}
          </p>
          <PrimaryButton
            className="mt-4 w-full"
            onClick={() => router.push("/portal/patient/appointments")}
          >
            View bookings
          </PrimaryButton>
        </UiCard>
      ) : (
        <>
          <div>
            <label className="text-sm font-semibold text-ink">Date</label>
            <input
              type="date"
              min={minDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-ink mb-2">Time slot</p>
            <div className="grid grid-cols-3 gap-2">
              {SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlot(s)}
                  className={`rounded-xl border py-2.5 text-sm font-semibold ${
                    slot === s
                      ? "border-brand bg-brand text-white"
                      : "border-border bg-white text-ink hover:border-brand/40"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <PrimaryButton className="w-full" disabled={busy || !slot} onClick={() => void submit()}>
            {busy ? "Booking…" : "Confirm booking"}
          </PrimaryButton>
        </>
      )}
    </div>
  );
}

export default function BookVisitPage() {
  const { user } = useAuth();
  return (
    <PortalShell
      nav={PATIENT_NAV}
      title="Book visit"
      requireRole="patient"
      hospitalSubtitle={user?.hospitalName}
    >
      <Suspense fallback={<Spinner text="Loading…" />}>
        <BookForm />
      </Suspense>
    </PortalShell>
  );
}
