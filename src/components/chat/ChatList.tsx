import { format, isToday, isYesterday, isThisWeek, formatDistanceToNow } from "date-fns";
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);

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

    const isOnline = (userId: string) => onlineUsers.has(userId);

    return (
        <div className="flex flex-col h-full bg-background border-r border-white/5 shadow-2xl">
            {/* Premium Header */}
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black tracking-tighter bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">Messages</h2>
                    <Popover open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                        <PopoverTrigger asChild>
                            <Button size="icon" variant="secondary" className="rounded-full bg-white/5 hover:bg-white/10 border-0 h-10 w-10 active:scale-95 transition-all">
                                <Plus className="w-5 h-5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0 overflow-hidden border-white/10 glass shadow-2xl rounded-3xl" align="end">
                            <div className="p-4 border-b border-white/5 bg-white/5">
                                <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground/50">New Message</h3>
                            </div>
                            <div className="max-h-64 overflow-y-auto p-2">
                                <Button
                                    className="w-full justify-start gap-3 rounded-2xl h-12 bg-white/5 border-0 hover:bg-white/10 font-bold"
                                    onClick={() => {
                                        setShowCreateModal(true);
                                        setIsNewChatOpen(false);
                                    }}
                                >
                                    <Users className="w-5 h-5 text-primary" />
                                    New Group Chat
                                </Button>
                                <p className="p-4 text-center text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-50">Recent Contacts</p>
                                <div className="space-y-1">
                                    {/* Placeholder for recent contacts - could be fetched */}
                                    <p className="p-4 text-center text-xs text-muted-foreground/50 font-medium italic">No recent contacts</p>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Modern Search */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-11 h-12 bg-white/5 border-0 rounded-2xl focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/30 font-medium transition-all"
                    />
                </div>

                {/* Filter Tabs */}
                <div className="flex p-1 bg-white/5 rounded-2xl gap-1">
                    {['all', 'direct', 'group'].map((t) => (
                        <button
                            key={t}
                            onClick={() => setActiveTab(t as any)}
                            className={cn(
                                "flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                                activeTab === t ? "bg-white/10 text-foreground shadow-sm" : "text-muted-foreground/40 hover:text-muted-foreground/60"
                            )}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat List */}
            <ScrollArea className="flex-1 px-4">
                <div className="space-y-1 py-2">
                    {isLoading ? (
                        [1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center gap-4 p-4">
                                <Skeleton className="w-14 h-14 rounded-2xl bg-white/5" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-1/2 bg-white/5" />
                                    <Skeleton className="h-3 w-3/4 bg-white/5" />
                                </div>
                            </div>
                        ))
                    ) : filteredChats.length === 0 ? (
                        <div className="py-20 text-center animate-in fade-in duration-700">
                            <div className="w-16 h-16 rounded-full bg-secondary/30 flex items-center justify-center mx-auto mb-4">
                                <MessageCircle className="w-8 h-8 text-muted-foreground/20" />
                            </div>
                            <p className="text-muted-foreground/50 font-bold text-sm">No conversations found</p>
                        </div>
                    ) : (
                        filteredChats.map((chat) => {
                            const active = isOnline(chat.user.id || "");
                            return (
                                <button
                                    key={chat.id}
                                    onClick={() => onSelect(chat.id)}
                                    className={cn(
                                        "w-full flex items-center gap-4 p-4 rounded-3xl transition-all duration-300 group relative active:scale-[0.98]",
                                        selectedId === chat.id
                                            ? "bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5"
                                            : "hover:bg-white/[0.03] border border-transparent"
                                    )}
                                >
                                    <div className="relative flex-shrink-0">
                                        <Avatar className={cn(
                                            "w-14 h-14 rounded-2xl border border-white/10 transition-transform duration-500 group-hover:scale-105",
                                            selectedId === chat.id ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background" : ""
                                        )}>
                                            <AvatarImage src={chat.user.avatar || ""} className="object-cover" />
                                            <AvatarFallback className="bg-secondary/50 font-medium text-primary uppercase">
                                                {chat.isGroup ? <Users className="w-6 h-6" /> : chat.user.name[0]}
                                            </AvatarFallback>
                                        </Avatar>
                                        {!chat.isGroup && (
                                            <span className={cn(
                                                "absolute -top-1 -right-1 w-4 h-4 rounded-full border-4 border-background shadow-lg transition-transform duration-500 group-hover:scale-110",
                                                active ? "bg-green-500 animate-pulse" : "bg-gray-500/50"
                                            )} />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <p className="font-medium text-[15px] truncate tracking-tight">{chat.user.name}</p>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">
                                                {chat.timestamp ? formatDistanceToNow(new Date(chat.timestamp), { addSuffix: false }) : ''}
                                            </span>
                                        </div>
                                        <p className={cn(
                                            "text-[13px] truncate font-medium transition-colors",
                                            chat.unread > 0 ? "text-foreground font-black" : "text-muted-foreground/60 group-hover:text-muted-foreground/80"
                                        )}>
                                            {chat.isGroup && <span className="text-primary/70 mr-1">Group:</span>}
                                            {chat.lastMessage}
                                        </p>
                                    </div>

                                    {chat.unread > 0 && (
                                        <div className="absolute right-4 bottom-4 min-w-[20px] h-5 rounded-full bg-primary flex items-center justify-center px-1.5 shadow-lg shadow-primary/20 animate-in zoom-in duration-300">
                                            <span className="text-[10px] font-black text-white">{chat.unread}</span>
                                        </div>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            </ScrollArea>

            {showCreateModal && (
                <CreateGroupModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateGroup}
                />
            )}
        </div>
    );
};
