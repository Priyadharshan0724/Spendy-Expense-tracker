/**
 * firebase.js — Spendly
 * ─────────────────────────────────────────────────────────────────
 * Firebase Authentication with Google Sign-In.
 *
 * HOW TO SET UP:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project (or use an existing one)
 * 3. Go to Project Settings → General → Your apps → Add Web App
 * 4. Copy the firebaseConfig object and paste it below
 * 5. In Firebase Console → Authentication → Sign-in method → Enable Google
 * 6. In Authentication → Settings → Authorized domains → Add your domain
 * ─────────────────────────────────────────────────────────────────
 */

import { initializeApp }          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
                                   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── YOUR FIREBASE CONFIG ──────────────────────────────────────────
// Replace ALL values below with your own from Firebase Console.
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
// ─────────────────────────────────────────────────────────────────

// ── DETECT IF CONFIG IS REAL ──────────────────────────────────────
const isConfigured = (
  firebaseConfig.apiKey    !== "YOUR_API_KEY" &&
  firebaseConfig.projectId !== "YOUR_PROJECT_ID" &&
  firebaseConfig.apiKey    !== "" &&
  firebaseConfig.projectId !== ""
);

// ── INITIALISE ───────────────────────────────────────────────────
let auth     = null;
let provider = null;

if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    auth      = getAuth(app);
    provider  = new GoogleAuthProvider();

    // Always show the Google account chooser
    provider.setCustomParameters({ prompt: "select_account" });

    console.log("[Spendly] Firebase initialised ✓");
  } catch (err) {
    console.error("[Spendly] Firebase init failed:", err);
  }
} else {
  console.warn(
    "[Spendly] Firebase not configured. " +
    "Edit firebase.js and add your project credentials to enable Google Sign-In."
  );
}

// ── PUBLIC API ────────────────────────────────────────────────────
// These functions are consumed by app.js via window globals.

/**
 * Sign in with a Google popup.
 * Returns a Promise<UserCredential>.
 * Throws if Firebase is not configured or the popup is blocked/cancelled.
 */
export async function signInWithGoogle() {
  if (!auth || !provider) {
    throw new Error("Firebase is not configured. See firebase.js for setup instructions.");
  }
  return signInWithPopup(auth, provider);
}

/**
 * Sign out the current user.
 * Returns a Promise<void>.
 */
export async function signOutUser() {
  if (!auth) return;
  return signOut(auth);
}

/**
 * Subscribe to auth state changes.
 * @param {function} callback - Called with (user | null) on every auth state change.
 * @returns Unsubscribe function.
 */
export function onAuthChange(callback) {
  if (!auth) {
    // No Firebase — immediately call back with null so app can handle demo mode
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

// Expose to app.js (since both are ES modules, we can import directly)
export { isConfigured };
