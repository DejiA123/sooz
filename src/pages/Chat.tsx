
import { useState } from "react";
import { Link } from "react-router-dom";
import { ChatList } from "@/components/chat/ChatList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export default function Chat() {
    const { user, loading } = useAuth();
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

    if (loading) return null;

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4 text-center animate-fade-in">
                <div className="w-24 h-24 bg-secondary/50 rounded-full mb-6 flex items-center justify-center">
                    <Lock className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Login to Chat</h1>
                <p className="text-muted-foreground mb-8 max-w-sm text-lg">
                    Join the conversation! You need to be logged in to view your messages and chat with friends.
                </p>
                <Link to="/auth">
                    <Button size="lg" className="rounded-full px-8 text-base font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95">
                        Log In or Sign Up
                    </Button>
                </Link>
            </div>
        );
    }

    // On mobile: if selectedChatId is null, show list. If not null, show window.
    // On desktop: show both.

    return (
        <div className="fixed inset-0 top-16 md:top-0 pb-20 md:pb-0 md:left-64 bg-background flex">
            {/* Left Panel: List */}
            <div className={cn(
                "w-full md:w-80 lg:w-96 h-full flex-shrink-0 border-r border-white/10",
                selectedChatId ? "hidden md:block" : "block"
            )}>
                <ChatList
                    selectedId={selectedChatId || undefined}
                    onSelect={setSelectedChatId}
                />
            </div>

            {/* Right Panel: Window */}
            <div className={cn(
                "flex-1 h-full bg-muted/10",
                !selectedChatId ? "hidden md:flex md:items-center md:justify-center" : "block"
            )}>
                {selectedChatId ? (
                    <ChatWindow
                        chatId={selectedChatId}
                        onBack={() => setSelectedChatId(null)}
                    />
                ) : (
                    <div className="text-center text-muted-foreground hidden md:block">
                        <div className="w-20 h-20 bg-muted rounded-full mx-auto mb-4 flex items-center justify-center">
                            <span className="text-4xl">💬</span>
                        </div>
                        <p className="text-lg font-medium">Select a conversation</p>
                        <p className="text-sm">Start messaging your friends</p>
                    </div>
                )}
            </div>
        </div>
    );
}
