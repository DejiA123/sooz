import { useEffect, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface DiscoverPost {
    id: string;
    media_url: string | null;
    media_type: string | null;
}

interface DiscoverUser {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
}

export default function Discover() {
    const [posts, setPosts] = useState<DiscoverPost[]>([]);
    const [users, setUsers] = useState<DiscoverUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, [searchQuery]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Posts
            let postQuery = supabase
                .from("posts")
                .select("id, media_url, media_type, caption")
                .not("media_url", "is", null)
                .order("created_at", { ascending: false })
                .limit(20);

            if (searchQuery.trim()) {
                postQuery = postQuery.ilike("caption", `%${searchQuery.trim()}%`);
            }

            const { data: postData, error: postError } = await postQuery;
            if (postError) throw postError;
            setPosts(postData || []);

            // 2. Fetch Users (only if searching)
            if (searchQuery.trim()) {
                const { data: userData, error: userError } = await supabase
                    .from("profiles")
                    .select("id, username, display_name, avatar_url")
                    .or(`username.ilike.%${searchQuery.trim()}%,display_name.ilike.%${searchQuery.trim()}%`)
                    .limit(10);

                if (userError) throw userError;
                setUsers(userData || []);
            } else {
                setUsers([]);
            }

        } catch (error) {
            console.error("Error fetching discover data:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pb-20">
            <div className="sticky top-[60px] z-40 bg-background/80 backdrop-blur-xl px-4 py-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search..."
                        className="pl-10 bg-muted/50 border-white/10 rounded-xl focus:bg-background transition-colors"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Found Users Section */}
            {users.length > 0 && (
                <div className="px-4 py-2 border-b border-white/5 mb-2">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">People</h3>
                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                        {users.map(user => (
                            <div
                                key={user.id}
                                className="flex flex-col items-center gap-1 min-w-[70px] cursor-pointer"
                                onClick={() => navigate(`/profile/${user.username}`)}
                            >
                                <Avatar className="w-14 h-14 border-2 border-primary/20">
                                    <AvatarImage src={user.avatar_url || ""} className="object-cover" />
                                    <AvatarFallback>{(user.display_name || user.username)[0].toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-center truncate w-full">{user.display_name || user.username}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loading ? (
                <div className="h-40 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : posts.length === 0 && users.length === 0 ? (
                <div className="text-center text-muted-foreground py-20">
                    <p>No results found</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-0.5 px-0.5 pb-4">
                    {posts.map((post, i) => (
                        <div
                            key={post.id}
                            className={`relative rounded-none overflow-hidden bg-muted aspect-[4/5] ${i % 3 === 0 ? 'row-span-2' : ''} group cursor-pointer`}
                            onClick={() => navigate(`/post/${post.id}`)}
                        >
                            {post.media_type === 'video' ? (
                                <video
                                    src={post.media_url || ""}
                                    className="w-full h-full object-cover"
                                    muted
                                    loop
                                    playsInline
                                />
                            ) : (
                                <img
                                    src={post.media_url || ""}
                                    alt="Discover"
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    loading="lazy"
                                />
                            )}
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
