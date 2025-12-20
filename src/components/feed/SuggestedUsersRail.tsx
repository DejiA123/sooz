import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { X } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { toast } from "sonner";

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
            toast.success("Followed!");
            // Remove from list
            setHiddenIds(prev => new Set(prev).add(profileId));
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
                <h3 className="font-semibold text-base">Suggested for you</h3>
                <Link to="/suggested-people" className="text-base font-semibold text-primary hover:opacity-80">
                    See all
                </Link>
            </div>

            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-3 pb-4">
                    {visibleProfiles.map((profile) => (
                        <div
                            key={profile.id}
                            className="w-[160px] h-[220px] rounded-xl border border-border bg-card relative flex flex-col items-center p-4 gap-3 shrink-0 shadow-sm"
                        >
                            <button
                                onClick={() => handleDismiss(profile.id)}
                                className="absolute top-2 right-2 text-muted-foreground/50 hover:text-foreground p-1 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            <Link to={`/profile/${profile.username}`} className="flex flex-col items-center gap-2 w-full mt-1 group">
                                <Avatar className="w-20 h-20 border border-border group-hover:scale-105 transition-transform">
                                    <AvatarImage src={profile.avatar_url || ""} className="object-cover" />
                                    <AvatarFallback className="text-xl bg-secondary">{profile.username[0].toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="text-center w-full space-y-1">
                                    <p className="font-semibold text-base truncate w-full px-1 leading-tight">
                                        {profile.display_name || profile.username}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate w-full px-1">
                                        Followed by sooz_user + 2 others
                                    </p>
                                </div>
                            </Link>

                            <Button
                                className="w-full mt-auto h-8 text-sm font-semibold bg-primary hover:bg-primary/90 transition-all active:scale-95"
                                onClick={() => handleFollow(profile.id)}
                            >
                                Follow
                            </Button>
                        </div>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" className="hidden" />
            </ScrollArea>
        </div>
    );
};
