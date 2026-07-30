"use client";

import { useRouter } from "next/navigation";
import PortalShell from "@/components/portal-shell";
import UiCard from "@/components/ui-card";
import PrimaryButton from "@/components/primary-button";
import { useAuth } from "@/lib/auth-context";
import { PATIENT_NAV } from "@/lib/patient-nav";

export default function PatientProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  return (
    <PortalShell
      nav={PATIENT_NAV}
      title="Profile"
      requireRole="patient"
      hospitalSubtitle={user?.hospitalName}
    >
      <div className="mx-auto max-w-lg space-y-4">
        <UiCard>
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-full bg-brand/10 flex items-center justify-center">
              <span className="text-lg font-bold text-brand uppercase">
                {(user?.displayName ?? user?.email)?.[0] ?? "P"}
              </span>
            </div>
            <div>
              <p className="font-semibold text-ink text-lg">
                {user?.displayName ?? "Patient"}
              </p>
              <p className="text-sm text-muted">{user?.email}</p>
            </div>
          </div>

          <dl className="mt-5 space-y-3 text-sm border-t border-border pt-4">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Role</dt>
              <dd className="font-medium capitalize text-ink">Patient</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Hospital</dt>
              <dd className="font-medium text-ink text-right">
                {user?.hospitalName ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">MRN</dt>
              <dd className="font-medium text-ink">{user?.patientId ?? "—"}</dd>
            </div>
          </dl>
        </UiCard>

        <UiCard>
          <p className="text-sm font-semibold text-ink">Close account</p>
          <p className="text-sm text-muted mt-1">
            Contact the hospital desk to close your portal access. Self-service delete is
            disabled on the web.
          </p>
        </UiCard>

        <PrimaryButton variant="danger" className="w-full" onClick={() => void signOut()}>
          Sign out
        </PrimaryButton>
      </div>
    </PortalShell>
  );
}
