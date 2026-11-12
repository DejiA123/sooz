import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Profile {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
}

export default function SuggestedPeople() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchProfiles = async () => {
            try {
                let query = supabase
                    .from('profiles')
                    .select('id, username, display_name, avatar_url')
                    .limit(50); // Fetch more for the full page

                if (user) {
                    query = query.neq('id', user.id);
                }

                const { data, error } = await query;
                if (error) throw error;

                if (data) {
                    // Randomize for discovery
                    const shuffled = data.sort(() => 0.5 - Math.random());
                    setProfiles(shuffled);
                }
            } catch (error) {
                console.error("Error fetching suggested people:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfiles();
    }, [user]);

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
        <div className="pb-20 max-w-xl mx-auto">
            <div className="sticky top-20 md:top-0 z-40 bg-background/80 backdrop-blur-xl px-4 py-4 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="md:hidden">
                    <ArrowLeft className="w-6 h-6" />
                </Button>
                <h1 className="text-xl font-bold">Suggested People</h1>
            </div>

            <div className="px-4 py-2 space-y-4">
                {isLoading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : profiles.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        No suggestions found.
                    </div>
                ) : (
                    profiles.map((profile) => (
                        <div key={profile.id} className="flex items-center justify-between">
                            <Link to={`/profile/${profile.username}`} className="flex items-center gap-3 group">
                                <Avatar className="w-12 h-12 border border-border group-hover:border-primary/50 transition-colors">
                                    <AvatarImage src={profile.avatar_url || ""} />
                                    <AvatarFallback>{(profile.display_name || profile.username)[0].toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="font-semibold group-hover:text-primary transition-colors">
                                        {profile.username}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {profile.display_name}
                                    </span>
                                </div>
                            </Link>
                            <Button
                                size="sm"
                                className={cn(
                                    "font-semibold transition-all active:scale-95",
                                    followedIds.has(profile.id)
                                        ? "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                                        : "bg-primary text-white hover:bg-primary/90"
                                )}
                                onClick={() => handleFollow(profile.id)}
                                disabled={followedIds.has(profile.id)}
                            >
                                {followedIds.has(profile.id) ? "Following" : "Follow"}
                            </Button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
