"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/portal-shell";
import DataTable from "@/components/data-table";
import Badge from "@/components/badge";
import Spinner from "@/components/spinner";
import ErrorBox from "@/components/error-box";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Home, CalendarDays, FileText, Receipt, MoreHorizontal } from "lucide-react";

const NAV = [
  { href: "/portal/patient/home",          label: "Home",          icon: <Home size={16} /> },
  { href: "/portal/patient/appointments",  label: "Appointments",  icon: <CalendarDays size={16} /> },
  { href: "/portal/patient/prescriptions", label: "Prescriptions", icon: <FileText size={16} /> },
  { href: "/portal/patient/invoices",      label: "Invoices",      icon: <Receipt size={16} /> },
  { href: "/portal/patient/more",          label: "More",          icon: <MoreHorizontal size={16} /> },
];

export default function PatientPrescriptionsPage() {
  const { user } = useAuth();
  const [rxs, setRxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      if (!user.patientId) throw new Error("This account is not linked to a patient record.");
      const res = await api.get<any>(
        `/prescriptions?patientId=${user.patientId}&limit=20`,
        user.token,
      );
      setRxs(Array.isArray(res) ? res : (res.items ?? []));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user]);

  return (
    <PortalShell nav={NAV} title="My Prescriptions">
      {loading ? <Spinner text="Loading…" /> : error ? <ErrorBox message={error} retry={load} /> : (
        <DataTable
          rows={rxs}
          columns={[
            { key: "id",         label: "Rx ID" },
            { key: "doctorName", label: "Doctor" },
            { key: "createdAt",  label: "Date", render: r => r.createdAt?.slice(0, 10) },
            { key: "status",     label: "Status", render: r => <Badge label={r.status} /> },
          ]}
          emptyText="No prescriptions"
        />
      )}
    </PortalShell>
  );
}
