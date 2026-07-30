/**
 * Boot-time environment validation.
 * Production refuses to start without critical Firebase + auth secrets,
 * unless ALLOW_DEMO_MODE=true (intentional demo / broken-credential fallback).
 */

/** True only for real production (not local, not Vercel preview). */
export function isProductionRuntime(): boolean {
  if (process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development') {
    return false;
  }
  if (process.env.VERCEL_ENV === 'production') {
    return true;
  }
  return process.env.NODE_ENV === 'production' && !process.env.VERCEL;
}

/**
 * Explicit demo escape hatch: mock auth + in-memory DB + seed allowed even on Vercel production.
 * Use only while Firebase credentials are broken / for APK demos.
 */
export function isDemoMode(): boolean {
  return (
    process.env.ALLOW_DEMO_MODE?.trim() === 'true' ||
    process.env.ALLOW_MOCK_AUTH?.trim() === 'true'
  );
}

export function assertCriticalEnv(): void {
  const missing: string[] = [];
  const fatal: string[] = [];

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  const bootstrapSecret = process.env.BOOTSTRAP_SECRET?.trim();
  const corsOrigins = process.env.CORS_ORIGINS?.trim();
  const demo = isDemoMode();

  if (isProductionRuntime() && !demo) {
    if (!projectId) missing.push('FIREBASE_PROJECT_ID');
    if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
    if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
    if (!bootstrapSecret) missing.push('BOOTSTRAP_SECRET');

    if (privateKey?.includes('MOCK_KEY') || privateKey?.includes('YOUR_PRIVATE_KEY')) {
      fatal.push('FIREBASE_PRIVATE_KEY looks like a placeholder / mock key');
    }
    if (bootstrapSecret && bootstrapSecret.length < 16) {
      fatal.push('BOOTSTRAP_SECRET must be at least 16 characters');
    }
  } else {
    if (demo && isProductionRuntime()) {
      console.warn(
        '[env] ALLOW_DEMO_MODE/ALLOW_MOCK_AUTH enabled on production — using demo auth/DB path.',
      );
    }
    if (!projectId || !clientEmail || !privateKey) {
      console.warn(
        '[env] FIREBASE_* incomplete — may use the in-memory mock store. ' +
          'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY for real data.',
      );
    }
    if (!bootstrapSecret) {
      console.warn(
        '[env] BOOTSTRAP_SECRET is unset — bootstrap stays open only until a super_admin exists.',
      );
    }
  }

  // CORS still required on production hosts (demo or not) to avoid accidental *.
  if (isProductionRuntime() && !corsOrigins) {
    missing.push(
      'CORS_ORIGINS (comma-separated frontend origins, or "none" for mobile-only APIs)',
    );
  }

  if (missing.length || fatal.length) {
    const lines = [
      'Refusing to start: critical configuration is invalid.',
      ...missing.map((m) => `  • Missing: ${m}`),
      ...fatal.map((f) => `  • ${f}`),
      'Set these in backend/.env (local) or your host environment (Vercel).',
    ];
    throw new Error(lines.join('\n'));
  }
}

/** Parsed CORS allow-list. "none" => no browser origins (mobile clients OK). */
export function getCorsOrigins(): string[] | false {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw || raw.toLowerCase() === 'none') {
    return false;
  }
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
