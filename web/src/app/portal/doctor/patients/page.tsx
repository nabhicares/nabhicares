"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/portal-shell";
import DataTable from "@/components/data-table";
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

export default function DoctorPatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<any>("/patients?limit=50", user.token);
      setPatients(Array.isArray(res) ? res : (res.items ?? []));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user]);

  return (
    <PortalShell nav={NAV} title="My Patients">
      {loading ? <Spinner text="Loading…" /> : error ? <ErrorBox message={error} retry={load} /> : (
        <DataTable
          rows={patients}
          columns={[
            { key: "name",        label: "Name" },
            { key: "dateOfBirth", label: "DOB" },
            { key: "gender",      label: "Gender" },
            { key: "phone",       label: "Phone" },
          ]}
          emptyText="No patients"
        />
      )}
    </PortalShell>
  );
}
