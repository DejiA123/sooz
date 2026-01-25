import { format, isToday, isYesterday, isThisWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { Plus, Users, Search, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreateGroupModal } from "./CreateGroupModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

import { usePresence } from "@/hooks/usePresence";

interface ChatListProps {
    selectedId?: string;
    onSelect: (id: string) => void;
}

export const ChatList = ({ selectedId, onSelect }: ChatListProps) => {
    const { user, loading: authLoading } = useAuth();
    const { onlineUsers } = usePresence();
    const queryClient = useQueryClient();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"all" | "direct" | "group">("all");

    // Fetch Chats using React Query for caching and instant load
    const { data: chats = [], isLoading } = useQuery({
        queryKey: ['chats', user?.id],
        queryFn: async () => {
            if (!user) return [];

            // 1. Get my conversations
            const { data: participations, error: partError } = await supabase
                .from('conversation_participants')
                .select('conversation_id, conversations(id, type, name, created_at)')
                .eq('user_id', user.id);

            if (partError) throw partError;

            // Extract IDs
            const conversationIds = participations.map((p: any) => p.conversation_id);

            if (conversationIds.length === 0) return [];

            // 2. BATCH FETCH: Get all other participants for these conversations
            // We need to fetch participants where conversation_id IS IN our list AND user_id IS NOT me
            const { data: otherParticipants } = await supabase
                .from('conversation_participants')
                .select('conversation_id, profiles(id, username, display_name, avatar_url, updated_at)')
                .in('conversation_id', conversationIds)
                .neq('user_id', user.id);

            // Create a map of conversation_id -> other participant profile
            const participantsMap: Record<string, any> = {};
            otherParticipants?.forEach((p: any) => {
                if (p.profiles) {
                    // For direct chats, there's usually just one other person. 
                    // If group, this might just get one of them, which is fine for now or we handle groups differently.
                    participantsMap[p.conversation_id] = p.profiles;
                }
            });

            // 3. BATCH FETCH: Get latest message for EACH conversation
            // This is tricky in Supabase/Postgres without a custom function for "latest per group".
            // A common workaround is to fetch messages ordered by time and filtering in JS, 
            // OR use a reliable RPC. 
            // For now, let's fetch the latest messages globally for these conversations.
            // A simple approximation is fetching the last 50 messages visible to user or similar, 
            // but ensuring we get at least one for each is hard in one query without window functions.

            // Optimized approach for Supabase JS: 
            // We can actually use the `.in()` filter. 
            // But getting *just* the last one per conversation is hard.
            // Let's rely on a simpler strategy: Fetch the conversations with their latest message derived? 
            // Actually, we can just fetch all messages for these convos created recently? No.

            // Let's stick to the map strategy but do it smartly.
            // If we can't do a single query for "last message of each", we might have to stick to Promise.all for messages 
            // OR accept that we fetch a slightly larger chunk of recent messages.

            // ALTERNATIVE: Use the `conversations` view if we had one.
            // BETTER: Just use Promise.all but LIMIT concurrency if needed? 
            // Actually, for 20 chats, 20 parallel requests for messages is much faster than sequential. 
            // But let's try to optimize. 

            // We will stick to the Promise.all for messages ONLY, as it's harder to batch.
            // But we already optimized the participants fetch which was half the work.

            const messagesPromises = conversationIds.map(id =>
                supabase
                    .from('messages')
                    .select('content, created_at, sender_id')
                    .eq('conversation_id', id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()
            );

            const lastMessagesResults = await Promise.all(messagesPromises);
            const lastMessagesMap: Record<string, any> = {};
            conversationIds.forEach((id, index) => {
                lastMessagesMap[id] = lastMessagesResults[index].data;
            });

            const fetchedChats = participations.map((p: any) => {
                const conv = p.conversations;
                let chatName = conv.name;
                let chatAvatar = null;
                let isGroup = conv.type === 'group';
                let chatUserId = null;
                let chatLastSeen = null;

                if (!isGroup) {
                    const otherProfile = participantsMap[conv.id];
                    if (otherProfile) {
                        chatName = otherProfile.display_name || otherProfile.username;
                        chatAvatar = otherProfile.avatar_url;
                        chatUserId = otherProfile.id;
                        chatLastSeen = otherProfile.updated_at;
                    }
                }

                const lastMsg = lastMessagesMap[conv.id];

                return {
                    id: conv.id,
                    user: {
                        id: chatUserId,
                        name: chatName || "Unknown",
                        avatar: chatAvatar,
                        username: "user",
                        lastSeen: chatLastSeen
                    },
                    isGroup,
                    lastMessage: lastMsg?.content || "No messages yet",
                    timestamp: lastMsg?.created_at || conv.created_at,
                    unread: 0
                };
            });

            // Sort by latest timestamp
            fetchedChats.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return fetchedChats;
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 5, // 5 minute cache
    });

    useEffect(() => {
        if (!user) return;

        // Subscribe to new messages or conversations
        const channel = supabase
            .channel('public:conversations')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'messages' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['chats', user.id] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);

    const handleCreateGroup = () => {
        queryClient.invalidateQueries({ queryKey: ['chats', user?.id] });
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
                {(isLoading || authLoading) ? (
                    <div className="divide-y divide-white/5">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center gap-3 p-4">
                                <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-1/3" />
                                    <Skeleton className="h-3 w-2/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    filteredChats.map((chat) => {
                        const isOnline = chat.user.id && onlineUsers.has(chat.user.id);

                        return (
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
                                    {isOnline && !chat.isGroup && (
                                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background z-10" />
                                    )}
                                    {chat.unread > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-background" />}
                                </div>

                                <div className="flex-1 overflow-hidden">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="font-semibold text-sm truncate">{chat.user.name}</span>
                                        {isOnline && !chat.isGroup && (
                                            <span className="text-[10px] text-green-500 font-medium whitespace-nowrap ml-2">Active Now</span>
                                        )}
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
                        )
                    })
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
