
import { useState } from "react";
import { ChatList } from "@/components/chat/ChatList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { cn } from "@/lib/utils";

export default function Chat() {
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

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
