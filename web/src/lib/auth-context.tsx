"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { type Role, makeToken } from "./api";

export interface AuthUser {
  role: Role;
  email: string;
  token: string;
}

interface AuthCtx {
  user: AuthUser | null;
  login: (role: Role, email: string) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

const KEY = "cf_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  function login(role: Role, email: string) {
    const u: AuthUser = { role, email, token: makeToken(role) };
    sessionStorage.setItem(KEY, JSON.stringify(u));
    setUser(u);
  }

  function logout() {
    sessionStorage.removeItem(KEY);
    setUser(null);
  }

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
