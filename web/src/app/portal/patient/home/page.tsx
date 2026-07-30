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

export default function PatientHomePage() {
  const { user } = useAuth();
  const [appts, setAppts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      if (!user.patientId) throw new Error("This account is not linked to a patient record.");
      const res = await api.get<any>(
        `/appointments?patientId=${user.patientId}&limit=10`,
        user.token,
      );
      setAppts(Array.isArray(res) ? res : (res.items ?? []));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user]);

  return (
    <PortalShell nav={NAV} title="My Health">
      {loading ? <Spinner text="Loading…" /> : error ? <ErrorBox message={error} retry={load} /> : (
        <>
          <h2 className="text-base font-semibold text-[#0D1B35] mb-4">Upcoming Appointments</h2>
          <DataTable
            rows={appts.filter(a => a.status !== "cancelled")}
            columns={[
              { key: "doctorName", label: "Doctor" },
              { key: "date",       label: "Date" },
              { key: "timeSlot",   label: "Time" },
              { key: "status",     label: "Status", render: a => <Badge label={a.status} /> },
            ]}
            emptyText="No upcoming appointments"
          />
        </>
      )}
    </PortalShell>
  );
}
