import {
  Bell,
  CalendarDays,
  FileText,
  Home,
  UserRound,
} from "lucide-react";
import type { NavItem } from "@/components/portal-shell";

/** Flutter patient bottom tabs, adapted to the desktop sidebar. */
export const PATIENT_NAV: NavItem[] = [
  { href: "/portal/patient/home", label: "Home", icon: <Home size={16} /> },
  { href: "/portal/patient/appointments", label: "Bookings", icon: <CalendarDays size={16} /> },
  { href: "/portal/patient/prescriptions", label: "Rx", icon: <FileText size={16} /> },
  { href: "/portal/patient/alerts", label: "Alerts", icon: <Bell size={16} /> },
  { href: "/portal/patient/profile", label: "Profile", icon: <UserRound size={16} /> },
];
