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

/** Emails a one-time sign-in code (and link) to an existing account. */
export async function sendEmailCode(email: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/` },
  });
  return error ? { error: friendlyOtpError(error.message) } : {};
}

export async function verifyEmailCode(email: string, code: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
  return error ? { error: friendlyOtpError(error.message) } : {};
}
