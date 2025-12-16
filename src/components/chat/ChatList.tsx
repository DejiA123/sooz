import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Plus, Users, Search, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { CreateGroupModal } from "./CreateGroupModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChatListProps {
    selectedId?: string;
    onSelect: (id: string) => void;
}

export const ChatList = ({ selectedId, onSelect }: ChatListProps) => {
    const { user } = useAuth();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [chats, setChats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"all" | "direct" | "group">("all");

    useEffect(() => {
        if (!user) return;
        fetchChats();

        // Subscribe to new messages or conversations
        const channel = supabase
            .channel('public:conversations')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'messages' },
                () => {
                    fetchChats(); // Refresh on new message
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const fetchChats = async () => {
        try {
            // 1. Get my conversations
            const { data: participations, error: partError } = await supabase
                .from('conversation_participants')
                .select('conversation_id, conversations(id, type, name, created_at)')
                .eq('user_id', user?.id);

            if (partError) throw partError;

            const fetchedChats = await Promise.all(participations.map(async (p: any) => {
                const conv = p.conversations;
                let chatName = conv.name;
                let chatAvatar = null;
                let isGroup = conv.type === 'group';

                // 2. If direct, find the other user
                if (!isGroup) {
                    const { data: otherPart } = await supabase
                        .from('conversation_participants')
                        .select('profiles(username, display_name, avatar_url)')
                        .eq('conversation_id', conv.id)
                        .neq('user_id', user?.id)
                        .maybeSingle();

                    if (otherPart && otherPart.profiles) {
                        chatName = otherPart.profiles.display_name || otherPart.profiles.username;
                        chatAvatar = otherPart.profiles.avatar_url;
                    }
                }

                // 3. Get last message
                const { data: lastMsg } = await supabase
                    .from('messages')
                    .select('content, created_at, sender_id')
                    .eq('conversation_id', conv.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                return {
                    id: conv.id,
                    user: {
                        name: chatName || "Unknown",
                        avatar: chatAvatar,
                        username: "user"
                    },
                    isGroup,
                    lastMessage: lastMsg?.content || "No messages yet",
                    timestamp: lastMsg?.created_at || conv.created_at,
                    unread: 0
                };
            }));

            // Sort by latest timestamp
            fetchedChats.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setChats(fetchedChats);

        } catch (error) {
            console.error("Error fetching chats:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = () => {
        fetchChats(); // Re-fetch after creating group
    };

    // Filter Logic
    const filteredChats = chats.filter(chat => {
        const matchesSearch = chat.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (chat.lastMessage && chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesTab = activeTab === "all" ? true :
            activeTab === "group" ? chat.isGroup :
                !chat.isGroup; // direct

        return matchesSearch && matchesTab;
    });

    return (
        <div className="flex flex-col h-full bg-card/50 backdrop-blur-xl border-r border-white/5">
            {/* Header with Search and Create */}
            <div className="p-4 space-y-4 border-b border-white/5 bg-background/50">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">Messages</h2>
                    <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(true)} className="hover:bg-primary/20 hover:text-primary">
                        <Plus className="w-5 h-5" />
                    </Button>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search chats..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-muted/50 border-none h-9 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30"
                    />
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
                    <button
                        onClick={() => setActiveTab("all")}
                        className={cn("flex-1 text-xs py-1.5 rounded-md font-medium transition-all", activeTab === "all" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setActiveTab("direct")}
                        className={cn("flex-1 text-xs py-1.5 rounded-md font-medium transition-all", activeTab === "direct" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                    >
                        Direct
                    </button>
                    <button
                        onClick={() => setActiveTab("group")}
                        className={cn("flex-1 text-xs py-1.5 rounded-md font-medium transition-all", activeTab === "group" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                    >
                        Groups
                    </button>
                </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
                {filteredChats.length === 0 && !loading ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <p className="text-sm">No chats found</p>
                    </div>
                ) : (
                    filteredChats.map((chat) => (
                        <button
                            key={chat.id}
                            onClick={() => onSelect(chat.id)}
                            className={cn(
                                "w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0",
                                selectedId === chat.id && "bg-primary/5 border-l-2 border-primary border-b-0"
                            )}
                        >
                            <div className="relative">
                                <Avatar className="w-12 h-12 border border-white/10">
                                    <AvatarImage src={chat.user.avatar} className="object-cover" />
                                    <AvatarFallback>
                                        {chat.isGroup ? <Users className="w-5 h-5" /> : chat.user.name[0]}
                                    </AvatarFallback>
                                </Avatar>
                                {chat.unread > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-background" />}
                            </div>

                            <div className="flex-1 overflow-hidden">
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className="font-semibold text-sm truncate">{chat.user.name}</span>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                        {formatDistanceToNow(new Date(chat.timestamp), { addSuffix: false })}
                                    </span>
                                </div>
                                <p className={cn(
                                    "text-sm truncate",
                                    chat.unread > 0 ? "text-primary font-medium" : "text-muted-foreground"
                                )}>
                                    {chat.isGroup && <span className="text-xs text-primary mr-1">Group:</span>}
                                    {chat.lastMessage}
                                </p>
                            </div>
                        </button>
                    ))
                )}
            </div>

            {showCreateModal && (
                <CreateGroupModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateGroup}
                />
            )}
        </div>
    );
};
