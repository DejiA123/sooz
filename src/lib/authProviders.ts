import { supabase } from "@/integrations/supabase/client";

/**
 * Google sign-in.
 * On Lovable hosting (*.lovable.app) Google is handled by Lovable Cloud's managed OAuth broker at
 * `/~oauth/initiate` (the same redirect @lovable.dev/cloud-auth-js performs in a normal tab); it
 * sends the user back with the session tokens in the URL hash, which `completeOAuthRedirect` picks up.
 * Anywhere else (e.g. the Vercel copy) we use Supabase's own Google provider.
 */
const LOVABLE_HOSTS = [".lovable.app", ".lovableproject.com"];

const usesLovableBroker = () => LOVABLE_HOSTS.some((h) => window.location.hostname.endsWith(h));

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://xhqpojnmcibkaydidnex.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocXBvam5tY2lia2F5ZGlkbmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMjAzNTcsImV4cCI6MjA4MDg5NjM1N30.DkKg7S_xOEyGR2R9TtjBKzqoDACzZUYkA8BcFw6qylw";
let googleCheck: Promise<boolean> | null = null;

/**
 * Can this web address sign in with Google? Always on Lovable hosting (Lovable's broker). Elsewhere
 * only once Google is switched on in Supabase (Authentication → Providers) — asked from Supabase's
 * public settings, so the button appears by itself the moment it's enabled.
 */
export function googleAvailable(): Promise<boolean> {
  if (usesLovableBroker()) return Promise.resolve(true);
  googleCheck ??= fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { external?: { google?: boolean } } | null) => (d ? !!d.external?.google : true))
    .catch(() => true);
  return googleCheck;
}

const randomState = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
};

export async function signInWithGoogle(): Promise<{ error?: string }> {
  let framed = false;
  try { framed = window.self !== window.top; } catch { framed = true; }
  if (framed) return { error: "Open SOOZ in its own tab to sign in with Google." };

  const redirect = `${window.location.origin}/`;

  if (usesLovableBroker()) {
    const params = new URLSearchParams({ provider: "google", redirect_uri: redirect, state: randomState() });
    window.location.assign(`/~oauth/initiate?${params}`);
    return {};
  }

  // Supabase would show a raw error page if Google isn't switched on, so check first.
  if (!(await googleAvailable())) {
    return { error: "Google sign-in isn't switched on for this web address yet — please use your email for now." };
  }
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect } });
  if (error) {
    if (/not enabled|unsupported provider/i.test(error.message)) {
      return { error: "Google sign-in isn't switched on for this web address yet. Use sooz.lovable.app, or sign in with your email." };
    }
    return { error: error.message };
  }
  return {};
}

/**
 * Finishes a Google (or email-link) sign-in when the browser comes back with tokens in the URL.
 * Supabase usually handles this itself; this covers the cases it doesn't, then tidies the address bar.
 * Returns an error message to show, if the provider sent one back.
 */
export async function completeOAuthRedirect(): Promise<string | null> {
  const hash = window.location.hash.replace(/^#/, "");
  if (!/(access_token|error)=/.test(hash) && !/[?&]error_description=/.test(window.location.search)) return null;

  // Let Supabase finish its own URL handling first.
  const { data } = await supabase.auth.getSession();
  const params = new URLSearchParams(hash || window.location.search.replace(/^\?/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const error = params.get("error_description") || params.get("error");

  const clean = () => window.history.replaceState(window.history.state, "", window.location.pathname);

  if (error) {
    clean();
    return error.replace(/\+/g, " ");
  }
  if (accessToken && refreshToken && data.session?.access_token !== accessToken) {
    const { error: setError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    clean();
    return setError ? "Sign-in didn't finish. Please try again." : null;
  }
  clean();
  return null;
}

// ── Email passcode (one-time code) ────────────────────────────────────────────

const friendlyOtpError = (message: string) => {
  if (/signups? not allowed|user not found/i.test(message)) return "No SOOZ account uses this email yet. Tap Sign Up to create one.";
  if (/expired|invalid/i.test(message)) return "That code is wrong or has expired. Check the latest email or send a new code.";
  if (/rate limit|security purposes|seconds/i.test(message)) return "Please wait a moment before asking for another code.";
  return message;
};

/**
 * Emails a one-time code (and link). Without `signup` it only signs in an existing account; with it,
 * a new account is created with that username when the code is entered (an existing account just
 * signs in). New members are confirmed automatically, so the code is all they need.
 */
export async function sendEmailCode(email: string, signup?: { username: string; displayName: string }): Promise<{ error?: string }> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: !!signup,
      emailRedirectTo: `${window.location.origin}/`,
      ...(signup && { data: { username: signup.username, display_name: signup.displayName || signup.username } }),
    },
  });
  if (error && !signup && /signups? not allowed|user not found/i.test(error.message)) {
    return { error: "There's no SOOZ account for that email yet — tap Sign Up to join." };
  }
  return error ? { error: friendlyOtpError(error.message) } : {};
}

/** Is this username already someone's? (Checked before sign-up, so it never fails half-way.) */
export async function usernameTaken(username: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("id").ilike("username", username.trim()).limit(1);
  return !!data?.length;
}

export async function verifyEmailCode(email: string, code: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
  return error ? { error: friendlyOtpError(error.message) } : {};
}
