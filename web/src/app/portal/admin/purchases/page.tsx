"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/portal-shell";
import DataTable from "@/components/data-table";
import Badge from "@/components/badge";
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

export default function AdminPurchasesPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<any>("/purchases/orders?limit=50", user.token);
      setOrders(Array.isArray(res) ? res : (res.items ?? []));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user]);

  return (
    <PortalShell nav={NAV} title="Purchase Orders">
      <div className="mb-4 flex justify-end">
        <button onClick={load} className="bg-[#0C6EFD] text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-[#0952d6]">
          Refresh
        </button>
      </div>
      {loading ? <Spinner text="Loading…" /> : error ? <ErrorBox message={error} retry={load} /> : (
        <DataTable
          rows={orders}
          columns={[
            { key: "id",           label: "Order ID" },
            { key: "supplierName", label: "Supplier" },
            { key: "createdAt",    label: "Date",    render: o => o.createdAt?.slice(0, 10) },
            { key: "status",       label: "Status",  render: o => <Badge label={o.status} /> },
            { key: "items",        label: "Lines",   render: o => o.items?.length ?? 0 },
          ]}
          emptyText="No purchase orders"
        />
      )}
    </PortalShell>
  );
}
