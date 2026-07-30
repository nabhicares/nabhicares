"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Spinner from "@/components/spinner";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface Props {
  nav: NavItem[];
  children: React.ReactNode;
  title: string;
}

export default function PortalShell({ nav, children, title }: Props) {
  const { user, ready, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  // Rendering the portal before the session is known would fire every request without a
  // token, and each page would flash its own 401.
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB]">
        <Spinner text={ready ? "Redirecting to sign in…" : "Checking your session…"} />
      </div>
    );
  }

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 px-5 py-6 border-b border-[#E5E8EF]">
        <div className="size-9 rounded-xl bg-[#0C6EFD] flex items-center justify-center">
          <span className="text-white text-sm font-bold">CF</span>
        </div>
        <div>
          <div className="font-semibold text-sm text-[#0D1B35]">CareFlow</div>
          <div className="text-xs text-[#6B7891] capitalize">{user?.role?.replace("_", " ")}</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? "bg-[#0C6EFD] text-white"
                  : "text-[#6B7891] hover:text-[#0D1B35] hover:bg-white"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-[#E5E8EF]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-[#DC2626] hover:bg-red-50 transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FB]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-56 bg-white border-r border-[#E5E8EF] shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-56 bg-white flex flex-col shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-5 h-14 bg-white border-b border-[#E5E8EF] shrink-0">
          <button
            className="md:hidden text-[#6B7891] hover:text-[#0D1B35]"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="text-sm font-semibold text-[#0D1B35]">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-[#6B7891] hidden sm:block">
              {user.displayName ?? user.email}
            </span>
            <div className="size-7 rounded-full bg-[#0C6EFD]/10 flex items-center justify-center">
              <span className="text-[10px] font-bold text-[#0C6EFD] uppercase">
                {(user.displayName ?? user.email)?.[0] ?? "U"}
              </span>
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-5">{children}</main>
      </div>
    </div>
  );
}
