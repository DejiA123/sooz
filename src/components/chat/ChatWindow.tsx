import { useState, useRef, useEffect } from "react";
import { useCall } from "@/contexts/CallContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Image as ImageIcon, Smile, ArrowLeft, Phone, Video, X } from "lucide-react";
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

interface Message {
    id: string;
    content: string; // If 'image', this is the URL
    type: 'text' | 'image';
    senderId: string;
    timestamp: string;
}

interface ChatWindowProps {
    chatId: string;
    onBack: () => void;
}

export const ChatWindow = ({ chatId, onBack }: ChatWindowProps) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [chatInfo, setChatInfo] = useState<{ id?: string; name: string; avatar: string | null; online?: boolean }>({ name: "Chat", avatar: null });
    const [participants, setParticipants] = useState<Record<string, { username: string; avatar: string | null }>>({});
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const { startCall } = useCall();

    // Fetch Chat Info & Messages
    useEffect(() => {
        if (!user || !chatId) return;

        const fetchChatDetails = async () => {
            // 1. Get Conversation Info
            const { data: conv, error } = await supabase.from('conversations').select('*, conversation_participants(user_id, profiles(username, display_name, avatar_url))').eq('id', chatId).single();

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
                    setChatInfo({ name: conv.name || "Group Chat", avatar: null });
                } else {
                    // Direct: Find other participant
                    // @ts-ignore
                    const other = conv.conversation_participants.find((p: any) => p.user_id !== user.id);
                    if (other && other.profiles) {
                        setChatInfo({
                            id: other.user_id,
                            name: other.profiles.display_name || other.profiles.username,
                            avatar: other.profiles.avatar_url,
                            online: true // Mock online status for now
                        });
                    }
                }
            }

            // 2. Get Messages
            const { data: msgs } = await supabase
                .from('messages')
                .select('id, content, sender_id, created_at')
                .eq('conversation_id', chatId)
                .order('created_at', { ascending: true }); // Oldest first for chat log

            if (msgs) {
                setMessages(msgs.map(m => ({
                    id: m.id,
                    content: m.content,
                    type: m.content.startsWith('http') && (m.content.includes('/chat-images/') || m.content.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? 'image' : 'text',
                    senderId: m.sender_id, // Store actual ID
                    timestamp: m.created_at
                })));
            }
        };

        fetchChatDetails();

        // 3. Subscribe to new messages
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
                            timestamp: newMsg.created_at
                        }];
                    });
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
        } catch (error) {
            console.error("Failed to send:", error);
            toast.error("Failed to send message");
            setInputValue(content); // Restore if failed
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

    return (
        <div className="flex flex-col h-full bg-background/95 backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="relative">
                        <Avatar className="w-10 h-10 border border-white/10 ring-2 ring-transparent group-hover:ring-primary transition-all">
                            <AvatarImage src={chatInfo.avatar || undefined} className="object-cover" />
                            <AvatarFallback>{chatInfo.name[0]}</AvatarFallback>
                        </Avatar>
                        {chatInfo.online && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                        )}
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">{chatInfo.name}</h3>
                        <p className="text-xs text-muted-foreground">{chatInfo.online ? 'Active now' : ''}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => chatInfo.id && startCall(chatInfo.id, chatInfo.name, chatInfo.avatar, false)}
                        disabled={!chatInfo.id}
                        title="Start Audio Call"
                    >
                        <Phone className="w-5 h-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => chatInfo.id && startCall(chatInfo.id, chatInfo.name, chatInfo.avatar, true)}
                        disabled={!chatInfo.id}
                        title="Start Video Call"
                    >
                        <Video className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="text-center text-muted-foreground mt-10">
                        <p>No messages yet.</p>
                        <p className="text-sm">Say hello! 👋</p>
                    </div>
                )}
                {messages.map((msg, index) => {
                    const isMe = msg.senderId === user?.id;
                    const showAvatar = !isMe && (index === 0 || messages[index - 1].senderId !== msg.senderId);
                    const senderProfile = participants[msg.senderId];

                    return (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex w-full animate-fade-in items-end gap-2",
                                isMe ? "justify-end" : "justify-start"
                            )}
                        >
                            {!isMe && (
                                <div className="w-8 flex-shrink-0">
                                    {showAvatar ? (
                                        <Avatar className="w-8 h-8 border border-white/10">
                                            <AvatarImage src={senderProfile?.avatar || undefined} className="object-cover" />
                                            <AvatarFallback className="text-[10px]">{senderProfile?.username?.[0] || "?"}</AvatarFallback>
                                        </Avatar>
                                    ) : (
                                        <div className="w-8" />
                                    )}
                                </div>
                            )}

                            <div
                                className={cn(
                                    "max-w-[70%] text-sm leading-relaxed shadow-sm break-words",
                                    isMe
                                        ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl rounded-tr-sm"
                                        : "bg-secondary/80 backdrop-blur-sm text-foreground rounded-2xl rounded-tl-sm border border-white/5",
                                    msg.type === 'image' ? "p-1" : "px-4 py-3"
                                )}
                            >
                                {msg.type === 'image' ? (
                                    <img
                                        src={msg.content}
                                        alt="Sent image"
                                        className="rounded-xl w-full h-auto max-h-60 object-cover"
                                        loading="lazy"
                                    />
                                ) : (
                                    msg.content
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Input - Raised Position */}
            <div className="p-3 pb-8 bg-background/80 backdrop-blur-md border-t border-white/5 z-20">
                <div className="flex items-center gap-2 max-w-3xl mx-auto">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileUpload}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-primary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        <ImageIcon className="w-5 h-5" />
                    </Button>

                    <div className="flex-1 relative">
                        <Input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            placeholder="Message..."
                            className="bg-muted/50 border-none rounded-full pl-4 pr-10 focus-visible:ring-1 focus-visible:ring-primary/50"
                        />

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full text-muted-foreground hover:text-primary"
                                >
                                    <Smile className="w-5 h-5" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent side="top" align="end" className="w-auto p-0 border-none bg-transparent shadow-none">
                                <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.DARK} width={300} height={400} />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <Button
                        onClick={handleSend}
                        size="icon"
                        className="shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
                        disabled={(!inputValue.trim() && !uploading)}
                    >
                        <Send className="w-4 h-4 ml-0.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
