"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/portal-shell";
import UiCard from "@/components/ui-card";
import StatusChip from "@/components/status-chip";
import EmptyState from "@/components/empty-state";
import Spinner from "@/components/spinner";
import ErrorBox from "@/components/error-box";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { PATIENT_NAV } from "@/lib/patient-nav";

type RxItem = {
  medicineName?: string;
  dosage?: string;
  frequency?: string;
  durationDays?: number | string;
  instructions?: string;
};

type Rx = {
  id: string;
  doctorName?: string;
  status?: string;
  createdAt?: string;
  items?: RxItem[];
};

export default function PatientPrescriptionsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Rx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <PortalShell
      nav={PATIENT_NAV}
      title="Prescriptions"
      requireRole="patient"
      hospitalSubtitle={user?.hospitalName}
    >
      {loading ? (
        <Spinner text="Loading…" />
      ) : error ? (
        <ErrorBox message={error} retry={load} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No prescriptions"
          hint="Prescriptions issued by your doctor will show up here."
        />
      ) : (
        <div className="mx-auto max-w-3xl space-y-3">
          {rows.map((rx) => (
            <UiCard key={rx.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{rx.doctorName ?? "Doctor"}</p>
                  <p className="text-xs text-muted mt-1">
                    {rx.createdAt ? new Date(rx.createdAt).toLocaleDateString() : "—"}
                  </p>
                </div>
                <StatusChip label={rx.status ?? "active"} />
              </div>
              <ul className="mt-3 space-y-2">
                {(rx.items ?? []).map((item, i) => (
                  <li key={i} className="rounded-xl bg-surface-muted px-3 py-2 text-sm">
                    <p className="font-medium text-ink">{item.medicineName ?? "Medicine"}</p>
                    <p className="text-muted text-xs mt-0.5">
                      {[item.dosage, item.frequency, item.durationDays ? `${item.durationDays} days` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {item.instructions ? (
                      <p className="text-xs text-muted mt-1">{item.instructions}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </UiCard>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
