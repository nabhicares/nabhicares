"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getAuth, type Auth } from "firebase/auth";

// Firebase's web config identifies the project; it is not a credential. It is compiled
// into every browser bundle no matter where it is stored, and access is enforced by
// Firebase Auth plus the API's user records. Keeping it here means a deploy needs no
// build-time environment setup, while NEXT_PUBLIC_FIREBASE_* still overrides it.
const NABHI_CARES = {
  apiKey: "AIzaSyDO2z6b2FUCzvCn6ET9nRZTc2pmFa80YSk",
  authDomain: "nabhi-cares.firebaseapp.com",
  projectId: "nabhi-cares",
  storageBucket: "nabhi-cares.firebasestorage.app",
  messagingSenderId: "177244651907",
  appId: "1:177244651907:web:062bf16c626e027bc636b6",
  measurementId: "G-W1GDYL9PZ2",
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? NABHI_CARES.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? NABHI_CARES.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? NABHI_CARES.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? NABHI_CARES.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? NABHI_CARES.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? NABHI_CARES.appId,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? NABHI_CARES.measurementId,
};

/**
 * Why the config cannot be used, or null when it can. Reads no browser API, so callers can
 * check this during a server render — unlike getFirebaseAuth, which must stay client-only.
 */
export function firebaseConfigError(): string | null {
  const missing = (["apiKey", "projectId", "appId"] as const).filter((key) => !firebaseConfig[key]);
  return missing.length ? `Firebase web config is missing ${missing.join(", ")}` : null;
}

function requireConfig() {
  const problem = firebaseConfigError();
  if (problem) throw new Error(problem);
  return firebaseConfig as Required<typeof firebaseConfig>;
}

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length) return getApps()[0]!;
  return initializeApp(requireConfig());
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

let analyticsPromise: Promise<Analytics | null> | null = null;

export function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!analyticsPromise) {
    analyticsPromise = isSupported().then((ok) =>
      ok ? getAnalytics(getFirebaseApp()) : null,
    );
  }
  return analyticsPromise;
}
