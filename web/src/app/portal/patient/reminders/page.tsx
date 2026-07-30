"use client";

import { useEffect, useMemo, useState } from "react";
import PortalShell from "@/components/portal-shell";
import UiCard from "@/components/ui-card";
import EmptyState from "@/components/empty-state";
import Spinner from "@/components/spinner";
import ErrorBox from "@/components/error-box";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { PATIENT_NAV } from "@/lib/patient-nav";
import { Pill } from "lucide-react";

type RxItem = {
  medicineName?: string;
  dosage?: string;
  frequency?: string;
  durationDays?: number | string;
  instructions?: string;
};

type Rx = {
  id: string;
  status?: string;
  items?: RxItem[];
};

export default function PillRemindersPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Rx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<RxItem | null>(null);

  async function load() {
    if (!user?.patientId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<Rx[] | { items?: Rx[] }>(
        `/prescriptions?patientId=${encodeURIComponent(user.patientId)}&limit=30`,
        user.token,
      );
      setRows(Array.isArray(res) ? res : (res.items ?? []));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [user?.patientId, user?.token]);

  const reminders = useMemo(() => {
    const items: RxItem[] = [];
    for (const rx of rows) {
      if (rx.status === "cancelled" || rx.status === "dispensed") continue;
      for (const item of rx.items ?? []) items.push(item);
    }
    return items;
  }, [rows]);

  return (
    <PortalShell
      nav={PATIENT_NAV}
      title="Pill reminders"
      requireRole="patient"
      hospitalSubtitle={user?.hospitalName}
    >
      {loading ? (
        <Spinner text="Loading…" />
      ) : error ? (
        <ErrorBox message={error} retry={load} />
      ) : reminders.length === 0 ? (
        <EmptyState
          title="No active reminders"
          hint="Reminders appear from medicines on your active prescriptions."
        />
      ) : (
        <div className="mx-auto max-w-3xl space-y-3">
          {reminders.map((item, i) => (
            <UiCard key={i} onClick={() => setOpen(item)}>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-brand/10 flex items-center justify-center">
                  <Pill size={18} className="text-brand" />
                </div>
                <div>
                  <p className="font-semibold text-ink">{item.medicineName ?? "Medicine"}</p>
                  <p className="text-sm text-muted">
                    {[item.dosage, item.frequency].filter(Boolean).join(" · ") || "Follow label"}
                  </p>
                </div>
              </div>
            </UiCard>
          ))}
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="font-semibold text-ink text-lg">{open.medicineName}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Dosage</dt>
                <dd className="font-medium text-ink">{open.dosage ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Frequency</dt>
                <dd className="font-medium text-ink">{open.frequency ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Duration</dt>
                <dd className="font-medium text-ink">
                  {open.durationDays ? `${open.durationDays} days` : "—"}
                </dd>
              </div>
            </dl>
            {open.instructions ? (
              <p className="mt-3 text-sm text-muted">{open.instructions}</p>
            ) : null}
            <button
              type="button"
              className="mt-5 w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white"
              onClick={() => setOpen(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </PortalShell>
  );
}
