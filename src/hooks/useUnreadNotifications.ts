import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Unread activity for the bell (likes, comments, replies, follows, missed calls…), shared by every
 * bell / badge. Chat messages aren't counted: they have their own unread counts in Messages.
 */
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
        .eq("is_read", false)
        .neq("type", "message");
      return count ?? 0;
    },
    enabled: !!user,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    refetchOnWindowFocus: true,
  });

  // Opening Activity / Notifications counts as seeing them: the badge clears at once, and they're
  // marked read on the account, so it doesn't come back when the app is opened again.
  useEffect(() => {
    if (!user || !/^\/(activity|notifications)/.test(location.pathname)) return;
    queryClient.setQueryData(["unread-notifications", user.id], 0);
    supabase.from("notifications").update({ is_read: true })
      .eq("user_id", user.id).eq("is_read", false).neq("type", "message")
      .then(({ error }) => { if (!error) queryClient.invalidateQueries({ queryKey: ["unread-notifications", user.id] }); });
  }, [location.pathname, user, queryClient]);

  return user ? data : 0;
}
