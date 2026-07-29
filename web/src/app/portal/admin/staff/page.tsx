"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/portal-shell";
import DataTable from "@/components/data-table";
import Spinner from "@/components/spinner";
import ErrorBox from "@/components/error-box";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { LayoutDashboard, Package, Users, ShoppingCart, MoreHorizontal } from "lucide-react";

const NAV = [
  { href: "/portal/admin/overview",  label: "Overview",  icon: <LayoutDashboard size={16} /> },
  { href: "/portal/admin/inventory", label: "Inventory", icon: <Package size={16} /> },
  { href: "/portal/admin/staff",     label: "Staff",     icon: <Users size={16} /> },
  { href: "/portal/admin/purchases", label: "Purchases", icon: <ShoppingCart size={16} /> },
  { href: "/portal/admin/sales",     label: "Sales",     icon: <MoreHorizontal size={16} /> },
];

export default function AdminStaffPage() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<any>("/doctors", user.token);
      setDoctors(Array.isArray(res) ? res : (res.items ?? []));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user]);

  return (
    <PortalShell nav={NAV} title="Staff — Doctors">
      {loading ? <Spinner text="Loading…" /> : error ? <ErrorBox message={error} retry={load} /> : (
        <DataTable
          rows={doctors}
          columns={[
            { key: "name",            label: "Name" },
            { key: "specialty",       label: "Specialty" },
            { key: "consultationFee", label: "Consult Fee", render: d => d.consultationFee != null ? `₹${d.consultationFee}` : "—" },
            { key: "phone",           label: "Phone" },
            { key: "hospitalId",      label: "Hospital" },
          ]}
          emptyText="No doctors found"
        />
      )}
    </PortalShell>
  );
}
