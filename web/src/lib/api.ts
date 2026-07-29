/**
 * Thin API client — wraps CareFlow NestJS backend.
 * Bearer token = "mock-{role}" (demo mode) or real Firebase ID token.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://pharma-store-api.vercel.app/api/v1";

export type Role = "patient" | "doctor" | "receptionist" | "pharmacist" | "hospital_admin" | "super_admin";

export function makeToken(role: Role): string {
  return `mock-${role}`;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(method: string, path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({ success: false, error: { message: "Non-JSON response" } }));
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
