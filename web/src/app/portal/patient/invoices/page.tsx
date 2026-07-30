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

type Invoice = {
  id: string;
  invoiceNumber?: string;
  status?: string;
  totalAmount?: string | number;
  paidAmount?: string | number;
  createdAt?: string;
};

export default function PatientInvoicesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user?.patientId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<Invoice[] | { items?: Invoice[] }>(
        `/billing/invoices/patient/${encodeURIComponent(user.patientId)}`,
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
      title="Invoices"
      requireRole="patient"
      hospitalSubtitle={user?.hospitalName}
    >
      {loading ? (
        <Spinner text="Loading…" />
      ) : error ? (
        <ErrorBox message={error} retry={load} />
      ) : rows.length === 0 ? (
        <EmptyState title="No invoices" hint="Bills from pharmacy and visits will appear here." />
      ) : (
        <div className="mx-auto max-w-3xl space-y-3">
          {rows.map((inv) => {
            const open = openId === inv.id;
            return (
              <UiCard key={inv.id} onClick={() => setOpenId(open ? null : inv.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">
                      {inv.invoiceNumber ?? inv.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-ink">₹{inv.totalAmount ?? "0"}</p>
                    <div className="mt-1 flex justify-end">
                      <StatusChip label={inv.status ?? "unpaid"} />
                    </div>
                  </div>
                </div>
                {open ? (
                  <div className="mt-3 border-t border-border pt-3 text-sm text-muted space-y-1">
                    <p>Paid: ₹{inv.paidAmount ?? "0"}</p>
                    <p>Balance: pay at reception (cash / card / UPI).</p>
                  </div>
                ) : null}
              </UiCard>
            );
          })}
        </div>
      )}
    </PortalShell>
  );
}
