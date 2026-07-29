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

const DEMO_PATIENT = "BADP1K3A";

export default function PatientInvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<any>(`/billing/invoices/patient/${DEMO_PATIENT}`, user.token);
      setInvoices(Array.isArray(res) ? res : []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user]);

  return (
    <PortalShell nav={NAV} title="My Invoices">
      {loading ? <Spinner text="Loading…" /> : error ? <ErrorBox message={error} retry={load} /> : (
        <DataTable
          rows={invoices}
          columns={[
            { key: "id",          label: "Invoice ID" },
            { key: "totalAmount", label: "Amount",  render: i => `₹${i.totalAmount}` },
            { key: "status",      label: "Status",  render: i => <Badge label={i.status} /> },
            { key: "createdAt",   label: "Date",    render: i => i.createdAt?.slice(0, 10) },
          ]}
          emptyText="No invoices"
        />
      )}
    </PortalShell>
  );
}
