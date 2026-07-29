"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/portal-shell";
import DataTable from "@/components/data-table";
import Badge from "@/components/badge";
import Spinner from "@/components/spinner";
import ErrorBox from "@/components/error-box";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Package, Pill, ShoppingCart, MoreHorizontal } from "lucide-react";

const NAV = [
  { href: "/portal/pharmacy/dispense",  label: "Dispense",  icon: <Pill size={16} /> },
  { href: "/portal/pharmacy/medicines", label: "Medicines", icon: <Package size={16} /> },
  { href: "/portal/pharmacy/purchases", label: "Purchases", icon: <ShoppingCart size={16} /> },
  { href: "/portal/pharmacy/more",      label: "More",      icon: <MoreHorizontal size={16} /> },
];

export default function PharmacyPurchasesPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<any>("/purchases/orders?limit=30", user.token);
      setOrders(Array.isArray(res) ? res : (res.items ?? []));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user]);

  return (
    <PortalShell nav={NAV} title="Purchase Orders">
      {loading ? <Spinner text="Loading…" /> : error ? <ErrorBox message={error} retry={load} /> : (
        <DataTable
          rows={orders}
          columns={[
            { key: "id",           label: "Order ID" },
            { key: "supplierName", label: "Supplier" },
            { key: "createdAt",    label: "Date", render: o => o.createdAt?.slice(0, 10) },
            { key: "status",       label: "Status", render: o => <Badge label={o.status} /> },
          ]}
          emptyText="No purchase orders"
        />
      )}
    </PortalShell>
  );
}
