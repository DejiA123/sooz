import { useState, useEffect, useRef } from "react";
import { Send, Paperclip, Camera, MoreVertical, Search, Phone, Video, ChevronLeft, MessageCircle, Heart, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ThreadFeatures } from "./ThreadFeatures";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  is_read: boolean;
  profiles: {
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
}

interface ChatUser {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
}

interface ChatInterfaceProps {
  selectedUser?: ChatUser;
  onBack?: () => void;
  isMobile?: boolean;
}

export const ChatInterface = ({ selectedUser, onBack, isMobile = false }: ChatInterfaceProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (selectedUser && user) {
      loadMessages();
      
      // Subscribe to new messages
      const subscription = supabase
        .channel(`messages:${user.id}:${selectedUser.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${selectedUser.id}`
        }, (payload) => {
          loadMessages();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [selectedUser, user]);

  const loadMessages = async () => {
    if (!selectedUser || !user) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles:sender_id(username, display_name, avatar_url)
        `)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      toast.error("Failed to load messages");
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || !user) return;

    setLoading(true);
    try {
      let content = newMessage.trim();
      
      // Handle replies
      if (replyingTo) {
        const repliedMessage = messages.find(m => m.id === replyingTo);
        if (repliedMessage) {
          content = `> ${repliedMessage.content}\n\n${content}`;
        }
        setReplyingTo(null);
      }

      const { error } = await supabase
        .from('messages')
        .insert({
          content: content,
          sender_id: user.id,
          receiver_id: selectedUser.id,
        });

      if (error) throw error;

      setNewMessage("");
      loadMessages();
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (messageDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const handleLikeMessage = (messageId: string) => {
    const newLikedMessages = new Set(likedMessages);
    if (likedMessages.has(messageId)) {
      newLikedMessages.delete(messageId);
    } else {
      newLikedMessages.add(messageId);
    }
    setLikedMessages(newLikedMessages);
  };

  const handleReplyToMessage = (messageId: string) => {
    setReplyingTo(messageId);
    const message = messages.find(m => m.id === messageId);
    if (message) {
      setNewMessage(`@${message.profiles.username} `);
    }
  };

  const handleShareMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && navigator.share) {
      navigator.share({
        title: 'Message from SOOZ',
        text: message.content,
      });
    } else {
      // Fallback for browsers that don't support Web Share API
      navigator.clipboard.writeText(message?.content || '');
      toast.success('Message copied to clipboard');
    }
  };

  const handleBookmarkMessage = (messageId: string) => {
    toast.success('Message bookmarked');
  };

  if (!selectedUser) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Select a chat to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <OptimizedAvatar
            src={selectedUser.avatar_url || ""}
            alt={`${selectedUser.display_name || selectedUser.username}'s avatar`}
            fallback={selectedUser.display_name?.charAt(0) || selectedUser.username.charAt(0).toUpperCase()}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">
              {selectedUser.display_name || selectedUser.username}
            </h3>
            <p className="text-xs text-muted-foreground">Online</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Video className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isOwn = message.sender_id === user?.id;
          const isLiked = likedMessages.has(message.id);
          return (
            <div
              key={message.id}
              className={cn(
                "flex",
                isOwn ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[70%] rounded-2xl px-4 py-2 relative group",
                  isOwn
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                )}
              >
                <p className="text-sm break-words">{message.content}</p>
                <p className={cn(
                  "text-xs mt-1 opacity-70",
                  isOwn ? "text-right" : "text-left"
                )}>
                  {formatTime(message.created_at)}
                </p>
                
                {/* Thread Features - Only show for received messages */}
                {!isOwn && (
                  <ThreadFeatures
                    messageId={message.id}
                    isLiked={isLiked}
                    likeCount={isLiked ? 1 : 0}
                    onLike={handleLikeMessage}
                    onReply={handleReplyToMessage}
                    onShare={handleShareMessage}
                    onBookmark={handleBookmarkMessage}
                    className="mt-2"
                  />
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t bg-background">
        {/* Reply Indicator */}
        {replyingTo && (
          <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-lg">
            <Reply className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground flex-1">Replying to message</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setReplyingTo(null)}
            >
              ×
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <Camera className="h-4 w-4" />
          </Button>
          <div className="flex-1 relative">
            <Input
              placeholder={replyingTo ? "Write a reply..." : "Type a message..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pr-12 rounded-full bg-muted border-0 focus:ring-2 focus:ring-primary"
              disabled={loading}
            />
          </div>
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || loading}
            size="icon"
            className="h-8 w-8 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,.pdf,.doc,.docx"
          multiple
        />
      </div>
    </div>
  );
};