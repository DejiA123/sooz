import { lazy, Suspense, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkMinus, Edit, Flag, Link2, Play, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { postShareUrl } from "@/lib/shareLink";
import { soozTikTokLink } from "@/services/api/reposts";
import { resetForYou, type FeedItem } from "@/services/api/feed";
import type { ProfileTab } from "@/services/api/profileTabs";

const ShareSheet = lazy(() => import("@/components/reels/ShareSheet").then((m) => ({ default: m.ShareSheet })));
const ReportSheet = lazy(() => import("@/components/safety/ReportSheet").then((m) => ({ default: m.ReportSheet })));
const EditPostDialog = lazy(() => import("@/components/feed/EditPostDialog").then((m) => ({ default: m.EditPostDialog })));

/** Long-press a tile on a profile: TikTok-style options for that post or video. */
export const TileOptions = ({ item, tab, onClose, onWatch }: {
  item: FeedItem | null;
  tab: ProfileTab;
  onClose: () => void;
  onWatch: () => void;
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sub, setSub] = useState<null | "share" | "report" | "edit">(null);
  const [menuOpen, setMenuOpen] = useState(true);
  if (!item) return null;

  const post = item.kind === "post" ? item.post : null;
  const video = item.kind === "tiktok" ? item.video : null;
  const mine = !!(post && user && post.user_id === user.id);
  const link = post ? postShareUrl(post.id) : soozTikTokLink(video!);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["profile-tab"] });

  const done = () => { setMenuOpen(false); onClose(); };
  const then = (next: typeof sub) => { setMenuOpen(false); setSub(next); };

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast.success("Link copied"); } catch { toast.error("Couldn't copy the link"); }
    done();
  };

  const save = async (on: boolean) => {
    if (!user || !post) return;
    done();
    const { error } = on
      ? await supabase.from("bookmarks").insert({ user_id: user.id, post_id: post.id })
      : await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("post_id", post.id);
    if (error && !(on && error.code === "23505")) { toast.error("Couldn't update saved posts"); return; }
    toast.success(on ? "Saved" : "Removed from saved");
    refresh();
  };

  const remove = async () => {
    if (!post || !mine) return;
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    done();
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) { toast.error("Couldn't delete the post"); return; }
    toast.success("Post deleted");
    resetForYou();
    queryClient.invalidateQueries({ queryKey: ["feed"] });
    refresh();
  };

  const rows: { icon: typeof Play; label: string; onClick: () => void; danger?: boolean }[] = [
    { icon: Play, label: "Watch", onClick: () => { done(); onWatch(); } },
    { icon: Share2, label: "Share", onClick: () => then("share") },
    { icon: Link2, label: "Copy link", onClick: copy },
  ];
  if (post && mine) rows.push({ icon: Edit, label: "Edit caption", onClick: () => then("edit") });
  if (post && user && tab === "saved") rows.push({ icon: BookmarkMinus, label: "Remove from Saved", onClick: () => save(false) });
  else if (post && user && !mine) rows.push({ icon: Bookmark, label: "Save", onClick: () => save(true) });
  if (!mine && user) rows.push({ icon: Flag, label: "Report", onClick: () => then("report"), danger: true });
  if (mine) rows.push({ icon: Trash2, label: "Delete post", onClick: remove, danger: true });

  const title = post ? post.caption || (post.media_type === "video" ? "Video" : "Photo") : video!.title || "Christian TikTok";
  const thumb = post ? post.thumbnail_url || (post.media_type === "image" ? post.media_url : null) : null;

  return (
    <>
      <Drawer open={menuOpen} onOpenChange={(o) => { if (!o) done(); }}>
        <DrawerContent className="border-white/10 bg-[#121318] pb-[calc(env(safe-area-inset-bottom,0px)+12px)] text-white">
          <DrawerTitle className="sr-only">Options</DrawerTitle>
          <div className="flex items-center gap-3 px-5 pb-2 pt-3">
            {thumb && <img src={thumb} alt="" className="h-12 w-9 shrink-0 rounded-md object-cover" />}
            <p className="line-clamp-2 text-[13.5px] text-white/70">{title}</p>
          </div>
          <div className="px-2">
            {rows.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={r.onClick}
                className={cn("flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left text-[16px] font-medium active:bg-white/10", r.danger ? "text-[#ff5a6e]" : "text-white")}
              >
                <r.icon className="h-5 w-5" /> {r.label}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      <Suspense fallback={null}>
        {sub === "share" && (
          <ShareSheet item={post ? { kind: "post", post } : { kind: "tiktok", video: video! }} open onOpenChange={(o) => { if (!o) { setSub(null); onClose(); } }} />
        )}
        {sub === "report" && (
          <ReportSheet
            target={post
              ? { type: "post", id: post.id, owner: post.user_id, snapshot: `${post.profiles?.username ?? "?"}: ${post.caption ?? ""}${post.media_url ? `\n${post.media_url}` : ""}` }
              : { type: "tiktok", id: video!.tiktok_id, snapshot: `@${video!.author_handle ?? "?"}: ${video!.title ?? ""}` }}
            open
            onOpenChange={(o) => { if (!o) { setSub(null); onClose(); } }}
            onReported={refresh}
          />
        )}
        {sub === "edit" && post && (
          <EditPostDialog
            post={{ id: post.id, caption: post.caption }}
            open
            onOpenChange={(o) => { if (!o) { setSub(null); onClose(); } }}
            onUpdate={() => refresh()}
          />
        )}
      </Suspense>
    </>
  );
};
