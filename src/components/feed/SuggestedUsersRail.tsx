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

    if (loading || visibleProfiles.length === 0) return null;

    return (
        <div className="w-full space-y-4 py-2">
            <div className="flex items-center justify-between px-1">
                <h3 className="font-semibold text-sm">Suggested for you</h3>
                <Link to="/suggested-people" className="text-sm font-semibold text-primary hover:opacity-80">
                    See all
                </Link>
            </div>

            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-3 pb-4">
                    {visibleProfiles.map((profile) => (
                        <div
                            key={profile.id}
                            className="w-[160px] h-[220px] rounded-xl border border-border bg-card relative flex flex-col items-center p-4 gap-3 shrink-0"
                        >
                            <button
                                onClick={() => handleDismiss(profile.id)}
                                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            <Link to={`/profile/${profile.username}`} className="flex flex-col items-center gap-2 w-full mt-2">
                                <Avatar className="w-20 h-20 border border-border">
                                    <AvatarImage src={profile.avatar_url || ""} className="object-cover" />
                                    <AvatarFallback className="text-xl">{profile.username[0].toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="text-center w-full space-y-0.5">
                                    <p className="font-semibold text-sm truncate w-full px-2 leading-tight">
                                        {profile.display_name || profile.username}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground truncate w-full px-1">
                                        {/* Mock mutuals for now */}
                                        Suggested for you
                                    </p>
                                </div>
                            </Link>

                            <Button
                                className="w-full mt-auto h-8 text-xs font-semibold"
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
