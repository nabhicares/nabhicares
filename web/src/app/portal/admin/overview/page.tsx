"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/portal-shell";
import StatCard from "@/components/stat-card";
import Spinner from "@/components/spinner";
import ErrorBox from "@/components/error-box";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  LayoutDashboard, Package, Users, ShoppingCart, MoreHorizontal,
} from "lucide-react";

const NAV = [
  { href: "/portal/admin/overview",   label: "Overview",   icon: <LayoutDashboard size={16} /> },
  { href: "/portal/admin/inventory",  label: "Inventory",  icon: <Package size={16} /> },
  { href: "/portal/admin/staff",      label: "Staff",      icon: <Users size={16} /> },
  { href: "/portal/admin/purchases",  label: "Purchases",  icon: <ShoppingCart size={16} /> },
  { href: "/portal/admin/sales",      label: "Sales",      icon: <MoreHorizontal size={16} /> },
];

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [s, r] = await Promise.all([
        api.get<any>("/inventory/summary", user.token),
        api.get<any>("/reports/dashboard", user.token),
      ]);
      setSummary(s);
      setReports(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [user]);

  return (
    <PortalShell nav={NAV} title="Overview">
      {loading ? <Spinner text="Loading dashboard…" /> : error ? <ErrorBox message={error} retry={load} /> : (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#0D1B35] mb-4">Inventory</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total SKUs" value={summary.totalSKUs} />
              <StatCard label="Total Units" value={summary.totalUnits} />
              <StatCard label="Low Stock" value={summary.lowStockCount} tone="warning" />
              <StatCard label="Out of Stock" value={summary.outOfStockCount} tone="danger" />
            </div>
          </div>
          {reports && (
            <div>
              <h2 className="text-lg font-bold text-[#0D1B35] mb-4">Operations</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard label="Total Patients" value={reports.totalPatients ?? "—"} />
                <StatCard label="Appointments Today" value={reports.todayAppointments ?? "—"} />
                <StatCard label="Revenue (Total)" value={reports.totalRevenue != null ? `₹${reports.totalRevenue.toLocaleString()}` : "—"} tone="success" />
              </div>
            </div>
          )}
        </div>
      )}
    </PortalShell>
  );
}
