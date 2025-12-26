import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const usePrefetch = () => {
    const queryClient = useQueryClient();

    const prefetchProfile = async (username: string) => {
        if (!username) return;

        // 1. Prefetch Profile Data
        await queryClient.prefetchQuery({
            queryKey: ['profile', username],
            queryFn: async () => {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('username', username)
                    .single();
                if (error) throw error;
                return data;
            },
            staleTime: 1000 * 60 * 5 // 5 mins
        });
    };

    const prefetchFeed = async () => {
        // Prefetch logic for feed (optional)
        // Usually handled by Feed component automatically, 
        // but could be useful if navigating from elsewhere
    };

    return {
        prefetchProfile,
        prefetchFeed
    };
};
