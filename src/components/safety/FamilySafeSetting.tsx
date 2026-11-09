import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { turnOffFamilySafe, turnOnFamilySafe, useFamilySafe } from "@/lib/familySafe";
import { resetForYou } from "@/services/api/feed";

const PinInput = ({ value, onChange, label, autoFocus }: { value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean }) => (
  <label className="block">
    <span className="text-[12.5px] text-muted-foreground">{label}</span>
    <input
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={4}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
      className="mt-1 w-full rounded-xl border border-border/30 bg-secondary/40 px-4 py-3 text-center text-[22px] tracking-[0.6em] focus:outline-none focus:ring-1 focus:ring-amber-400/60"
    />
  </label>
);

/** Settings → Safety: family-safe mode, locked with a parent's 4-digit PIN. */
export const FamilySafeSetting = () => {
  const on = useFamilySafe();
  const qc = useQueryClient();
  const [step, setStep] = useState<null | "set" | "unlock">(null);
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshFeeds = () => { resetForYou(); qc.invalidateQueries({ queryKey: ["feed"] }); };
  const close = () => { setStep(null); setPin(""); setAgain(""); };

  const confirmOn = async () => {
    if (pin.length !== 4) { toast("Choose a 4-digit PIN"); return; }
    if (pin !== again) { toast.error("The PINs don't match"); return; }
    setBusy(true);
    await turnOnFamilySafe(pin);
    setBusy(false);
    close();
    refreshFeeds();
    toast("Family-safe mode is on 🛡️");
  };
  const confirmOff = async () => {
    setBusy(true);
    const ok = await turnOffFamilySafe(pin);
    setBusy(false);
    if (!ok) { toast.error("That PIN isn't right"); setPin(""); return; }
    close();
    refreshFeeds();
    toast("Family-safe mode is off");
  };

  return (
    <div className="rounded-2xl border border-border/20 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-emerald-400">
            <ShieldCheck className="h-[18px] w-[18px]" />
          </div>
          <div>
            <p className="text-[14px] font-semibold">Family-safe mode</p>
            <p className="text-[12px] text-muted-foreground">{on ? "On — locked with a parent PIN" : "For children and anyone who wants it"}</p>
          </div>
        </div>
        <Switch checked={on || step === "set"} onCheckedChange={(v) => { setPin(""); setAgain(""); setStep(v ? (on ? null : "set") : (on ? "unlock" : null)); }} />
      </div>
      <ul className="mt-3 space-y-1 text-[12.5px] leading-snug text-muted-foreground">
        <li>• Leaves out anything with strong language or adult themes — videos, posts and comments</li>
        <li>• Leaves out anything someone has reported until a moderator has checked it</li>
        <li>• Stays on this phone even after signing out, and on the account on any phone</li>
        <li>• A parent's 4-digit PIN is needed to turn it off</li>
      </ul>
      {step === "set" && (
        <div className="mt-4 space-y-3 rounded-xl bg-secondary/30 p-3">
          <PinInput label="Choose a parent PIN" value={pin} onChange={setPin} autoFocus />
          <PinInput label="Type it again" value={again} onChange={setAgain} />
          <div className="flex gap-2">
            <button type="button" onClick={close} className="flex-1 rounded-full bg-secondary py-2.5 text-[14px] font-semibold">Cancel</button>
            <button type="button" disabled={busy} onClick={confirmOn} className="flex-1 rounded-full bg-amber-400 py-2.5 text-[14px] font-bold text-black disabled:opacity-50">Turn on</button>
          </div>
        </div>
      )}
      {step === "unlock" && (
        <div className="mt-4 space-y-3 rounded-xl bg-secondary/30 p-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold"><Lock className="h-4 w-4" /> Enter the parent PIN to turn it off</p>
          <PinInput label="Parent PIN" value={pin} onChange={setPin} autoFocus />
          <div className="flex gap-2">
            <button type="button" onClick={close} className="flex-1 rounded-full bg-secondary py-2.5 text-[14px] font-semibold">Cancel</button>
            <button type="button" disabled={busy || pin.length !== 4} onClick={confirmOff} className="flex-1 rounded-full bg-red-500 py-2.5 text-[14px] font-bold text-white disabled:opacity-50">Turn off</button>
          </div>
        </div>
      )}
    </div>
  );
};
