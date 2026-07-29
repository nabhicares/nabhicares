"use client";

import { useRouter } from "next/navigation";
import PortalShell from "@/components/portal-shell";
import { useAuth } from "@/lib/auth-context";
import { LayoutDashboard, Users, CalendarDays, MoreHorizontal, LogOut } from "lucide-react";

const NAV = [
  { href: "/portal/doctor/dashboard",    label: "Dashboard",    icon: <LayoutDashboard size={16} /> },
  { href: "/portal/doctor/patients",     label: "My Patients",  icon: <Users size={16} /> },
  { href: "/portal/doctor/appointments", label: "Appointments", icon: <CalendarDays size={16} /> },
  { href: "/portal/doctor/more",         label: "More",         icon: <MoreHorizontal size={16} /> },
];

export default function DoctorMorePage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  return (
    <PortalShell nav={NAV} title="More">
      <div className="max-w-sm space-y-4">
        <div className="bg-white rounded-2xl border border-[#E5E8EF] p-5">
          <p className="text-sm font-semibold text-[#0D1B35]">{user?.email}</p>
          <p className="text-xs text-[#6B7891] mt-1 capitalize">Doctor</p>
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
