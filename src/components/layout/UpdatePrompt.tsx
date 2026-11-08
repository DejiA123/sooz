import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { applyUpdate, isUpdateReady, onUpdateReady } from "@/lib/appUpdate";
import { useCall } from "@/contexts/CallContext";

/**
 * "A new version of SOOZ is ready" — a small card above the tab bar with Update now / Later.
 * "Later" hides it until the next time the app comes back to the screen. Never shown during a call.
 */
export const UpdatePrompt = () => {
  const [ready, setReady] = useState(isUpdateReady);
  const [hidden, setHidden] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { callState } = useCall();

  useEffect(() => onUpdateReady(setReady), []);
  useEffect(() => {
    const onShow = () => { if (document.visibilityState === "visible") setHidden(false); };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);

  if (!ready || hidden || callState !== "IDLE") return null;

  return (
    <div className="update-prompt fixed inset-x-0 z-[90] flex justify-center px-3" role="dialog" aria-label="Update available">
      <div className="w-full max-w-md rounded-3xl border border-amber-400/25 bg-[#11131a] p-4 text-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-600 text-[#1a1204]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-bold leading-tight">A new version of SOOZ is ready</p>
            <p className="mt-1 text-[13.5px] leading-snug text-white/60">Update now to get the latest features and fixes. It only takes a second.</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setHidden(true)} className="h-11 flex-1 rounded-full bg-white/[0.08] text-[15px] font-semibold text-white/80 active:bg-white/15">
            Later
          </button>
          <button
            type="button"
            onClick={() => { setUpdating(true); applyUpdate(); }}
            disabled={updating}
            className="flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 text-[15px] font-bold text-[#1a1204] active:scale-[0.98] disabled:opacity-80"
          >
            {updating ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</> : "Update now"}
          </button>
        </div>
      </div>
    </div>
  );
};
