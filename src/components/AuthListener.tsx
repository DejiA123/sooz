import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { completeOAuthRedirect } from "@/lib/authProviders";

export const AuthListener = () => {
    const navigate = useNavigate();

    // Coming back from Google (or an emailed sign-in link): finish signing in.
    useEffect(() => {
        completeOAuthRedirect().then((error) => { if (error) toast.error(`Sign-in failed: ${error}`); });
    }, []);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "PASSWORD_RECOVERY") {
                navigate("/update-password");
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate]);

    return null;
};
