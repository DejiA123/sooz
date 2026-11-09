import { useAuth } from "@/hooks/useAuth";

/**
 * SOOZ's admins (their account ids, so no email address sits in the public code). Admin-only
 * screens, like the Christian TikTok library manager, are hidden from everyone else.
 */
const ADMIN_IDS = new Set(["30a23fee-dcc0-49fd-82c9-a3b2a7fa3927"]); // deji

export const isAdmin = (userId?: string | null) => !!userId && ADMIN_IDS.has(userId);

export function useIsAdmin() {
  const { user, loading } = useAuth();
  return { isAdmin: isAdmin(user?.id), loading };
}
