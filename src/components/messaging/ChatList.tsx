import { useState, useEffect } from "react";
import { Search, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import ChatListSkeleton from "./ChatListSkeleton";

interface ChatUser {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
}

interface ChatListProps {
  onSelectChat: (user: ChatUser) => void;
  selectedUserId?: string;
}

export const ChatList = ({ onSelectChat, selectedUserId }: ChatListProps) => {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadChats();
    }
  }, [user]);

  const loadChats = async () => {
    if (!user) return;

    try {
      // Get users that the current user follows (potential chat partners)
      const { data: follows, error } = await supabase
        .from('follows')
        .select(`
          following_id,
          profiles:profiles!follows_following_id_fkey (id, username, display_name, avatar_url)
        `)
        .eq('follower_id', user.id)
        .limit(20);

      if (error) throw error;

      // Transform follows to chat users
      const chatUsers: ChatUser[] = (follows || [])
        .filter(f => f.profiles && typeof f.profiles === 'object' && 'username' in f.profiles)
        .map(f => ({
          id: (f.profiles as any).id,
          username: (f.profiles as any).username,
          display_name: (f.profiles as any).display_name,
          avatar_url: (f.profiles as any).avatar_url,
          last_message: "Start a conversation",
          last_message_time: undefined,
          unread_count: 0
        }));

      setChats(chatUsers);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (messageDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return <ChatListSkeleton />;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Search Bar */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-full bg-muted border-0 focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No chats found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery ? "Try a different search term" : "Follow people to start chatting"}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat)}
                className={cn(
                  "w-full p-4 flex items-center gap-3 hover:bg-accent transition-colors text-left",
                  selectedUserId === chat.id && "bg-accent"
                )}
              >
                <div className="relative">
                  <OptimizedAvatar
                    src={chat.avatar_url || ""}
                    alt={`${chat.display_name || chat.username}'s avatar`}
                    fallback={chat.display_name?.charAt(0) || chat.username.charAt(0).toUpperCase()}
                    size="lg"
                  />
                  {chat.unread_count && chat.unread_count > 0 && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-xs text-primary-foreground font-medium">
                        {chat.unread_count}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-sm truncate">
                      {chat.display_name || chat.username}
                    </h4>
                    {chat.last_message_time && (
                      <span className="text-xs text-muted-foreground">
                        {formatTime(chat.last_message_time)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {chat.last_message || "No messages yet"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};