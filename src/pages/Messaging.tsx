import { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { ChatList } from "@/components/messaging/ChatList";
import { ChatInterface } from "@/components/messaging/ChatInterface";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Button } from "@/components/ui/button";

interface ChatUser {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
}

export default function Messaging() {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<ChatUser | undefined>();
  const [showChatList, setShowChatList] = useState(true);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const handleSelectChat = (user: ChatUser) => {
    setSelectedUser(user);
    if (isMobile) {
      setShowChatList(false);
    }
  };

  const handleBackToList = () => {
    setShowChatList(true);
    setSelectedUser(undefined);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Please sign in to access messaging</p>
          <Button className="mt-4">Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Chat List - Desktop */}
      {!isMobile && (
        <div className="w-80 border-r bg-background">
          <ChatList 
            onSelectChat={handleSelectChat} 
            selectedUserId={selectedUser?.id}
          />
        </div>
      )}

      {/* Mobile View */}
      {isMobile && (
        <>
          {showChatList && (
            <div className="w-full bg-background">
              <ChatList 
                onSelectChat={handleSelectChat} 
                selectedUserId={selectedUser?.id}
              />
            </div>
          )}
          {!showChatList && selectedUser && (
            <div className="w-full bg-background">
              <ChatInterface 
                selectedUser={selectedUser} 
                onBack={handleBackToList}
                isMobile={true}
              />
            </div>
          )}
        </>
      )}

      {/* Chat Interface - Desktop */}
      {!isMobile && (
        <div className="flex-1 bg-background">
          <ChatInterface 
            selectedUser={selectedUser} 
            isMobile={false}
          />
        </div>
      )}
    </div>
  );
}