"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/portal-shell";
import DataTable from "@/components/data-table";
import Badge from "@/components/badge";
import Spinner from "@/components/spinner";
import ErrorBox from "@/components/error-box";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { LayoutDashboard, Package, Users, ShoppingCart, MoreHorizontal, Search } from "lucide-react";

const NAV = [
  { href: "/portal/admin/overview",  label: "Overview",  icon: <LayoutDashboard size={16} /> },
  { href: "/portal/admin/inventory", label: "Inventory", icon: <Package size={16} /> },
  { href: "/portal/admin/staff",     label: "Staff",     icon: <Users size={16} /> },
  { href: "/portal/admin/purchases", label: "Purchases", icon: <ShoppingCart size={16} /> },
  { href: "/portal/admin/sales",     label: "Sales",     icon: <MoreHorizontal size={16} /> },
];

export default function AdminInventoryPage() {
  const { user } = useAuth();
  const [meds, setMeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<any>(`/inventory/medicines?q=${encodeURIComponent(q)}&limit=50`, user.token);
      setMeds(Array.isArray(res) ? res : (res.items ?? []));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user]);

  function stockStatus(m: any) {
    if (m.totalQuantity === 0) return "out";
    if (m.totalQuantity <= m.reorderLevel) return "low";
    return "ok";
  }

  const filtered = meds.filter(m =>
    !q || m.name?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <PortalShell nav={NAV} title="Inventory">
      <div className="mb-4 flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7891]" />
          <input
            placeholder="Search medicines…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load()}
            className="w-full pl-9 pr-4 py-2.5 border border-[#E5E8EF] rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-[#0C6EFD]/30"
          />
        </div>
        <button onClick={load} className="bg-[#0C6EFD] text-white text-sm font-medium px-4 rounded-xl hover:bg-[#0952d6]">
          Search
        </button>
      </div>
      {loading ? <Spinner text="Loading…" /> : error ? <ErrorBox message={error} retry={load} /> : (
        <DataTable
          rows={filtered}
          columns={[
            { key: "name",          label: "Medicine" },
            { key: "category",      label: "Category" },
            { key: "totalQuantity", label: "Qty" },
            { key: "reorderLevel",  label: "Reorder" },
            { key: "status", label: "Stock", render: m => <Badge label={stockStatus(m)} /> },
          ]}
          emptyText="No medicines found"
        />
      )}
    </PortalShell>
  );
}
