import { messagePreview, shortChatTime } from "@/lib/chat";
import { cn } from "@/lib/utils";
import { Plus, Users, Search, MessageCircle } from "lucide-react";
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
                    lastMessage: lastMsg
                        ? `${lastMsg.sender_id === user.id ? "You: " : ""}${messagePreview(lastMsg.content)}`
                        : isGroup ? "Group created" : "Say hello 👋",
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
            .channel(`chat-list:${crypto.randomUUID().slice(0, 8)}`)
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
    const tabs = [["all", "All"], ["direct", "Direct"], ["group", "Groups"]] as const;

    return (
        <div className="flex h-full flex-col bg-[#05070b] text-white">
            <div className="shrink-0 space-y-4 px-4 pb-3 pt-3">
                <div className="flex items-center justify-between">
                    <h1 className="text-[28px] font-bold leading-none tracking-tight text-white">Messages</h1>
                    <Popover open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                        <PopoverTrigger asChild>
                            <button type="button" aria-label="New message" className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-[#1a1204] active:scale-95">
                                <Plus className="h-5 w-5" strokeWidth={2.5} />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 overflow-hidden rounded-2xl border-white/10 bg-[#14171d] p-2 text-white" align="end">
                            <button
                                type="button"
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-medium active:bg-white/10"
                                onClick={() => { setShowCreateModal(true); setIsNewChatOpen(false); }}
                            >
                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><Users className="h-[18px] w-[18px] text-amber-400" /></span>
                                New group chat
                            </button>
                            <p className="px-3 pb-2 pt-1 text-[13px] text-white/45">To message someone, open their profile and tap Message.</p>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/40" />
                    <Input
                        placeholder="Search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-11 rounded-full border-0 bg-white/[0.08] pl-11 text-[16px] text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-amber-400/40"
                    />
                </div>

                <div className="flex gap-2">
                    {tabs.map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setActiveTab(key)}
                            className={cn(
                                "h-8 rounded-full px-4 text-[14px] font-semibold transition-colors",
                                activeTab === key ? "bg-white text-black" : "bg-white/[0.08] text-white/75 active:bg-white/15"
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
                {isLoading ? (
                    [1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-3 px-2 py-2.5">
                            <Skeleton className="h-14 w-14 rounded-full bg-white/[0.06]" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-1/2 bg-white/[0.06]" />
                                <Skeleton className="h-3 w-3/4 bg-white/[0.06]" />
                            </div>
                        </div>
                    ))
                ) : filteredChats.length === 0 ? (
                    <div className="py-20 text-center">
                        <MessageCircle className="mx-auto mb-3 h-10 w-10 text-white/20" />
                        <p className="text-[15px] font-medium text-white/60">{searchQuery ? "No matches" : "No messages yet"}</p>
                    </div>
                ) : (
                    filteredChats.map((chat) => {
                        const online = !chat.isGroup && isOnline(chat.user.id || "");
                        const selected = selectedId === chat.id;
                        return (
                            <button
                                key={chat.id}
                                type="button"
                                onClick={() => onSelect(chat.id)}
                                className={cn(
                                    "flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors active:bg-white/[0.06]",
                                    selected && "bg-white/[0.07]"
                                )}
                            >
                                <span className="relative shrink-0">
                                    <Avatar className="h-14 w-14">
                                        <AvatarImage src={chat.user.avatar || ""} className="object-cover" />
                                        <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-700 text-[20px] font-bold text-white">
                                            {chat.isGroup ? <Users className="h-6 w-6" /> : chat.user.name[0]?.toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    {online && <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-[#05070b] bg-emerald-500" />}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-baseline justify-between gap-2">
                                        <span className="truncate text-[16px] font-semibold text-white">{chat.user.name}</span>
                                        <span className="shrink-0 text-[12.5px] text-white/40">{shortChatTime(chat.timestamp)}</span>
                                    </span>
                                    <span className="mt-0.5 block truncate text-[14px] text-white/55">{chat.lastMessage}</span>
                                </span>
                            </button>
                        );
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
