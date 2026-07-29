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

export default function PharmacyMedicinesPage() {
  const { user } = useAuth();
  const [meds, setMeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<any>("/inventory/medicines?limit=50", user.token);
      setMeds(Array.isArray(res) ? res : (res.items ?? []));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user]);

  function stockBadge(m: any) {
    if (m.totalQuantity === 0) return "out";
    if (m.totalQuantity <= m.reorderLevel) return "low";
    return "ok";
  }

  return (
    <PortalShell nav={NAV} title="Medicines Catalog">
      {loading ? <Spinner text="Loading…" /> : error ? <ErrorBox message={error} retry={load} /> : (
        <DataTable
          rows={meds}
          columns={[
            { key: "name",          label: "Medicine" },
            { key: "category",      label: "Category" },
            { key: "totalQuantity", label: "Qty" },
            { key: "mrp",           label: "MRP", render: m => m.mrp != null ? `₹${m.mrp}` : "—" },
            { key: "status",        label: "Stock", render: m => <Badge label={stockBadge(m)} /> },
          ]}
          emptyText="No medicines"
        />
      )}
    </PortalShell>
  );
}
