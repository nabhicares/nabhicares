/**
 * Thin API client for the shared Nabhi Care API (web + mobile).
 * Bearer token = "mock-{role}" (demo mode) or a real Firebase ID token.
 */

// A trailing slash here would produce "//path", which Vercel answers with a 308.
// Browsers refuse redirects on CORS preflight, so the request fails before it is sent.
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(
  /\/+$/,
  "",
);

// Seeded by backend-fastapi/scripts/seed_demo_hospital.py — required for mock-auth tenant scope.
const HOSPITAL_ID =
  process.env.NEXT_PUBLIC_HOSPITAL_ID ?? "11111111-1111-1111-1111-111111111111";

export type Role =
  | "patient"
  | "doctor"
  | "receptionist"
  | "pharmacist"
  | "hospital_admin"
  | "super_admin";

export function makeToken(role: Role): string {
  return `mock-${role}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Hospital-ID": HOSPITAL_ID,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({
    success: false,
    error: { message: "Non-JSON response" },
  }));
  if (!res.ok || !json.success) {
    throw new ApiError(res.status, json?.error?.message ?? "Request failed");
  }
  return json.data as T;
}

export const api = {
  get: <T>(path: string, token: string) => call<T>("GET", path, token),
  post: <T>(path: string, token: string, body?: unknown) => call<T>("POST", path, token, body),
  patch: <T>(path: string, token: string, body?: unknown) => call<T>("PATCH", path, token, body),
  put: <T>(path: string, token: string, body?: unknown) => call<T>("PUT", path, token, body),
};
