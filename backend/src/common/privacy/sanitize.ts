/**
 * Field-level response filters so API clients never receive secrets or
 * unnecessary internal fields (fcmToken, raw service-account material, etc.).
 */

const STRIP_ALWAYS = new Set([
  'password',
  'passwordHash',
  'hash',
  'salt',
  'fcmToken',
  'refreshToken',
  'privateKey',
  'FIREBASE_PRIVATE_KEY',
]);

export function stripSecrets<T extends Record<string, any>>(doc: T | null | undefined): Partial<T> | null {
  if (!doc) return null;
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (STRIP_ALWAYS.has(key)) continue;
    out[key] = value;
  }
  return out as Partial<T>;
}

/** Public doctor directory (patient booking) — no contact email/uid. */
export function publicDoctorView(doc: Record<string, any> | null | undefined) {
  if (!doc) return null;
  return {
    id: doc.id,
    name: doc.name,
    specialty: doc.specialty || doc.specialization || null,
    specialization: doc.specialization || doc.specialty || null,
    consultationFee: doc.consultationFee,
    qualifications: doc.qualifications ?? null,
    weeklySchedule: doc.weeklySchedule ?? undefined,
    hospitalId: doc.hospitalId ?? null,
  };
}

/** Staff doctor view — includes email for hospital ops. */
export function staffDoctorView(doc: Record<string, any> | null | undefined) {
  if (!doc) return null;
  return {
    ...publicDoctorView(doc),
    email: doc.email ?? null,
    uid: doc.uid ?? null,
    phone: doc.phone ?? null,
    commissionRate: doc.commissionRate ?? 0,
    creditBalance: doc.creditBalance ?? 0,
    createdAt: doc.createdAt ?? null,
  };
}

export function doctorViewForRole(doc: Record<string, any> | null | undefined, role: string) {
  if (role === 'patient') return publicDoctorView(doc);
  return staffDoctorView(doc);
}

/** User profile returned to the signed-in client. */
export function publicUserView(doc: Record<string, any> | null | undefined) {
  if (!doc) return null;
  return {
    uid: doc.uid,
    name: doc.name,
    email: doc.email,
    phone: doc.phone ?? null,
    role: doc.role,
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

/** Patient clinical record for authorized viewers (self or clinical staff). */
export function staffPatientView(doc: Record<string, any> | null | undefined) {
  if (!doc) return null;
  return stripSecrets(doc);
}

/** Supplier contact — strip nothing sensitive beyond secrets. */
export function supplierView(doc: Record<string, any> | null | undefined) {
  if (!doc) return null;
  return stripSecrets(doc);
}
