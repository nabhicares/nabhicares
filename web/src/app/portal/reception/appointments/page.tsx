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

export default function ReceptionAppointmentsPage() {
  const { user } = useAuth();
  const [appts, setAppts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<any>("/appointments?limit=50", user.token);
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
            { key: "id",          label: "ID" },
            { key: "patientName", label: "Patient" },
            { key: "doctorName",  label: "Doctor" },
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
