import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { X } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { notifyActivity } from "@/lib/push";

interface Profile {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
}

export const SuggestedUsersRail = () => {
    const { user } = useAuth();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
    const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfiles = async () => {
            try {
                // Fetch random profiles
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
                    // Start from a random offset or shuffle
                    const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, 10);
                    setProfiles(shuffled);
                }
            } catch (error) {
                console.error("Error fetching suggestions:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfiles();
    }, [user]);

    const handleFollow = async (profileId: string) => {
        if (!user) return;
        try {
            const { error } = await supabase.from('follows').insert({
                follower_id: user.id,
                following_id: profileId
            });
            if (error) throw error;
            notifyActivity();
            // Update button state to show following
            setFollowedIds(prev => new Set(prev).add(profileId));
        } catch (error) {
            toast.error("Failed to follow");
        }
    };

    const handleDismiss = (id: string) => {
        setHiddenIds(prev => new Set(prev).add(id));
    };

    const visibleProfiles = profiles.filter(p => !hiddenIds.has(p.id));

    if (loading) {
        return (
            <div className="w-full space-y-4 py-3">
                <div className="flex items-center justify-between px-1">
                    <div className="h-4 w-32 bg-secondary animate-pulse rounded" />
                    <div className="h-4 w-12 bg-secondary animate-pulse rounded" />
                </div>
                <div className="flex space-x-3 overflow-hidden">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="w-[160px] h-[220px] rounded-xl border border-border bg-card animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (visibleProfiles.length === 0) return null;

    return (
        <div className="w-full space-y-4 py-3">
            <div className="flex items-center justify-between px-1">
                <h3 className="font-display font-bold text-[15px] tracking-tight">Suggested for you</h3>
                <Link to="/suggested-people" className="text-sm font-bold text-primary hover:opacity-80 transition-opacity">
                    See all
                </Link>
            </div>

            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-4 pb-4 px-1">
                    {visibleProfiles.map((profile) => (
                        <div
                            key={profile.id}
                            className="w-[180px] h-[240px] rounded-[2rem] border border-white/5 bg-card relative flex flex-col items-center p-5 gap-4 shrink-0 shadow-premium group transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
                        >
                            <button
                                onClick={() => handleDismiss(profile.id)}
                                className="absolute top-4 right-4 text-muted-foreground/30 hover:text-foreground p-1 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            <Link to={`/profile/${profile.username}`} className="flex flex-col items-center gap-3 w-full mt-2">
                                <Avatar className="w-20 h-20 ring-4 ring-primary/5 group-hover:ring-primary/20 transition-all duration-500">
                                    <AvatarImage src={profile.avatar_url || ""} className="object-cover" />
                                    <AvatarFallback className="text-xl bg-primary/5 text-primary font-bold">{profile.username[0].toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="text-center w-full space-y-0.5">
                                    <p className="font-display font-bold text-[14px] truncate w-full px-1 leading-tight tracking-tight">
                                        {profile.display_name || profile.username}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground/60 font-medium truncate w-full px-1">
                                        Popular in community
                                    </p>
                                </div>
                            </Link>

                            <Button
                                className={cn(
                                    "w-full mt-auto h-9 rounded-2xl text-[12px] font-bold shadow-lg transition-all active:scale-95",
                                    followedIds.has(profile.id)
                                        ? "bg-secondary text-foreground hover:bg-secondary/80 border border-white/10"
                                        : "bg-primary hover:bg-primary/90 shadow-primary/20"
                                )}
                                onClick={() => handleFollow(profile.id)}
                                disabled={followedIds.has(profile.id)}
                            >
                                {followedIds.has(profile.id) ? "Following" : "Follow"}
                            </Button>
                        </div>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" className="hidden" />
            </ScrollArea>
        </div>
    );
};
