"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/portal-shell";
import DataTable from "@/components/data-table";
import Badge from "@/components/badge";
import Spinner from "@/components/spinner";
import ErrorBox from "@/components/error-box";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { LayoutDashboard, Users, CalendarDays, MoreHorizontal } from "lucide-react";

const NAV = [
  { href: "/portal/doctor/dashboard",    label: "Dashboard",    icon: <LayoutDashboard size={16} /> },
  { href: "/portal/doctor/patients",     label: "My Patients",  icon: <Users size={16} /> },
  { href: "/portal/doctor/appointments", label: "Appointments", icon: <CalendarDays size={16} /> },
  { href: "/portal/doctor/more",         label: "More",         icon: <MoreHorizontal size={16} /> },
];

export default function DoctorAppointmentsPage() {
  const { user } = useAuth();
  const [appts, setAppts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      if (!user.doctorId) throw new Error("This account is not linked to a doctor record.");
      const res = await api.get<any>(
        `/appointments?doctorId=${user.doctorId}&limit=50`,
        user.token,
      );
      setAppts(Array.isArray(res) ? res : (res.items ?? []));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user]);

  return (
    <PortalShell nav={NAV} title="Appointments">
      {loading ? <Spinner text="Loading…" /> : error ? <ErrorBox message={error} retry={load} /> : (
        <DataTable
          rows={appts}
          columns={[
            { key: "patientName", label: "Patient" },
            { key: "date",        label: "Date" },
            { key: "timeSlot",    label: "Time" },
            { key: "status",      label: "Status", render: a => <Badge label={a.status} /> },
          ]}
          emptyText="No appointments"
        />
      )}
    </PortalShell>
  );
}
