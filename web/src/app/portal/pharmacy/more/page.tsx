"use client";

import { useRouter } from "next/navigation";
import PortalShell from "@/components/portal-shell";
import { useAuth } from "@/lib/auth-context";
import { Package, Pill, ShoppingCart, MoreHorizontal, LogOut } from "lucide-react";

const NAV = [
  { href: "/portal/pharmacy/dispense",  label: "Dispense",  icon: <Pill size={16} /> },
  { href: "/portal/pharmacy/medicines", label: "Medicines", icon: <Package size={16} /> },
  { href: "/portal/pharmacy/purchases", label: "Purchases", icon: <ShoppingCart size={16} /> },
  { href: "/portal/pharmacy/more",      label: "More",      icon: <MoreHorizontal size={16} /> },
];

export default function PharmacyMorePage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  return (
    <PortalShell nav={NAV} title="More">
      <div className="max-w-sm space-y-4">
        <div className="bg-white rounded-2xl border border-[#E5E8EF] p-5">
          <p className="text-sm font-semibold text-[#0D1B35]">{user?.email}</p>
          <p className="text-xs text-[#6B7891] mt-1 capitalize">Pharmacist</p>
        </div>
        <button
          onClick={() => { logout(); router.push("/login"); }}
          className="flex items-center gap-2 w-full bg-red-50 text-red-600 font-medium text-sm px-4 py-3 rounded-xl border border-red-200 hover:bg-red-100 transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </PortalShell>
  );
}
