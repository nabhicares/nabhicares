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
  { href: "/portal/pharmacy/dispense",   label: "Dispense",   icon: <Pill size={16} /> },
  { href: "/portal/pharmacy/medicines",  label: "Medicines",  icon: <Package size={16} /> },
  { href: "/portal/pharmacy/purchases",  label: "Purchases",  icon: <ShoppingCart size={16} /> },
  { href: "/portal/pharmacy/more",       label: "More",       icon: <MoreHorizontal size={16} /> },
];

export default function PharmacyDispensePage() {
  const { user } = useAuth();
  const [rxList, setRxList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<any>("/prescriptions?limit=30", user.token);
      setRxList(Array.isArray(res) ? res : (res.items ?? []));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user]);

  return (
    <PortalShell nav={NAV} title="Dispense Queue">
      {loading ? <Spinner text="Loading…" /> : error ? <ErrorBox message={error} retry={load} /> : (
        <DataTable
          rows={rxList}
          columns={[
            { key: "id",          label: "Rx ID" },
            { key: "patientName", label: "Patient" },
            { key: "doctorName",  label: "Doctor" },
            { key: "createdAt",   label: "Date", render: r => r.createdAt?.slice(0, 10) },
            { key: "status",      label: "Status", render: r => <Badge label={r.status} /> },
          ]}
          emptyText="Dispense queue is empty"
        />
      )}
    </PortalShell>
  );
}
