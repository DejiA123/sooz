import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
    const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

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

    const handleFollow = async (profileId: string) => {
        if (!user) {
            toast.error("You must be logged in to follow");
            return;
        }

        try {
            const { error } = await supabase.from('follows').insert({
                follower_id: user.id,
                following_id: profileId
            });
            if (error) throw error;

            setFollowedIds(prev => new Set(prev).add(profileId));
        } catch (error) {
            toast.error("Failed to follow user");
            console.error(error);
        }
    };

    return (
        <div className="w-full space-y-8 animate-fade-in pl-6 pt-4">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-[14px] font-display font-bold text-muted-foreground/50 tracking-tight uppercase">Suggested for you</h2>
                    <Link to="/suggested-people">
                        <Button variant="link" className="text-xs text-primary font-bold p-0 h-auto hover:no-underline hover:opacity-70 transition-opacity">See All</Button>
                    </Link>
                </div>

                <div className="space-y-5">
                    {profiles.map((profile) => (
                        <div key={profile.id} className="flex items-center justify-between group">
                            <Link to={`/profile/${profile.username}`} className="flex items-center gap-3">
                                <Avatar className="w-10 h-10 ring-2 ring-primary/5 group-hover:ring-primary/20 transition-all duration-300">
                                    <AvatarImage src={profile.avatar_url || ""} className="object-cover" />
                                    <AvatarFallback className="bg-secondary text-secondary-foreground font-bold">{(profile.display_name || profile.username)[0].toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="text-[14px] font-bold leading-none tracking-tight group-hover:text-primary transition-colors">
                                        {profile.username}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground/60 font-medium">
                                        Popular choice
                                    </span>
                                </div>
                            </Link>
                            <button
                                className={cn(
                                    "text-[12px] font-bold transition-all px-3 py-1.5 rounded-lg",
                                    followedIds.has(profile.id)
                                        ? "text-foreground bg-secondary hover:bg-secondary/80 border border-white/5"
                                        : "text-primary hover:text-primary/70 hover:bg-primary/5"
                                )}
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleFollow(profile.id);
                                }}
                                disabled={followedIds.has(profile.id)}
                            >
                                {followedIds.has(profile.id) ? "Following" : "Follow"}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Footer Links (Decoration) */}
                <div className="pt-8 border-t border-white/5 text-[11px] font-medium text-muted-foreground/40 space-y-3">
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5 uppercase tracking-widest">
                        <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
                        <Link to="/help" className="hover:text-foreground transition-colors">Help</Link>
                        <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
                        <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                    </div>
                    <p className="font-bold tracking-tight">© 2026 SOOZ SOCIAL TECHNOLOGY</p>
                </div>
            </div>
        </div>
    );
};
