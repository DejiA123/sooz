import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { completeOAuthRedirect } from "@/lib/authProviders";
import { completeNewProfile } from "@/lib/profileSetup";
import { useQueryClient } from "@tanstack/react-query";

export const AuthListener = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Coming back from Google (or an emailed sign-in link): finish signing in.
    useEffect(() => {
        completeOAuthRedirect().then((error) => { if (error) toast.error(`Sign-in failed: ${error}`); });
    }, []);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "PASSWORD_RECOVERY") {
                navigate("/update-password");
            }
            // New Google / email-code members: fill in their name, photo and username once.
            if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
                const user = session.user;
                // Run outside the auth callback (Supabase recommends not awaiting inside it).
                setTimeout(() => {
                    completeNewProfile(user).then(() => {
                        queryClient.invalidateQueries({ queryKey: ["nav-profile", user.id] });
                        queryClient.invalidateQueries({ queryKey: ["profile"] });
                    });
                }, 0);
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate, queryClient]);

    return null;
};
