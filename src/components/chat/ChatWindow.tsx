import { useState, useRef, useEffect } from "react";
import { useCall } from "@/contexts/CallContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Image as ImageIcon, Smile, ArrowLeft, Phone, Video, X, Info, MoreVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePresence } from "@/hooks/usePresence";

interface Message {
    id: string;
    content: string; // If 'image', this is the URL
    type: 'text' | 'image';
    senderId: string;
    timestamp: string;
    isDeleted?: boolean;
}

interface ChatWindowProps {
    chatId: string;
    onBack: () => void;
}

export const ChatWindow = ({ chatId, onBack }: ChatWindowProps) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [chatInfo, setChatInfo] = useState<{ id?: string; name: string; avatar: string | null; lastSeen?: string | null; isGroup?: boolean }>({ name: "Chat", avatar: null });
    const { onlineUsers } = usePresence();
    const [participants, setParticipants] = useState<Record<string, { username: string; avatar: string | null }>>({});
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const { startCall } = useCall();
    const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [isSending, setIsSending] = useState(false);

    // Fetch Chat Info & Messages
    useEffect(() => {
        if (!user || !chatId) return;

        const fetchChatDetails = async () => {
            // Load details and messages in parallel
            const [convResult, msgsResult] = await Promise.all([
                // 1. Get Conversation Info
                supabase.from('conversations').select('*, conversation_participants(user_id, profiles(username, display_name, avatar_url, updated_at))').eq('id', chatId).single(),

                // 2. Get Messages
                supabase
                    .from('messages')
                    .select('id, content, sender_id, created_at')
                    .eq('conversation_id', chatId)
                    .order('created_at', { ascending: true })
            ]);

            const { data: conv } = convResult;
            const { data: msgs } = msgsResult;

            if (conv) {
                // Map participants
                const parts: Record<string, any> = {};
                // @ts-ignore
                conv.conversation_participants.forEach((p: any) => {
                    if (p.profiles) {
                        parts[p.user_id] = {
                            username: p.profiles.display_name || p.profiles.username,
                            avatar: p.profiles.avatar_url
                        };
                    }
                });
                setParticipants(parts);

                if (conv.type === 'group') {
                    setChatInfo({ name: conv.name || "Group Chat", avatar: null, isGroup: true });
                } else {
                    // Direct: Find other participant
                    // @ts-ignore
                    const other = conv.conversation_participants.find((p: any) => p.user_id !== user.id);
                    if (other && other.profiles) {
                        setChatInfo({
                            id: other.user_id,
                            name: other.profiles.display_name || other.profiles.username,
                            avatar: other.profiles.avatar_url,
                            lastSeen: other.profiles.updated_at
                        });
                    }
                }
            }

            if (msgs) {
                setMessages(msgs.map((m: any) => ({
                    id: m.id,
                    content: m.content,
                    type: m.content.startsWith('http') && (m.content.includes('/chat-images/') || m.content.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? 'image' : 'text',
                    senderId: m.sender_id, // Store actual ID
                    timestamp: m.created_at,
                    isDeleted: false
                })));
            }
        };

        fetchChatDetails();

        // 3. Subscribe to new messages and UPDATES (for deletion)
        const channel = supabase
            .channel(`chat:${chatId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${chatId}` },
                (payload) => {
                    const newMsg = payload.new;
                    setMessages(prev => {
                        // Prevent duplicates
                        if (prev.some(m => m.id === newMsg.id)) return prev;

                        return [...prev, {
                            id: newMsg.id,
                            content: newMsg.content,
                            type: newMsg.content.startsWith('http') && (newMsg.content.includes('/chat-images/') || newMsg.content.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? 'image' : 'text',
                            senderId: newMsg.sender_id,
                            timestamp: newMsg.created_at,
                            isDeleted: newMsg.is_deleted
                        }];
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${chatId}` },
                (payload) => {
                    const updatedMsg = payload.new;
                    setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, isDeleted: updatedMsg.is_deleted } : m));
                }
            )
            .subscribe((status) => {
                console.log("Realtime subscription status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };

    }, [chatId, user]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!inputValue.trim() || !user) return;

        const content = inputValue.trim();
        setInputValue(""); // Optimistic clear

        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: chatId,
                    sender_id: user.id,
                    content: content
                });

            if (error) throw error;

            if (chatInfo.id) {
                // Send push notification to recipient (Fire and forget)
                supabase.functions.invoke('push-notifications', {
                    body: {
                        type: 'chat_message',
                        toUserId: chatInfo.id,
                        title: user.user_metadata?.username || 'New Message',
                        body: content,
                        url: '/chat'
                    }
                }).then(({ error }) => {
                    if (error) console.error("Error sending push:", error);
                });
            }
        } catch (error) {
            console.error("Failed to send:", error);
            toast.error("Failed to send message");
            setInputValue(content); // Restore if failed
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        try {
            const { error } = await supabase
                .from('messages')
                .delete()
                .eq('id', messageId);

            if (error) throw error;

            // Remove from local state
            setMessages(prev => prev.filter(m => m.id !== messageId));
        } catch (error) {
            console.error("Failed to delete message:", error);
            toast.error("Failed to delete message");
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${crypto.randomUUID()}.${fileExt}`;
            const filePath = `chat-images/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('media') // User confirmed bucket name is 'media'
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('media')
                .getPublicUrl(filePath);

            // Send message with image URL
            const { error: msgError } = await supabase
                .from('messages')
                .insert({
                    conversation_id: chatId,
                    sender_id: user.id,
                    content: publicUrl
                });

            if (msgError) throw msgError;

        } catch (error) {
            console.error("Upload failed:", error);
            toast.error("Failed to upload image");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const onEmojiClick = (emojiObject: any) => {
        setInputValue(prev => prev + emojiObject.emoji);
    };

    const isGroup = chatInfo.isGroup;
    const otherUserOnline = chatInfo.id && onlineUsers.has(chatInfo.id);
    const chatName = chatInfo.name;

    return (
        <div className="flex flex-col h-full bg-background relative overflow-hidden">
            {/* High-End Header */}
            <header className="sticky top-0 z-40 pwa-fixed-top">
                <div className="glass px-6 py-4 flex items-center justify-between border-b-0 shadow-glass">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onBack}
                            className="md:hidden rounded-full hover:bg-white/10 h-10 w-10"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>

                        <div className="relative group cursor-pointer" onClick={() => setShowGroupInfo(true)}>
                            <Avatar className="w-11 h-11 border border-white/10 ring-2 ring-transparent group-hover:ring-primary/20 transition-all duration-500 rounded-2xl">
                                <AvatarImage src={chatInfo.avatar || ""} className="object-cover" />
                                <AvatarFallback className="bg-primary/5 text-primary text-sm font-medium uppercase">
                                    {chatName?.[0] || "?"}
                                </AvatarFallback>
                            </Avatar>
                            {!isGroup && (
                                <div className={cn(
                                    "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-background shadow-lg transition-transform duration-500",
                                    otherUserOnline ? "bg-green-500 animate-pulse scale-110" : "bg-gray-500/50 scale-100"
                                )} />
                            )}
                        </div>

                        <div className="min-w-0">
                            <h3 className="font-medium text-[17px] tracking-tight truncate leading-tight hover:underline cursor-pointer" onClick={() => setShowGroupInfo(true)}>
                                {chatName}
                            </h3>
                            {isGroup ? (
                                <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50">
                                    {Object.keys(participants).length} Members
                                </p>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <p className={cn(
                                        "text-[11px] font-medium uppercase tracking-widest transition-colors",
                                        otherUserOnline ? "text-green-500/80" : "text-muted-foreground/40"
                                    )}>
                                        {otherUserOnline ? "Active now" : "Offline"}
                                    </p>
                                    {otherUserOnline && <span className="w-1 h-1 rounded-full bg-green-500/50" />}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <Button
                            size="icon"
                            variant="ghost"
                            className="rounded-full hover:bg-white/10 h-10 w-10 active:scale-95 transition-all text-muted-foreground hover:text-foreground"
                            onClick={() => chatInfo.id && startCall(chatInfo.id, chatInfo.name, chatInfo.avatar, false)}
                            disabled={!chatInfo.id}
                        >
                            <Phone className="w-5 h-5" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="rounded-full hover:bg-white/10 h-10 w-10 active:scale-95 transition-all text-muted-foreground hover:text-foreground"
                            onClick={() => chatInfo.id && startCall(chatInfo.id, chatInfo.name, chatInfo.avatar, true)}
                            disabled={!chatInfo.id}
                        >
                            <Video className="w-5 h-5" />
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="rounded-full hover:bg-white/10 h-10 w-10 active:scale-95 transition-all text-muted-foreground hover:text-foreground">
                                    <MoreVertical className="w-5 h-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="glass border-white/10 rounded-2xl w-48 p-1 shadow-2xl">
                                <DropdownMenuItem onClick={() => setShowGroupInfo(true)} className="rounded-xl font-bold py-2 focus:bg-white/5">
                                    View information
                                </DropdownMenuItem>
                                {isGroup && (
                                    <DropdownMenuItem className="rounded-xl font-bold py-2 text-destructive focus:bg-destructive/10">
                                        Leave group
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>

            {/* Messages Feed */}
            <ScrollArea className="flex-1 px-4 md:px-8 bg-gradient-to-b from-transparent to-black/20" ref={scrollRef}>
                <div className="flex flex-col gap-4 py-8">
                    {isLoading ? (
                        <div className="flex flex-col gap-6 py-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className={cn("flex items-end gap-3 max-w-[80%]", i % 2 === 0 ? "self-end flex-row-reverse" : "self-start")}>
                                    <Skeleton className="w-8 h-8 rounded-full flex-shrink-0 bg-white/5" />
                                    <Skeleton className={cn("h-12 w-48 rounded-2xl bg-white/5")} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        messages.map((msg, idx) => {
                            const isMe = msg.senderId === user?.id;
                            const showAvatar = !isMe && (idx === 0 || messages[idx - 1].senderId !== msg.senderId);
                            const senderProfile = participants[msg.senderId];
                            const isLong = msg.content.length > 50;

                            return (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "group flex items-end gap-3 max-w-[85%] md:max-w-[75%] transition-all animate-in fade-in slide-in-from-bottom-2 duration-500",
                                        isMe ? "self-end flex-row-reverse" : "self-start"
                                    )}
                                >
                                    {!isMe && (
                                        <div className="w-8 flex-shrink-0">
                                            {showAvatar && (
                                                <Avatar className="w-8 h-8 border border-white/10 rounded-xl shadow-lg">
                                                    <AvatarImage src={senderProfile?.avatar || ""} className="object-cover" />
                                                    <AvatarFallback className="bg-secondary/50 text-[10px] font-medium uppercase">
                                                        {senderProfile?.username?.[0] || "?"}
                                                    </AvatarFallback>
                                                </Avatar>
                                            )}
                                        </div>
                                    )}

                                    <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                                        {isGroup && !isMe && showAvatar && (
                                            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50 mb-1 ml-1">
                                                {senderProfile?.username || "User"}
                                            </span>
                                        )}
                                        <div className="relative group">
                                            <div
                                                className={cn(
                                                    "px-4 py-3 rounded-2xl text-[15px] leading-snug font-medium shadow-sm transition-all duration-300",
                                                    isMe
                                                        ? "bg-primary text-white rounded-br-none shadow-primary/20 hover:shadow-primary/30"
                                                        : "bg-white/5 text-foreground rounded-bl-none border border-white/5 hover:bg-white/10",
                                                    msg.isDeleted ? "italic opacity-50" : "",
                                                    isLong ? "whitespace-pre-wrap break-words" : ""
                                                )}
                                            >
                                                {msg.isDeleted ? (
                                                    <span className="flex items-center gap-1.5 text-xs">
                                                        <Info className="w-3 h-3" />
                                                        This message was deleted
                                                    </span>
                                                ) : msg.type === 'image' ? (
                                                    <img
                                                        src={msg.content}
                                                        alt="Sent content"
                                                        className="rounded-xl w-full h-auto max-h-60 object-cover cursor-pointer"
                                                        onClick={() => window.open(msg.content, '_blank')}
                                                    />
                                                ) : (
                                                    msg.content
                                                )}
                                            </div>

                                            {/* Message Actions */}
                                            {isMe && !msg.isDeleted && (
                                                <div className="absolute top-0 -left-14 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-row-reverse items-center gap-1">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full bg-white/5 hover:bg-white/10 border-0">
                                                                <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="glass border-white/10 rounded-xl p-1 shadow-2xl">
                                                            <DropdownMenuItem
                                                                onClick={() => handleDeleteMessage(msg.id)}
                                                                className="text-destructive font-bold py-1.5 focus:bg-destructive/10 rounded-lg text-xs"
                                                            >
                                                                Unsend message
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 mt-1.5 px-1">
                                            {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div className="h-4" />
                </div>
            </ScrollArea>

            {/* Premium Input Bar */}
            <footer className="p-4 md:p-8 bg-gradient-to-t from-background via-background to-transparent relative z-10">
                <div className="max-w-4xl mx-auto glass p-2 rounded-[2rem] border border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 duration-700">
                    <div className="flex items-end gap-2 pr-2">
                        <div className="flex mb-1.5">
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="rounded-full hover:bg-white/5 h-10 w-10 transition-colors"
                            >
                                {uploading ? (
                                    <div className="w-4 h-4 border-2 border-primary border-t-transparent animate-spin rounded-full" />
                                ) : (
                                    <ImageIcon className="w-5 h-5 text-primary" />
                                )}
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>

                        <div className="flex-1 relative">
                            <textarea
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder="Message..."
                                className="w-full bg-transparent border-none focus:ring-0 placeholder:text-muted-foreground/30 text-[15px] font-medium py-3 px-4 resize-none max-h-32 min-h-[44px] transition-all scrollbar-none"
                                rows={1}
                            />
                        </div>

                        <div className="flex items-center gap-1 mb-1.5">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button size="icon" variant="ghost" className="rounded-full hover:bg-white/5 h-10 w-10 hidden sm:flex">
                                        <Smile className="w-5 h-5 text-muted-foreground/60" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 border-white/10 glass rounded-3xl overflow-hidden shadow-2xl" align="end" sideOffset={12}>
                                    <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.DARK} width={300} height={400} />
                                </PopoverContent>
                            </Popover>

                            <Button
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isSending}
                                className={cn(
                                    "rounded-full h-10 w-10 flex items-center justify-center transition-all p-0 shadow-lg",
                                    inputValue.trim()
                                        ? "bg-primary text-white scale-100 shadow-primary/20"
                                        : "bg-white/5 text-muted-foreground/30 scale-90"
                                )}
                            >
                                <Send className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Info Drawer */}
            <Dialog open={showGroupInfo} onOpenChange={setShowGroupInfo}>
                <DialogContent className="glass border-white/10 rounded-[3rem] max-w-md p-0 overflow-hidden shadow-2xl text-foreground">
                    <DialogTitle className="sr-only">Conversation Info</DialogTitle>
                    <div className="p-8 text-center space-y-6">
                        <Avatar className="w-24 h-24 mx-auto rounded-[2rem] border-4 border-white/5 shadow-2xl ring-4 ring-primary/5">
                            <AvatarImage src={chatInfo.avatar || ""} className="object-cover" />
                            <AvatarFallback className="bg-primary/5 text-primary text-3xl font-black uppercase">
                                {chatName?.[0] || "?"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black tracking-tight">{chatName}</h2>
                            <p className="text-muted-foreground/60 font-bold uppercase tracking-widest text-[10px]">
                                {isGroup ? "Group Conversation" : "Direct Message"}
                            </p>
                        </div>

                        {isGroup && (
                            <div className="space-y-4">
                                <h3 className="text-left font-black text-sm uppercase tracking-widest text-muted-foreground/50 px-2">Members</h3>
                                <div className="space-y-1 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {Object.entries(participants).map(([id, p]) => (
                                        <div key={id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/[0.03] transition-colors">
                                            <Avatar className="w-10 h-10 rounded-xl border border-white/5">
                                                <AvatarImage src={p.avatar || ""} className="object-cover" />
                                                <AvatarFallback className="font-bold text-xs uppercase">{p.username?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="font-bold text-sm truncate">{p.username}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
