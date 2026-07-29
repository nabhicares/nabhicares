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
  { href: "/portal/doctor/dashboard",   label: "Dashboard",    icon: <LayoutDashboard size={16} /> },
  { href: "/portal/doctor/patients",    label: "My Patients",  icon: <Users size={16} /> },
  { href: "/portal/doctor/appointments",label: "Appointments", icon: <CalendarDays size={16} /> },
  { href: "/portal/doctor/more",        label: "More",         icon: <MoreHorizontal size={16} /> },
];

const DEMO_DOCTOR = "5D4181ZA";

export default function DoctorDashboardPage() {
  const { user } = useAuth();
  const [appts, setAppts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<any>(`/appointments?doctorId=${DEMO_DOCTOR}&limit=20`, user.token);
      setAppts(Array.isArray(res) ? res : (res.items ?? []));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user]);

  return (
    <PortalShell nav={NAV} title="My Dashboard">
      {loading ? <Spinner text="Loading…" /> : error ? <ErrorBox message={error} retry={load} /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-[#E5E8EF] p-5">
              <p className="text-xs text-[#6B7891] mb-1">Today's Appointments</p>
              <p className="text-2xl font-bold text-[#0D1B35]">
                {appts.filter(a => a.date === new Date().toISOString().slice(0,10)).length}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-[#E5E8EF] p-5">
              <p className="text-xs text-[#6B7891] mb-1">Total Bookings</p>
              <p className="text-2xl font-bold text-[#0D1B35]">{appts.length}</p>
            </div>
          </div>
          <DataTable
            rows={appts.slice(0, 10)}
            columns={[
              { key: "patientName", label: "Patient" },
              { key: "date",        label: "Date" },
              { key: "timeSlot",    label: "Time" },
              { key: "status",      label: "Status", render: a => <Badge label={a.status} /> },
            ]}
            emptyText="No upcoming appointments"
          />
        </>
      )}
    </PortalShell>
  );
}
