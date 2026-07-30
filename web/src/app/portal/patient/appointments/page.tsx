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
  { href: "/portal/patient/home",         label: "Home",         icon: <Home size={16} /> },
  { href: "/portal/patient/appointments", label: "Appointments", icon: <CalendarDays size={16} /> },
  { href: "/portal/patient/prescriptions",label: "Prescriptions",icon: <FileText size={16} /> },
  { href: "/portal/patient/invoices",     label: "Invoices",     icon: <Receipt size={16} /> },
  { href: "/portal/patient/more",         label: "More",         icon: <MoreHorizontal size={16} /> },
];

export default function PatientAppointmentsPage() {
  const { user } = useAuth();
  const [appts, setAppts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      // Without the filter this listed the whole hospital's appointments to the patient.
      if (!user.patientId) throw new Error("This account is not linked to a patient record.");
      const res = await api.get<any>(
        `/appointments?patientId=${user.patientId}&limit=50`,
        user.token,
      );
      setAppts(Array.isArray(res) ? res : (res.items ?? []));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user]);

  return (
    <PortalShell nav={NAV} title="My Appointments">
      {loading ? <Spinner text="Loading…" /> : error ? <ErrorBox message={error} retry={load} /> : (
        <DataTable
          rows={appts}
          columns={[
            { key: "doctorName", label: "Doctor" },
            { key: "date",       label: "Date" },
            { key: "timeSlot",   label: "Time" },
            { key: "status",     label: "Status", render: a => <Badge label={a.status} /> },
          ]}
          emptyText="No appointments"
        />
      )}
    </PortalShell>
  );
}
