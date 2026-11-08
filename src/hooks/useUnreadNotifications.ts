import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Unread notification count for the signed-in user, shared by every bell/badge in the app. */
export function useUnreadNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const key = ["unread-notifications", user?.id];

  const { data = 0 } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      return count ?? 0;
    },
    enabled: !!user,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    refetchOnWindowFocus: true,
  });

  // Opening Activity/Notifications marks things as seen, so clear the badge right away.
  useEffect(() => {
    if (user && /^\/(activity|notifications)/.test(location.pathname)) {
      queryClient.setQueryData(["unread-notifications", user.id], 0);
    }
  }, [location.pathname, user, queryClient]);

  return user ? data : 0;
}
