import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchFollowingIds } from "@/services/api/posts";

/** Who the viewer follows, shared across every slide so follow buttons stay in sync. */
export function useFollowing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = useMemo(() => ["following-ids", user?.id], [user?.id]);

  const { data } = useQuery({
    queryKey: key,
    queryFn: () => fetchFollowingIds(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
  const ids = useMemo(() => new Set(data || []), [data]);

  const follow = useCallback(async (targetId: string) => {
    if (!user || targetId === user.id) return;
    queryClient.setQueryData<string[]>(key, (prev = []) => [...new Set([...prev, targetId])]);
    const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: targetId });
    if (error && error.code !== "23505") {
      queryClient.setQueryData<string[]>(key, (prev = []) => prev.filter((id) => id !== targetId));
      toast.error("Couldn't follow right now");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["feed", "following"] });
    queryClient.invalidateQueries({ queryKey: ["stories"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] }); // follower / following counts
  }, [user, key, queryClient]);

  const unfollow = useCallback(async (targetId: string) => {
    if (!user) return;
    queryClient.setQueryData<string[]>(key, (prev = []) => prev.filter((id) => id !== targetId));
    const { error } = await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetId);
    if (error) {
      queryClient.setQueryData<string[]>(key, (prev = []) => [...new Set([...prev, targetId])]);
      toast.error("Couldn't unfollow right now");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["feed", "following"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }, [user, key, queryClient]);

  return {
    isFollowing: (id: string) => ids.has(id),
    canFollow: (id: string) => !!user && user.id !== id,
    follow,
    unfollow,
  };
}
