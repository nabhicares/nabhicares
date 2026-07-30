"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/portal-shell";
import UiCard from "@/components/ui-card";
import EmptyState from "@/components/empty-state";
import Spinner from "@/components/spinner";
import ErrorBox from "@/components/error-box";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { PATIENT_NAV } from "@/lib/patient-nav";
import { Bell } from "lucide-react";

type Note = {
  id: string;
  title?: string;
  body?: string;
  createdAt?: string;
  readAt?: string | null;
};

export default function PatientAlertsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Note[]>([]);
  const [open, setOpen] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<Note[] | { items?: Note[] }>("/notifications?limit=50", user.token);
      setRows(Array.isArray(res) ? res : (res.items ?? []));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [user?.token]);

  return (
    <PortalShell
      nav={PATIENT_NAV}
      title="Alerts"
      requireRole="patient"
      hospitalSubtitle={user?.hospitalName}
    >
      {loading ? (
        <Spinner text="Loading…" />
      ) : error ? (
        <ErrorBox message={error} retry={load} />
      ) : rows.length === 0 ? (
        <EmptyState title="No alerts" hint="Appointment and pharmacy updates will show up here." />
      ) : (
        <div className="mx-auto max-w-3xl space-y-3">
          {rows.map((n) => (
            <UiCard key={n.id} onClick={() => setOpen(n)}>
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                  <Bell size={18} className="text-brand" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{n.title ?? "Notification"}</p>
                  <p className="text-sm text-muted line-clamp-2 mt-0.5">{n.body}</p>
                  <p className="text-xs text-muted-soft mt-1">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
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
            <p className="font-semibold text-ink text-lg">{open.title}</p>
            <p className="mt-3 text-sm text-muted whitespace-pre-wrap">{open.body}</p>
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
