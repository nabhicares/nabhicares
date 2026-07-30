"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { HOME, useAuth } from "@/lib/auth-context";
import Spinner from "@/components/spinner";
import type { Role } from "@/lib/api";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface Props {
  nav: NavItem[];
  children: React.ReactNode;
  title: string;
  /** When set, signed-in users with another role are sent to their home. */
  requireRole?: Role;
  hospitalSubtitle?: string | null;
}

export default function PortalShell({
  nav,
  children,
  title,
  requireRole,
  hospitalSubtitle,
}: Props) {
  const { user, ready, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (requireRole && user.role !== requireRole) {
      router.replace(HOME[user.role] ?? "/login");
    }
  }, [ready, user, router, requireRole]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (!user || (requireRole && user.role !== requireRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Spinner text={ready ? "Redirecting…" : "Checking your session…"} />
      </div>
    );
  }

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 px-5 py-6 border-b border-border">
        <div className="size-9 rounded-xl bg-brand flex items-center justify-center">
          <span className="text-white text-sm font-bold">CF</span>
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm text-ink truncate">CareFlow</div>
          <div className="text-xs text-muted truncate">
            {hospitalSubtitle ?? user.role.replaceAll("_", " ")}
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/portal/patient/home" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? "bg-brand text-white"
                  : "text-muted hover:text-ink hover:bg-white"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-danger hover:bg-red-50 transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <aside className="hidden md:flex md:flex-col w-56 bg-white border-r border-border shrink-0">
        <SidebarContent />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-56 bg-white flex flex-col shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center gap-4 px-5 h-14 bg-white border-b border-border shrink-0">
          <button
            className="md:hidden text-muted hover:text-ink"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="text-sm font-semibold text-ink">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted hidden sm:block">
              {user.displayName ?? user.email}
            </span>
            <div className="size-7 rounded-full bg-brand/10 flex items-center justify-center">
              <span className="text-[10px] font-bold text-brand uppercase">
                {(user.displayName ?? user.email)?.[0] ?? "U"}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5">{children}</main>
      </div>
    </div>
  );
}
