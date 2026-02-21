import { X, Download, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface MobileDownloadModalProps {
    url: string;
    title: string;
    onClose: () => void;
}

export function MobileDownloadModal({ url, title, onClose }: MobileDownloadModalProps) {
    const [copied, setCopied] = useState(false);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            // Fallback for clipboard API
            const input = document.createElement("input");
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand("copy");
            document.body.removeChild(input);
        }
        setCopied(true);
        toast.success("Link copied! Paste in Safari to download.");
        setTimeout(() => setCopied(false), 3000);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 bg-card rounded-2xl border border-white/10 shadow-2xl animate-slide-up overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Download className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground">Save Video</h3>
                            <p className="text-xs text-muted-foreground line-clamp-1">{title}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/5 transition-colors"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Actions */}
                <div className="p-4 space-y-3">
                    {/* Instructions */}
                    <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            📱 <strong>Copy the link</strong> below, then <strong>paste it in Safari</strong> to download the video to your phone.
                        </p>
                    </div>

                    {/* Primary: Copy Link */}
                    <button
                        onClick={handleCopyLink}
                        className="flex items-center justify-center gap-2.5 w-full py-3.5 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm transition-all active:scale-95 shadow-lg shadow-primary/20"
                    >
                        {copied ? (
                            <>
                                <CheckCircle2 className="w-5 h-5" />
                                Copied! Now paste in Safari
                            </>
                        ) : (
                            <>
                                <Copy className="w-5 h-5" />
                                Copy Download Link
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
