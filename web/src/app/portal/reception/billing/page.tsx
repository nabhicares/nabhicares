"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/portal-shell";
import DataTable from "@/components/data-table";
import Badge from "@/components/badge";
import Spinner from "@/components/spinner";
import ErrorBox from "@/components/error-box";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Users, CalendarDays, Receipt, MoreHorizontal } from "lucide-react";

const NAV = [
  { href: "/portal/reception/patients",     label: "Patients",     icon: <Users size={16} /> },
  { href: "/portal/reception/appointments", label: "Appointments", icon: <CalendarDays size={16} /> },
  { href: "/portal/reception/billing",      label: "Billing",      icon: <Receipt size={16} /> },
  { href: "/portal/reception/more",         label: "More",         icon: <MoreHorizontal size={16} /> },
];

export default function ReceptionBillingPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [patientId, setPatientId] = useState("");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Invoices are only addressable per patient, so the desk has to choose one first.
  useEffect(() => {
    if (!user) return;
    api
      .get<any>("/patients?limit=100", user.token)
      .then((res) => {
        const rows = Array.isArray(res) ? res : (res.items ?? []);
        setPatients(rows);
        setPatientId(rows[0]?.medicalRecordNumber ?? "");
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  async function load() {
    if (!user || !patientId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<any>(`/billing/invoices/patient/${patientId}`, user.token);
      setInvoices(Array.isArray(res) ? res : []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user, patientId]);

  return (
    <PortalShell nav={NAV} title="Billing">
      <label htmlFor="patient" className="block text-xs font-medium text-[#6B7891] mb-1.5">
        Patient
      </label>
      <select
        id="patient"
        value={patientId}
        onChange={(e) => setPatientId(e.target.value)}
        className="w-full max-w-sm border border-[#E5E8EF] rounded-xl px-4 py-2.5 text-sm bg-white text-[#0D1B35] outline-none focus:ring-2 focus:ring-[#0C6EFD]/30 mb-5"
      >
        {patients.length === 0 && <option value="">No patients</option>}
        {patients.map((p) => (
          <option key={p.medicalRecordNumber} value={p.medicalRecordNumber}>
            {p.name} — {p.medicalRecordNumber}
          </option>
        ))}
      </select>

      {loading ? <Spinner text="Loading invoices…" /> : error ? <ErrorBox message={error} retry={load} /> : (
        <DataTable
          rows={invoices}
          columns={[
            { key: "id",          label: "Invoice ID" },
            { key: "totalAmount", label: "Amount",  render: i => `₹${i.totalAmount}` },
            { key: "status",      label: "Status",  render: i => <Badge label={i.status} /> },
            { key: "createdAt",   label: "Created", render: i => i.createdAt?.slice(0, 10) },
          ]}
          emptyText="No invoices"
        />
      )}
    </PortalShell>
  );
}
