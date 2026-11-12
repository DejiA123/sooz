import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCheck, Check, Download, Plus, Search, Send, Trash2, Users, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { bubbleTime } from "@/lib/chat";
import { fetchChatList, isChatVisible, messageSummary, searchPeople, type Attachment, type ChatMember, type ChatMessage, type ChatSummary, type PersonResult } from "@/services/api/chat";

/** Bottom sheet used by every chat sheet. */
/** The visible height above the on-screen keyboard (iPhone shrinks the visual viewport, not the layout). */
function useVisibleHeight(on: boolean) {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!on || !vv) return;
    const update = () => setH(vv.height);
    update();
    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, [on]);
  return h;
}

export const Sheet = ({ open, onClose, title, children, tall }: { open: boolean; onClose: () => void; title: string; children: ReactNode; tall?: boolean }) => {
  // Tall sheets shrink to fit above the keyboard instead of being pushed up off the screen.
  const visible = useVisibleHeight(open && !!tall);
  return (
  <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }} repositionInputs={!tall}>
    <DrawerContent overlayClassName="z-[85]" style={tall && visible ? { height: `min(88dvh, ${Math.round(visible - 16)}px)` } : undefined} className={cn("z-[85] rounded-t-[20px] border-black/5 bg-white pb-[max(env(safe-area-inset-bottom),12px)] text-neutral-900", tall && "h-[88dvh]", "sheet-light")}>
      <div className="relative flex items-center justify-center px-4 pb-2 pt-1">
        <DrawerTitle className="text-[16px] font-bold">{title}</DrawerTitle>
        <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 top-0 flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 active:bg-neutral-100"><X className="h-5 w-5" /></button>
      </div>
      {children}
    </DrawerContent>
  </Drawer>
  );
};

const PersonRow = ({ name, sub, avatar, group, right, onClick }: { name: string; sub?: ReactNode; avatar: string | null; group?: boolean; right?: ReactNode; onClick?: () => void }) => (
  <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left active:bg-neutral-100">
    <Avatar className="h-11 w-11">
      <AvatarImage src={avatar || ""} className="object-cover" />
      <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-700 font-bold text-white">{group ? <Users className="h-5 w-5" /> : name[0]?.toUpperCase()}</AvatarFallback>
    </Avatar>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[15px] font-semibold">{name}</span>
      {sub && <span className="block truncate text-[13px] text-neutral-500">{sub}</span>}
    </span>
    {right}
  </button>
);

// ── Forward ──────────────────────────────────────────────────────────────────────────────────

export const ForwardSheet = ({ open, messages, onClose, onForward }: {
  open: boolean;
  messages: ChatMessage[];
  onClose: () => void;
  onForward: (chatIds: string[]) => Promise<void>;
}) => {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const chats = useQuery({ queryKey: ["forward-chats"], queryFn: fetchChatList, enabled: open, staleTime: 30_000 });
  useEffect(() => { if (open) { setPicked(new Set()); setQ(""); } }, [open]);
  const list = (chats.data ?? []).filter((c) => isChatVisible(c) && c.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.activity.localeCompare(a.activity));
  const toggle = (c: ChatSummary) => setPicked((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else if (n.size < 5) n.add(c.id); return n; });
  return (
    <Sheet open={open} onClose={onClose} title="Forward to…" tall>
      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-10 w-full rounded-full bg-neutral-100 pl-9 pr-3 text-[15px] outline-none placeholder:text-neutral-400" />
        </div>
        <p className="mt-2 text-[12.5px] text-neutral-500">{messages.length === 1 ? messageSummary(messages[0]) : `${messages.length} messages`} · up to 5 chats</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1">
        {list.map((c) => (
          <PersonRow key={c.id} name={c.name} avatar={c.avatar} group={c.isGroup} sub={c.isGroup ? `${c.memberCount} members` : c.otherUsername ? `@${c.otherUsername}` : undefined} onClick={() => toggle(c)}
            right={<span className={cn("flex h-6 w-6 items-center justify-center rounded-full border-2", picked.has(c.id) ? "border-amber-400 bg-amber-400 text-[#1a1204]" : "border-neutral-300")}>{picked.has(c.id) && <Check className="h-4 w-4" strokeWidth={3} />}</span>} />
        ))}
      </div>
      {picked.size > 0 && (
        <div className="flex items-center gap-3 border-t border-neutral-200 px-4 pt-3">
          <p className="min-w-0 flex-1 truncate text-[14px] text-neutral-600">{list.filter((c) => picked.has(c.id)).map((c) => c.name).join(", ") || `${picked.size} chats`}</p>
          <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await onForward([...picked]); onClose(); } finally { setBusy(false); } }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 text-[#1a1204] active:scale-95 disabled:opacity-60" aria-label="Send">
            <Send className="h-5 w-5" />
          </button>
        </div>
      )}
    </Sheet>
  );
};

// ── Message info (read by / delivered to) ────────────────────────────────────────────────────

export const MessageInfoSheet = ({ open, msg, members, meId, onClose }: { open: boolean; msg: ChatMessage | null; members: ChatMember[]; meId: string; onClose: () => void }) => {
  if (!msg) return null;
  const others = members.filter((m) => m.userId !== meId);
  const read = others.filter((m) => m.lastReadAt && m.lastReadAt >= msg.createdAt);
  const delivered = others.filter((m) => !read.includes(m) && m.deliveredAt && m.deliveredAt >= msg.createdAt);
  const waiting = others.filter((m) => !read.includes(m) && !delivered.includes(m));
  const Section = ({ title, icon, people }: { title: string; icon: ReactNode; people: ChatMember[] }) => people.length ? (
    <div className="mt-3">
      <p className="flex items-center gap-2 px-4 text-[13px] font-semibold text-neutral-500">{icon} {title}</p>
      {people.map((m) => <PersonRow key={m.userId} name={m.name} avatar={m.avatar} sub={`@${m.username}`} />)}
    </div>
  ) : null;
  return (
    <Sheet open={open} onClose={onClose} title="Message info">
      <div className="max-h-[70dvh] overflow-y-auto pb-2">
        <div className="mx-4 rounded-2xl bg-neutral-100 px-3 py-2.5 text-[14.5px]">
          <p className="line-clamp-4 whitespace-pre-wrap">{messageSummary(msg) || "Message"}</p>
          <p className="mt-1 text-right text-[11.5px] text-neutral-500">{bubbleTime(msg.createdAt)}</p>
        </div>
        <Section title="Read by" icon={<CheckCheck className="h-4 w-4 text-sky-500" />} people={read} />
        <Section title="Delivered to" icon={<CheckCheck className="h-4 w-4" />} people={delivered} />
        <Section title="Sent" icon={<Check className="h-4 w-4" />} people={waiting} />
      </div>
    </Sheet>
  );
};

// ── Reactions (who reacted) ──────────────────────────────────────────────────────────────────

export const ReactionsSheet = ({ open, reactions, members, meId, onRemoveMine, onClose }: {
  open: boolean;
  reactions: { userId: string; emoji: string }[];
  members: Map<string, ChatMember>;
  meId: string;
  onRemoveMine: () => void;
  onClose: () => void;
}) => {
  const [tab, setTab] = useState<string>("all");
  const groups = useMemo(() => {
    const by = new Map<string, number>();
    reactions.forEach((r) => by.set(r.emoji, (by.get(r.emoji) ?? 0) + 1));
    return [...by.entries()].sort((a, b) => b[1] - a[1]);
  }, [reactions]);
  const list = reactions.filter((r) => tab === "all" || r.emoji === tab);
  return (
    <Sheet open={open} onClose={onClose} title={`${reactions.length} reaction${reactions.length === 1 ? "" : "s"}`}>
      <div className="flex gap-2 overflow-x-auto px-4 pb-2 hide-scrollbar">
        <button type="button" onClick={() => setTab("all")} className={cn("h-8 shrink-0 rounded-full px-3.5 text-[14px] font-semibold", tab === "all" ? "bg-neutral-900 text-white" : "bg-neutral-100")}>All {reactions.length}</button>
        {groups.map(([e, n]) => (
          <button key={e} type="button" onClick={() => setTab(e)} className={cn("h-8 shrink-0 rounded-full px-3 text-[14px] font-semibold", tab === e ? "bg-neutral-900 text-white" : "bg-neutral-100")}>{e} {n}</button>
        ))}
      </div>
      <div className="max-h-[55dvh] overflow-y-auto pb-2">
        {list.map((r) => {
          const m = members.get(r.userId);
          const mine = r.userId === meId;
          return (
            <PersonRow key={r.userId} name={mine ? "You" : m?.name || "Member"} avatar={m?.avatar ?? null} sub={mine ? "Tap to remove" : m ? `@${m.username}` : undefined}
              onClick={mine ? () => { onRemoveMine(); onClose(); } : undefined} right={<span className="text-[24px]">{r.emoji}</span>} />
          );
        })}
      </div>
    </Sheet>
  );
};

// ── Poll votes ───────────────────────────────────────────────────────────────────────────────

export const PollVotesSheet = ({ open, poll, votes, members, onClose }: {
  open: boolean;
  poll: Extract<Attachment, { type: "poll" }> | null;
  votes: Map<string, number[]> | undefined;
  members: Map<string, ChatMember>;
  onClose: () => void;
}) => {
  if (!poll) return null;
  return (
    <Sheet open={open} onClose={onClose} title="Poll details">
      <div className="max-h-[70dvh] overflow-y-auto px-1 pb-3">
        <p className="px-3 pb-2 text-[17px] font-bold">{poll.question}</p>
        {poll.options.map((opt, i) => {
          const who = [...(votes ?? new Map()).entries()].filter(([, o]) => o.includes(i)).map(([u]) => u);
          return (
            <div key={i} className="mb-2 rounded-2xl bg-neutral-100 py-1">
              <p className="flex justify-between px-3 pt-2 text-[15px] font-semibold"><span>{opt}</span><span className="text-neutral-500">{who.length} vote{who.length === 1 ? "" : "s"}</span></p>
              {who.map((u) => <PersonRow key={u} name={members.get(u)?.name || "Member"} avatar={members.get(u)?.avatar ?? null} />)}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
};

// ── Full-screen photo / video ────────────────────────────────────────────────────────────────

export const MediaViewer = ({ msg, senderName, onClose, onForward }: { msg: ChatMessage | null; senderName: string; onClose: () => void; onForward: () => void }) => {
  useEffect(() => {
    if (!msg) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [msg, onClose]);
  const a = msg?.attachment;
  if (!msg || !a || (a.type !== "image" && a.type !== "video")) return null;
  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-black text-white" role="dialog" aria-label="Photo">
      <div className="flex items-center gap-2 px-2 pt-[calc(env(safe-area-inset-top)+6px)]">
        <button type="button" aria-label="Close" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10"><X className="h-6 w-6" /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{senderName}</p>
          <p className="text-[12px] text-white/55">{new Date(msg.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
        </div>
        <button type="button" aria-label="Forward" onClick={onForward} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10"><Send className="h-5 w-5" /></button>
        <a href={a.url} download target="_blank" rel="noopener noreferrer" aria-label="Save" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10"><Download className="h-5 w-5" /></a>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center" onClick={onClose}>
        {a.type === "image"
          ? <img src={a.url} alt="" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
          : <video src={a.url} controls autoPlay playsInline className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()} />}
      </div>
      {msg.content && <p className="max-h-[25dvh] overflow-y-auto whitespace-pre-wrap px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 text-center text-[15px]">{msg.content}</p>}
    </div>
  );
};

// ── Create a poll ────────────────────────────────────────────────────────────────────────────

export const PollCreator = ({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (poll: { question: string; options: string[]; multiple: boolean }) => void }) => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(true);
  useEffect(() => { if (open) { setQuestion(""); setOptions(["", ""]); setMultiple(true); } }, [open]);
  const clean = options.map((o) => o.trim()).filter(Boolean);
  const ok = question.trim() && clean.length >= 2;
  return (
    <Sheet open={open} onClose={onClose} title="Create poll" tall>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-3">
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-neutral-500">Question</p>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={255} placeholder="Ask a question" className="h-12 w-full rounded-xl bg-neutral-100 px-3.5 text-[16px] outline-none placeholder:text-neutral-400" />
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-neutral-500">Options</p>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={o} maxLength={100} placeholder={`Option ${i + 1}`}
                  onChange={(e) => { const v = e.target.value; setOptions((prev) => { const n = prev.map((x, j) => (j === i ? v : x)); if (i === n.length - 1 && v.trim() && n.length < 12) n.push(""); return n; }); }}
                  className="h-11 min-w-0 flex-1 rounded-xl bg-neutral-100 px-3.5 text-[15.5px] outline-none placeholder:text-neutral-400" />
                {options.length > 2 && (
                  <button type="button" aria-label="Remove option" onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))} className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 active:bg-neutral-100"><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
            ))}
            {options.length < 12 && options[options.length - 1].trim() === "" ? null : options.length < 12 && (
              <button type="button" onClick={() => setOptions((p) => [...p, ""])} className="flex items-center gap-2 px-1 text-[14.5px] font-semibold text-amber-700"><Plus className="h-4 w-4" /> Add option</button>
            )}
          </div>
        </div>
        <label className="flex items-center justify-between rounded-xl bg-neutral-100 px-3.5 py-3 text-[15px]">
          Allow multiple answers
          <Switch checked={multiple} onCheckedChange={setMultiple} />
        </label>
      </div>
      <div className="px-4 pt-2">
        <button type="button" disabled={!ok} onClick={() => { onSend({ question: question.trim(), options: clean, multiple }); onClose(); }}
          className="h-12 w-full rounded-full bg-amber-400 text-[16px] font-bold text-[#1a1204] disabled:opacity-40">Send poll</button>
      </div>
    </Sheet>
  );
};

// ── Pick a person (share contact, start a chat, add to group) ────────────────────────────────

export const PeoplePicker = ({ open, title, meId, multiple, exclude, actionLabel, onClose, onDone }: {
  open: boolean;
  title: string;
  meId: string;
  multiple?: boolean;
  exclude?: Set<string>;
  actionLabel?: string;
  onClose: () => void;
  onDone: (people: PersonResult[]) => void;
}) => {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Map<string, PersonResult>>(new Map());
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (open) { setQ(""); setPicked(new Map()); } }, [open]);
  const people = useQuery({ queryKey: ["people-search", debounced], queryFn: () => searchPeople(debounced, meId), enabled: open, staleTime: 60_000 });
  const list = (people.data ?? []).filter((p) => !exclude?.has(p.id));
  return (
    <Sheet open={open} onClose={onClose} title={title} tall>
      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or @username" className="h-10 w-full rounded-full bg-neutral-100 pl-9 pr-3 text-[16px] outline-none placeholder:text-neutral-400" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1">
        {people.isLoading && <p className="px-4 py-6 text-center text-[14px] text-neutral-400">Searching…</p>}
        {!people.isLoading && list.length === 0 && <p className="px-4 py-6 text-center text-[14px] text-neutral-400">No one found</p>}
        {list.map((p) => (
          <PersonRow key={p.id} name={p.name} avatar={p.avatar} sub={`@${p.username}`}
            onClick={() => {
              if (!multiple) { onDone([p]); onClose(); return; }
              setPicked((s) => { const n = new Map(s); if (n.has(p.id)) n.delete(p.id); else n.set(p.id, p); return n; });
            }}
            right={multiple ? <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border-2", picked.has(p.id) ? "border-amber-400 bg-amber-400 text-[#1a1204]" : "border-neutral-300")}>{picked.has(p.id) && <Check className="h-4 w-4" strokeWidth={3} />}</span> : undefined} />
        ))}
      </div>
      {multiple && picked.size > 0 && (
        <div className="px-4 pt-2">
          <button type="button" onClick={() => { onDone([...picked.values()]); onClose(); }} className="h-12 w-full rounded-full bg-amber-400 text-[16px] font-bold text-[#1a1204]">
            {actionLabel || "Done"} ({picked.size})
          </button>
        </div>
      )}
    </Sheet>
  );
};
