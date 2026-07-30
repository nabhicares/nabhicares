"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  browserSessionPersistence,
  onIdTokenChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { api, type Role } from "./api";
import { firebaseConfigError, getFirebaseAuth } from "./firebase";

export interface AuthUser {
  role: Role;
  email: string;
  displayName: string | null;
  hospitalName: string | null;
  /** Own records — the patient and doctor portals query by these instead of a fixed id. */
  patientId: string | null;
  doctorId: string | null;
  /** Firebase ID token, replaced in place as Firebase refreshes it. */
  token: string;
}

/** Shape of GET /me. */
interface Profile {
  role: Role;
  email: string | null;
  displayName: string | null;
  hospitalName: string | null;
  patientId: string | null;
  doctorId: string | null;
}

interface AuthCtx {
  user: AuthUser | null;
  /** False until the first session check finishes, so pages don't bounce to /login. */
  ready: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // A misconfigured build can never produce a session, so it starts out settled and failed
  // rather than leaving every page waiting on a check that will not happen.
  const misconfigured = firebaseConfigError();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(misconfigured !== null);
  const [error, setError] = useState(misconfigured ?? "");
  // Survives token refreshes so we do not re-hit /me on every onIdTokenChanged fire.
  const profileByUid = useRef<{ uid: string; profile: Omit<AuthUser, "token"> } | null>(null);

  useEffect(() => {
    if (misconfigured) return;
    const auth = getFirebaseAuth();
    // Firebase persists to IndexedDB by default, which would sign the next person at a
    // shared clinic machine straight back in.
    void setPersistence(auth, browserSessionPersistence);

    return onIdTokenChanged(auth, async (account: FirebaseUser | null) => {
      if (!account) {
        profileByUid.current = null;
        setUser(null);
        setReady(true);
        return;
      }
      try {
        const token = await account.getIdToken();
        const cached = profileByUid.current;
        if (cached && cached.uid === account.uid) {
          setUser({ ...cached.profile, token });
          setError("");
          setReady(true);
          return;
        }

        const profile = await api.get<Profile>("/me", token);
        const next: Omit<AuthUser, "token"> = {
          role: profile.role,
          email: profile.email ?? account.email ?? "",
          displayName: profile.displayName,
          hospitalName: profile.hospitalName,
          patientId: profile.patientId,
          doctorId: profile.doctorId,
        };
        profileByUid.current = { uid: account.uid, profile: next };
        setUser({ ...next, token });
        setError("");
      } catch (e) {
        // The credentials are valid to Firebase but the API has no active user for them.
        // Staying signed in would leave every page failing, so end the session here.
        profileByUid.current = null;
        await signOut(auth);
        setUser(null);
        setError(
          e instanceof Error && e.message
            ? `Signed in, but the API rejected this account: ${e.message}`
            : "Signed in, but this account has no portal access.",
        );
      } finally {
        setReady(true);
      }
    });
  }, [misconfigured]);

  const login = useCallback(async (email: string, password: string) => {
    setError("");
    const auth = getFirebaseAuth();
    await setPersistence(auth, browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email.trim(), password);
    // onIdTokenChanged resolves the role and fills in `user`.
  }, []);

  const logout = useCallback(async () => {
    profileByUid.current = null;
    await signOut(getFirebaseAuth());
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, ready, error, login, logout }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

/** Landing page per role, shared by the login redirect and the portal guard. */
export const HOME: Record<Role, string> = {
  patient: "/portal/patient/home",
  doctor: "/portal/doctor/dashboard",
  receptionist: "/portal/reception/patients",
  pharmacist: "/portal/pharmacy/dispense",
  hospital_admin: "/portal/admin/overview",
  super_admin: "/portal/admin/overview",
};
