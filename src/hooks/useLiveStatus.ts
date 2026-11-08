import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** True while the church is streaming live. Cheap check — the heavy player only loads when opened. */
export function useLiveStatus() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["live-status"],
    queryFn: async () => {
      const { data } = await supabase.from("live_stream_config").select("id").eq("status", "live").limit(1).maybeSingle();
      return !!data;
    },
    staleTime: 1000 * 60,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`live-status:${crypto.randomUUID().slice(0, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_stream_config" }, () =>
        queryClient.invalidateQueries({ queryKey: ["live-status"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return data ?? false;
}
