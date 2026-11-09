import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Ban, BellOff, Camera, ChevronRight, FileText, Flag, Image as ImageIcon, LogOut, Pencil, Phone, Search, ShieldCheck, Star, Timer, Trash2, UserPlus, Users, Video, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { DISAPPEAR_OPTIONS, bubbleTime, dayChipLabel, disappearLabel, lastSeenLabel } from "@/lib/chat";
import { isMuted, messageSummary, type ChatInfo, type ChatMember, type ChatMessage } from "@/services/api/chat";
import { Sheet } from "./ChatSheets";

const URL_RE = /(?:https?:\/\/|www\.)[^\s<]+/gi;
const HAS_URL = /(?:https?:\/\/|www\.)[^\s<]+/i;
export const MUTE_OPTIONS = [
  { label: "8 hours", ms: 8 * 3600e3 },
  { label: "1 week", ms: 7 * 86400e3 },
  { label: "Always", ms: 100 * 365 * 86400e3 },
];

const Row = ({ icon, label, sub, right, danger, onClick }: { icon: ReactNode; label: string; sub?: string; right?: ReactNode; danger?: boolean; onClick?: () => void }) => (
  <button type="button" onClick={onClick} disabled={!onClick && !right} className={cn("flex w-full items-center gap-4 px-4 py-3.5 text-left active:bg-white/[0.05] disabled:active:bg-transparent", danger && "text-red-400")}>
    <span className={cn("shrink-0", danger ? "text-red-400" : "text-white/60")}>{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-[15.5px]">{label}</span>
      {sub && <span className="block truncate text-[13px] text-white/45">{sub}</span>}
    </span>
    {right ?? (onClick && !danger ? <ChevronRight className="h-5 w-5 text-white/30" /> : null)}
  </button>
);
const Card = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cn("mx-3 mt-3 overflow-hidden rounded-2xl bg-[#11141a]", className)}>{children}</div>;

export interface ChatInfoPanelProps {
  info: ChatInfo;
  members: ChatMember[];
  meId: string;
  online: (id: string) => boolean;
  messages: ChatMessage[];
  starred: Set<string>;
  isAdmin: boolean;
  canEditInfo: boolean;
  blocked: boolean;
  mutedUntil: string | null;
  onClose: () => void;
  onCall: (video: boolean) => void;
  onSearch: () => void;
  onJumpTo: (id: string) => void;
  onOpenMedia: (m: ChatMessage) => void;
  onMute: (ms: number | null) => void;
  onDisappear: (seconds: number | null) => void;
  onBlock: (on: boolean) => void;
  onReport?: () => void;
  onClear: () => void;
  onDeleteChat: () => void;
  onExit: () => void;
  onRename: (name: string) => void;
  onDescribe: (text: string) => void;
  onPhoto: (file: File) => void;
  onSetting: (key: "only_admins_send" | "only_admins_edit", on: boolean) => void;
  onAddMembers: () => void;
  onMemberAction: (m: ChatMember, action: "message" | "admin" | "dismiss" | "remove") => void;
}

export const ChatInfoPanel = (p: ChatInfoPanelProps) => {
  const [view, setView] = useState<"main" | "media" | "starred">("main");
  const [mediaTab, setMediaTab] = useState<"media" | "docs" | "links">("media");
  const [sheet, setSheet] = useState<"mute" | "disappear" | "rename" | "describe" | null>(null);
  const [memberSheet, setMemberSheet] = useState<ChatMember | null>(null);
  const [draft, setDraft] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);
  const isGroup = p.info.type === "group";
  const other = !isGroup ? p.members.find((m) => m.userId !== p.meId) : undefined;
  const title = isGroup ? p.info.name || "Group" : other?.name || "SOOZ member";
  const avatar = isGroup ? p.info.avatarUrl : other?.avatar ?? null;

  const media = useMemo(() => p.messages.filter((m) => !m.isDeleted && (m.attachment?.type === "image" || m.attachment?.type === "video")).reverse(), [p.messages]);
  const docs = useMemo(() => p.messages.filter((m) => !m.isDeleted && (m.attachment?.type === "file" || m.attachment?.type === "audio")).reverse(), [p.messages]);
  const links = useMemo(() => p.messages.filter((m) => !m.isDeleted && HAS_URL.test(m.content)).reverse(), [p.messages]);
  const starredMsgs = useMemo(() => p.messages.filter((m) => p.starred.has(m.id)).reverse(), [p.messages, p.starred]);
  const memberName = (id: string) => (id === p.meId ? "You" : p.members.find((m) => m.userId === id)?.name || "Member");
  const sortedMembers = [...p.members].sort((a, b) => (a.userId === p.meId ? -1 : b.userId === p.meId ? 1 : a.role !== b.role ? (a.role === "admin" ? -1 : 1) : a.name.localeCompare(b.name)));

  const header = (label: string, back: () => void) => (
    <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-2 pb-2 pt-[calc(env(safe-area-inset-top)+8px)]">
      <button type="button" aria-label="Back" onClick={back} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10"><ArrowLeft className="h-6 w-6" /></button>
      <p className="text-[17px] font-semibold">{label}</p>
    </div>
  );

  if (view === "media") {
    const tabs = [["media", "Media"], ["docs", "Docs"], ["links", "Links"]] as const;
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-[#05070b] text-white">
        {header("Media, links and docs", () => setView("main"))}
        <div className="flex gap-2 px-3 py-2">
          {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setMediaTab(k)} className={cn("h-8 flex-1 rounded-full text-[14px] font-semibold", mediaTab === k ? "bg-white text-black" : "bg-white/[0.08]")}>{l}</button>)}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {mediaTab === "media" && (media.length ? (
            <div className="grid grid-cols-3 gap-0.5">
              {media.map((m) => (
                <button key={m.id} type="button" onClick={() => p.onOpenMedia(m)} className="relative aspect-square overflow-hidden bg-white/5">
                  {m.attachment?.type === "image" ? <img src={m.attachment.url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <video src={`${m.attachment!.type === "video" ? m.attachment.url : ""}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover" />}
                  {m.attachment?.type === "video" && <Video className="absolute bottom-1.5 left-1.5 h-4 w-4 text-white drop-shadow" />}
                </button>
              ))}
            </div>
          ) : <p className="py-16 text-center text-[14px] text-white/40">No photos or videos yet</p>)}
          {mediaTab === "docs" && (docs.length ? docs.map((m) => (
            <a key={m.id} href={m.attachment && "url" in m.attachment ? m.attachment.url : "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 active:bg-white/5">
              <FileText className="h-8 w-8 shrink-0 text-amber-300" />
              <span className="min-w-0"><span className="block truncate text-[15px]">{messageSummary(m)}</span><span className="block text-[12.5px] text-white/45">{memberName(m.senderId)} · {dayChipLabel(m.createdAt)}</span></span>
            </a>
          )) : <p className="py-16 text-center text-[14px] text-white/40">No documents yet</p>)}
          {mediaTab === "links" && (links.length ? links.flatMap((m) => (m.content.match(URL_RE) ?? []).map((u, i) => (
            <a key={`${m.id}${i}`} href={u.startsWith("http") ? u : `https://${u}`} target="_blank" rel="noopener noreferrer" className="block px-4 py-3 active:bg-white/5">
              <span className="block truncate text-[15px] text-sky-400">{u}</span>
              <span className="block text-[12.5px] text-white/45">{memberName(m.senderId)} · {dayChipLabel(m.createdAt)}</span>
            </a>
          ))) : <p className="py-16 text-center text-[14px] text-white/40">No links yet</p>)}
        </div>
      </div>
    );
  }

  if (view === "starred") {
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-[#05070b] text-white">
        {header("Starred messages", () => setView("main"))}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {starredMsgs.length ? starredMsgs.map((m) => (
            <button key={m.id} type="button" onClick={() => { p.onJumpTo(m.id); p.onClose(); }} className="block w-full border-b border-white/[0.05] px-4 py-3 text-left active:bg-white/5">
              <span className="flex justify-between text-[13px] text-white/50"><span className="font-semibold text-white/80">{memberName(m.senderId)}</span><span>{dayChipLabel(m.createdAt)} {bubbleTime(m.createdAt)}</span></span>
              <span className="mt-1 line-clamp-3 block text-[15px]">{messageSummary(m)}</span>
            </button>
          )) : (
            <div className="px-8 py-20 text-center">
              <Star className="mx-auto mb-3 h-10 w-10 text-white/20" />
              <p className="text-[15px] text-white/55">Long-press any message and tap Star to find it here easily.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const muted = isMuted(p.mutedUntil);
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#05070b] text-white">
      {header(isGroup ? "Group info" : "Contact info", p.onClose)}
      <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <div className="flex flex-col items-center px-6 pt-5 text-center">
          <button type="button" disabled={!(isGroup && p.canEditInfo)} onClick={() => photoRef.current?.click()} className="relative">
            <Avatar className="h-28 w-28">
              <AvatarImage src={avatar || ""} className="object-cover" />
              <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-700 text-4xl font-bold text-white">{isGroup ? <Users className="h-12 w-12" /> : title[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            {isGroup && p.canEditInfo && <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-[#1a1204]"><Camera className="h-4 w-4" /></span>}
          </button>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onPhoto(f); e.target.value = ""; }} />
          <div className="mt-3 flex items-center gap-2">
            <h2 className="text-[23px] font-bold leading-tight">{title}</h2>
            {isGroup && p.canEditInfo && <button type="button" aria-label="Edit name" onClick={() => { setDraft(p.info.name || ""); setSheet("rename"); }} className="text-white/50"><Pencil className="h-4 w-4" /></button>}
          </div>
          <p className="mt-1 text-[14.5px] text-white/50">
            {isGroup ? `Group · ${p.members.length} members` : other ? <>@{other.username}{" · "}{p.online(other.userId) ? <span className="text-emerald-400">online</span> : lastSeenLabel(other.lastSeen)}</> : ""}
          </p>
          <div className="mt-4 flex gap-3">
            {[
              { label: "Audio", icon: Phone, run: () => p.onCall(false), show: !p.blocked },
              { label: "Video", icon: Video, run: () => p.onCall(true), show: !p.blocked },
              { label: "Add", icon: UserPlus, run: p.onAddMembers, show: isGroup && p.canEditInfo },
              { label: "Search", icon: Search, run: () => { p.onSearch(); p.onClose(); }, show: true },
            ].filter((b) => b.show).map(({ label, icon: Icon, run }) => (
              <button key={label} type="button" onClick={run} className="flex w-[76px] flex-col items-center gap-1.5 rounded-2xl bg-[#11141a] py-3 text-[13px] text-amber-300 active:bg-white/10">
                <Icon className="h-5 w-5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {isGroup ? (
          <Card>
            <button type="button" disabled={!p.canEditInfo} onClick={() => { setDraft(p.info.description || ""); setSheet("describe"); }} className="block w-full px-4 py-3.5 text-left">
              {p.info.description ? <p className="whitespace-pre-wrap text-[15px]">{p.info.description}</p> : <p className="text-[15px] text-amber-300">{p.canEditInfo ? "Add group description" : "No description"}</p>}
              <p className="mt-1 text-[12.5px] text-white/40">Created {dayChipLabel(p.info.createdAt)}</p>
            </button>
          </Card>
        ) : other?.bio ? (
          <Card><div className="px-4 py-3.5"><p className="text-[13px] text-white/45">About</p><p className="mt-0.5 whitespace-pre-wrap text-[15px]">{other.bio}</p></div></Card>
        ) : null}

        <Card>
          <Row icon={<ImageIcon className="h-5 w-5" />} label="Media, links and docs" onClick={() => setView("media")} right={<span className="flex items-center gap-1 text-[14px] text-white/45">{media.length + docs.length + links.length}<ChevronRight className="h-5 w-5 text-white/30" /></span>} />
          {media.length > 0 && (
            <div className="flex gap-1 overflow-x-auto px-4 pb-3 hide-scrollbar">
              {media.slice(0, 8).map((m) => (
                <button key={m.id} type="button" onClick={() => p.onOpenMedia(m)} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white/5">
                  {m.attachment?.type === "image" ? <img src={m.attachment.url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <video src={`${m.attachment && "url" in m.attachment ? m.attachment.url : ""}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />}
                </button>
              ))}
            </div>
          )}
          <Row icon={<Star className="h-5 w-5" />} label="Starred messages" onClick={() => setView("starred")} right={<span className="flex items-center gap-1 text-[14px] text-white/45">{starredMsgs.length || "None"}<ChevronRight className="h-5 w-5 text-white/30" /></span>} />
        </Card>

        <Card>
          <Row icon={<BellOff className="h-5 w-5" />} label="Mute notifications" sub={muted ? (new Date(p.mutedUntil!).getFullYear() > new Date().getFullYear() + 50 ? "Always" : `Until ${new Date(p.mutedUntil!).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`) : undefined}
            right={<Switch checked={muted} onCheckedChange={(on) => (on ? setSheet("mute") : p.onMute(null))} />} />
          <Row icon={<Timer className="h-5 w-5" />} label="Disappearing messages" sub={disappearLabel(p.info.disappearSeconds)} onClick={isGroup && !p.canEditInfo ? undefined : () => setSheet("disappear")} />
          {isGroup && p.isAdmin && (
            <>
              <Row icon={<ShieldCheck className="h-5 w-5" />} label="Only admins can send messages" right={<Switch checked={p.info.onlyAdminsSend} onCheckedChange={(on) => p.onSetting("only_admins_send", on)} />} />
              <Row icon={<Pencil className="h-5 w-5" />} label="Only admins can edit group info" right={<Switch checked={p.info.onlyAdminsEdit} onCheckedChange={(on) => p.onSetting("only_admins_edit", on)} />} />
            </>
          )}
        </Card>

        {isGroup && (
          <Card>
            <p className="px-4 pb-1 pt-3.5 text-[13.5px] font-semibold text-white/50">{p.members.length} members</p>
            {p.canEditInfo && <Row icon={<span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-[#1a1204]"><UserPlus className="h-5 w-5" /></span>} label="Add members" onClick={p.onAddMembers} />}
            {sortedMembers.map((m) => (
              <button key={m.userId} type="button" onClick={() => m.userId !== p.meId && setMemberSheet(m)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-white/[0.05]">
                <span className="relative">
                  <Avatar className="h-10 w-10"><AvatarImage src={m.avatar || ""} className="object-cover" /><AvatarFallback className="bg-white/10 font-semibold">{m.name[0]?.toUpperCase()}</AvatarFallback></Avatar>
                  {p.online(m.userId) && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#11141a] bg-emerald-500" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15.5px]">{m.userId === p.meId ? "You" : m.name}</span>
                  <span className="block truncate text-[13px] text-white/45">{m.bio || `@${m.username}`}</span>
                </span>
                {m.role === "admin" && <span className="shrink-0 rounded-md bg-amber-400/15 px-2 py-0.5 text-[11.5px] font-semibold text-amber-300">Group admin</span>}
              </button>
            ))}
          </Card>
        )}

        <Card>
          {!isGroup && other && <Row icon={<Users className="h-5 w-5" />} label="View profile" onClick={undefined} right={<Link to={`/profile/${other.username}`} className="text-[14px] font-semibold text-amber-300">Open</Link>} />}
          {!isGroup && <Row icon={<Ban className="h-5 w-5" />} label={p.blocked ? `Unblock ${title}` : `Block ${title}`} danger onClick={() => p.onBlock(!p.blocked)} />}
          {!isGroup && p.onReport && <Row icon={<Flag className="h-5 w-5" />} label={`Report ${title}`} danger onClick={p.onReport} />}
          <Row icon={<XCircle className="h-5 w-5" />} label="Clear chat" danger onClick={p.onClear} />
          {isGroup && <Row icon={<LogOut className="h-5 w-5" />} label="Exit group" danger onClick={p.onExit} />}
          <Row icon={<Trash2 className="h-5 w-5" />} label="Delete chat" danger onClick={p.onDeleteChat} />
        </Card>
      </div>

      <Sheet open={sheet === "mute"} onClose={() => setSheet(null)} title="Mute notifications">
        <div className="px-2 pb-2">
          <p className="px-3 pb-2 text-[13.5px] text-white/50">Others won't see that you muted this chat. You'll still be told if you're @mentioned.</p>
          {MUTE_OPTIONS.map((o) => <button key={o.label} type="button" onClick={() => { p.onMute(o.ms); setSheet(null); }} className="block w-full rounded-xl px-3 py-3.5 text-left text-[16px] active:bg-white/10">{o.label}</button>)}
        </div>
      </Sheet>
      <Sheet open={sheet === "disappear"} onClose={() => setSheet(null)} title="Disappearing messages">
        <div className="px-2 pb-2">
          <p className="px-3 pb-2 text-[13.5px] text-white/50">New messages in this chat will disappear after the time you choose.</p>
          {DISAPPEAR_OPTIONS.map((o) => (
            <button key={o.label} type="button" onClick={() => { p.onDisappear(o.seconds); setSheet(null); }} className="flex w-full items-center justify-between rounded-xl px-3 py-3.5 text-left text-[16px] active:bg-white/10">
              {o.label}
              <span className={cn("h-5 w-5 rounded-full border-2", (p.info.disappearSeconds ?? null) === o.seconds ? "border-amber-400 bg-amber-400 shadow-[inset_0_0_0_3px_#121317]" : "border-white/30")} />
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === "rename" || sheet === "describe"} onClose={() => setSheet(null)} title={sheet === "rename" ? "Group name" : "Group description"}>
        <div className="px-4 pb-2">
          {sheet === "rename"
            ? <input autoFocus value={draft} maxLength={100} onChange={(e) => setDraft(e.target.value)} className="h-12 w-full rounded-xl bg-white/[0.08] px-3.5 text-[16px] outline-none" />
            : <textarea autoFocus value={draft} maxLength={2048} rows={5} onChange={(e) => setDraft(e.target.value)} className="w-full resize-none rounded-xl bg-white/[0.08] px-3.5 py-3 text-[16px] outline-none" />}
          <button type="button" disabled={sheet === "rename" && !draft.trim()} onClick={() => { if (sheet === "rename") p.onRename(draft.trim()); else p.onDescribe(draft.trim()); setSheet(null); }}
            className="mt-3 h-12 w-full rounded-full bg-amber-400 text-[16px] font-bold text-[#1a1204] disabled:opacity-40">Save</button>
        </div>
      </Sheet>
      <Sheet open={!!memberSheet} onClose={() => setMemberSheet(null)} title={memberSheet?.name || ""}>
        {memberSheet && (
          <div className="px-2 pb-2">
            <button type="button" onClick={() => { p.onMemberAction(memberSheet, "message"); setMemberSheet(null); }} className="block w-full rounded-xl px-3 py-3.5 text-left text-[16px] active:bg-white/10">Message {memberSheet.name}</button>
            <Link to={`/profile/${memberSheet.username}`} className="block w-full rounded-xl px-3 py-3.5 text-left text-[16px] active:bg-white/10">View profile</Link>
            {p.isAdmin && (
              <>
                <button type="button" onClick={() => { p.onMemberAction(memberSheet, memberSheet.role === "admin" ? "dismiss" : "admin"); setMemberSheet(null); }} className="block w-full rounded-xl px-3 py-3.5 text-left text-[16px] active:bg-white/10">
                  {memberSheet.role === "admin" ? "Dismiss as admin" : "Make group admin"}
                </button>
                <button type="button" onClick={() => { p.onMemberAction(memberSheet, "remove"); setMemberSheet(null); }} className="block w-full rounded-xl px-3 py-3.5 text-left text-[16px] text-red-400 active:bg-white/10">Remove {memberSheet.name}</button>
              </>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
};
