
import { useState, useEffect } from "react";
import { X, Check, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CreateGroupModalProps {
    onClose: () => void;
    onCreate: (groupName: string, participantIds: string[]) => void;
}

interface Profile {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
}

export const CreateGroupModal = ({ onClose, onCreate }: CreateGroupModalProps) => {
    const { user } = useAuth();
    const [step, setStep] = useState<1 | 2>(1); // 1: Select Users, 2: Group Info
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [groupName, setGroupName] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const fetchProfiles = async () => {
            const { data } = await supabase
                .from("profiles")
                .select("id, username, display_name, avatar_url")
                .neq("id", user?.id || "")
                .limit(20);

            if (data) setProfiles(data);
        };
        fetchProfiles();
    }, [user]);

    const [loading, setLoading] = useState(false);

    // ... existing useEffect ...

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const filteredProfiles = profiles.filter(p =>
    (p.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.display_name?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleCreate = async () => {
        if (!user) return;
        const participantIds = Array.from(selectedIds);

        // Validation
        if (participantIds.length === 0) return;
        if (participantIds.length > 1 && !groupName.trim()) return;

        setLoading(true);
        try {
            const isGroup = participantIds.length > 1;

            // 1. Create Conversation
            const { data: conv, error: convError } = await supabase
                .from('conversations')
                .insert({
                    type: isGroup ? 'group' : 'direct',
                    name: isGroup ? groupName : null
                })
                .select()
                .single();

            if (convError) throw convError;

            // 2. Add Participants (Me + Selected)
            const participants = [user.id, ...participantIds].map(uid => ({
                conversation_id: conv.id,
                user_id: uid
            }));

            const { error: partError } = await supabase
                .from('conversation_participants')
                .insert(participants);

            if (partError) throw partError;

            // Success
            onCreate(groupName, participantIds); // Parent just needs notification
            onClose();

        } catch (error) {
            console.error("Failed to create chat:", error);
        } finally {
            setLoading(false);
        }
    };

    // Determine action behavior based on selection size
    const isSingleChat = selectedIds.size === 1;

    const handleNext = () => {
        if (isSingleChat) {
            // Create immediately for DM
            handleCreate();
        } else {
            // Go to naming step for Group
            setStep(2);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                    <h2 className="font-bold text-lg">
                        {step === 1 ? "New Group Chat" : "Name Your Group"}
                    </h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Content */}
                <div className="p-4">
                    {step === 1 ? (
                        <>
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search people..."
                                    className="pl-9 bg-muted/50 border-input"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                                {filteredProfiles.map((p) => {
                                    const isSelected = selectedIds.has(p.id);
                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => toggleSelection(p.id)}
                                            className={cn(
                                                "flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all",
                                                isSelected ? "bg-primary/10 border-primary/20" : "hover:bg-muted/50 border border-transparent"
                                            )}
                                        >
                                            <div className="relative">
                                                <Avatar className="w-10 h-10 border border-border">
                                                    <AvatarImage src={p.avatar_url || undefined} />
                                                    <AvatarFallback>{p.username[0].toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                {isSelected && (
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center border border-background">
                                                        <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="font-semibold text-sm truncate">{p.display_name || p.username}</p>
                                                <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-4 flex justify-end">
                                <Button
                                    disabled={selectedIds.size === 0 || loading}
                                    onClick={handleNext}
                                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                    {loading ? "Creating..." : selectedIds.size === 1 ? "Start Chat" : `Next (${selectedIds.size})`}
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-6 py-4">
                            <div className="flex justify-center">
                                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                                    <Users className="w-8 h-8 text-muted-foreground" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium ml-1">Group Name</label>
                                <Input
                                    placeholder="e.g. Weekend Trip 🌴"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    autoFocus
                                    className="h-12 text-lg"
                                />
                            </div>

                            <div className="flex gap-3 justify-end mt-8">
                                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                                <Button onClick={handleCreate} disabled={!groupName.trim() || loading}>
                                    {loading ? "Creating..." : "Create Group"}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
