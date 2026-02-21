import { X, Download, Share2, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface MobileDownloadModalProps {
    url: string;
    title: string;
    onClose: () => void;
}

export function MobileDownloadModal({ url, title, onClose }: MobileDownloadModalProps) {
    const [copied, setCopied] = useState(false);

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    text: `Download: ${title}`,
                    url: url,
                });
            } catch (err: any) {
                if (err.name !== "AbortError") {
                    toast.error("Share failed");
                }
            }
        } else {
            // Fallback if share API not available
            handleCopyLink();
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            toast.success("Link copied! Paste in Safari to download.");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for clipboard API
            const input = document.createElement("input");
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand("copy");
            document.body.removeChild(input);
            setCopied(true);
            toast.success("Link copied!");
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleOpenInBrowser = () => {
        window.open(url, "_blank");
        toast.info("Once the video loads, tap Share ↗ then 'Save to Files'", {
            duration: 6000,
        });
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
                    {/* Primary: Share & Save */}
                    <button
                        onClick={handleShare}
                        className="flex items-center justify-center gap-2.5 w-full py-3.5 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm transition-all active:scale-95 shadow-lg shadow-primary/20"
                    >
                        <Share2 className="w-5 h-5" />
                        Share & Save to Files
                    </button>

                    <p className="text-[11px] text-muted-foreground text-center">
                        Tap above → Select <strong>"Save to Files"</strong> from the share menu
                    </p>

                    <div className="h-px bg-white/5" />

                    {/* Secondary Actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={handleOpenInBrowser}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-muted/50 border border-white/5 text-sm font-medium text-foreground transition-all active:scale-95"
                        >
                            <Download className="w-4 h-4" />
                            Open Video
                        </button>
                        <button
                            onClick={handleCopyLink}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-muted/50 border border-white/5 text-sm font-medium text-foreground transition-all active:scale-95"
                        >
                            {copied ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                                <Copy className="w-4 h-4" />
                            )}
                            {copied ? "Copied!" : "Copy Link"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
