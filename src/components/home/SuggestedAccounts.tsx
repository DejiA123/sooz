import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface Profile {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
}

export const SuggestedAccounts = () => {
    const { user } = useAuth();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchProfiles = async () => {
            try {
                // Fetch 5 random profiles (excluding current user)
                // Note: 'random' in SQL usually requires a function or loading more and shuffling
                // For MVP, we'll fetch latest 50 and shuffle client side, or just recent ones

                let query = supabase
                    .from('profiles')
                    .select('id, username, display_name, avatar_url')
                    .limit(20);

                if (user) {
                    query = query.neq('id', user.id);
                }

                const { data, error } = await query;

                if (error) throw error;

                if (data) {
                    // Simple shuffle and slice
                    const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, 5);
                    setProfiles(shuffled);
                }
            } catch (error) {
                console.error("Error fetching suggestions:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfiles();
    }, [user]);

    if (isLoading) return null; // Or skeleton
    if (profiles.length === 0) return null;

    return (
        <div className="hidden lg:block w-80 pl-8 fixed right-[calc(50%-45rem)] top-8 h-screen overflow-y-auto">
            {/* Note: positioning is tricky with mx-auto content. 
                 A simpler way is to put it in a flex container in Index.tsx
                 For now, let's just return the content content and handle layout in parent.
             */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-muted-foreground">Suggested for you</h2>
                    <Link to="/suggested-people">
                        <Button variant="link" className="text-xs text-primary p-0 h-auto">See All</Button>
                    </Link>
                </div>

                <div className="space-y-4">
                    {profiles.map((profile) => (
                        <div key={profile.id} className="flex items-center justify-between">
                            <Link to={`/profile/${profile.username}`} className="flex items-center gap-3 group">
                                <Avatar className="w-10 h-10 border border-white/10 group-hover:border-primary/50 transition-colors">
                                    <AvatarImage src={profile.avatar_url || ""} />
                                    <AvatarFallback>{(profile.display_name || profile.username)[0].toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold leading-none group-hover:text-primary transition-colors">
                                        {profile.username}
                                    </span>
                                    <span className="text-xs text-muted-foreground line-clamp-1">
                                        Suggested for you
                                    </span>
                                </div>
                            </Link>
                            <Button variant="link" size="sm" className="text-xs text-primary font-semibold hover:no-underline hover:text-primary/80">
                                Follow
                            </Button>
                        </div>
                    ))}
                </div>

                {/* Footer Links (Decoration) */}
                <div className="mt-8 pt-4 border-t border-white/5 text-xs text-muted-foreground space-y-2">
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                        <Link to="/about" className="hover:underline">About</Link><span>•</span>
                        <Link to="/help" className="hover:underline">Help</Link><span>•</span>
                        <Link to="/privacy" className="hover:underline">Privacy</Link><span>•</span>
                        <Link to="/terms" className="hover:underline">Terms</Link>
                    </div>
                    <p>© 2026 SOOZ</p>
                </div>
            </div>
        </div>
    );
};
