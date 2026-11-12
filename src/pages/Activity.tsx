import { useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Heart, UserPlus, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useGoBack } from "@/hooks/useGoBack";
import { LazyImage } from "@/components/feed/LazyImage";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, isToday, isThisWeek } from "date-fns";

interface ActivityItem {
  id: string;
  type: "like" | "comment" | "follow" | "missed_call" | "message" | "incoming_call" | "outgoing_call";
  created_at: string;
  user: { username: string; avatar_url: string | null; };
  post_id?: string;
  post_media?: { url: string | null; type: string | null; };
  content?: string;
}

export default function Activity() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activity', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const [notificationsResult, followsResult, likesResult] = await Promise.all([
        supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from("follows").select(`id, created_at, follower:follower_id(username, avatar_url)`).eq("following_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("likes").select(`id, created_at, post_id, user:user_id(username, avatar_url), posts!inner(user_id, media_url, media_type)`).eq("posts.user_id", user.id).neq("user_id", user.id).order("created_at", { ascending: false }).limit(20)
      ]);
      const notifications = notificationsResult.data;
      const follows = followsResult.data;
      const likes = likesResult.data;
      if (notificationsResult.error) throw notificationsResult.error;
      let notifItems: ActivityItem[] = [];
      if (notifications && notifications.length > 0) {
        const actorIds = [...new Set(notifications.map(n => n.actor_id).filter(Boolean))];
        const { data: actors } = await supabase.from('profiles').select('id, username, avatar_url').in('id', actorIds);
        const actorMap = Object.fromEntries(actors?.map(a => [a.id, a]) || []);
        notifItems = notifications.map(n => ({ id: n.id, type: n.type as any, created_at: n.created_at, user: { username: actorMap[n.actor_id!]?.username || 'Unknown', avatar_url: actorMap[n.actor_id!]?.avatar_url || null }, post_id: n.reference_id || undefined, content: n.content }));
      }
      const followActivities = (follows || []).map(f => ({ id: f.id, type: "follow" as const, created_at: f.created_at, // @ts-ignore
        user: f.follower, content: "started following you." }));
      const likeActivities = (likes || []).map(l => ({ id: l.id, type: "like" as const, created_at: l.created_at, // @ts-ignore
        user: l.user, post_id: l.post_id, post_media: { // @ts-ignore
          url: l.posts?.media_url, // @ts-ignore
          type: l.posts?.media_type }, content: "liked your post." }));
      return [...notifItems, ...followActivities, ...likeActivities]
        .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) as ActivityItem[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const groupedActivities = useMemo(() => {
    const groups: Record<string, ActivityItem[]> = { "Today": [], "This Week": [], "Earlier": [] };
    activities.forEach(activity => {
      const date = new Date(activity.created_at);
      if (isToday(date)) groups["Today"].push(activity);
      else if (isThisWeek(date)) groups["This Week"].push(activity);
      else groups["Earlier"].push(activity);
    });
    return Object.entries(groups).filter(([_, items]) => items.length > 0);
  }, [activities]);

  // Back to where they came from (usually the Messages inbox), or the inbox if opened directly.
  const goBack = useGoBack("/chat");

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="flex items-center gap-1 px-2 pb-3 pt-1">
        <button type="button" aria-label="Back" onClick={goBack} className="flex h-10 w-10 items-center justify-center rounded-full text-foreground active:bg-secondary"><ArrowLeft className="h-6 w-6" /></button>
        <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">Activity</h1>
      </header>

      <ScrollArea className="h-[calc(100vh-120px)]">
        <div ref={scrollRef} className="px-4">
          {isLoading ? (
            <div className="space-y-4 pt-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/4" /></div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Heart className="w-10 h-10 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-bold">No activity yet</h3>
              <p className="text-sm text-muted-foreground max-w-[220px] mt-1">When people interact with your posts, you'll see them here.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedActivities.map(([groupName, items]) => (
                <section key={groupName}>
                  {/* Sticky time marker */}
                  <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md py-2 px-1">
                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">{groupName}</h2>
                  </div>

                  {/* Timeline */}
                  <div className="relative pl-6">
                    {/* Vertical line */}
                    <div className="absolute left-[11px] top-0 bottom-0 w-[1.5px] bg-border/30" />

                    <div className="space-y-1">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (item.type === 'follow') navigate(`/profile/${item.user.username}`);
                            else if (item.post_id) navigate(`/post/${item.post_id}`);
                          }}
                          className="relative flex items-center gap-3 py-3 cursor-pointer group"
                        >
                          {/* Timeline dot */}
                          <div className={cn(
                            "absolute -left-6 w-[9px] h-[9px] rounded-full border-2 border-background z-10",
                            item.type === 'like' ? "bg-destructive" :
                            item.type === 'follow' ? "bg-primary" :
                            item.type === 'comment' ? "bg-accent-foreground" : "bg-muted-foreground"
                          )} style={{ top: "50%", transform: "translateY(-50%) translateX(7px)" }} />

                          <Avatar className="w-9 h-9 shrink-0">
                            <AvatarImage src={item.user.avatar_url || ""} className="object-cover" />
                            <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{item.user.username[0].toUpperCase()}</AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <p className="text-[13px]">
                              <span className="font-bold">{item.user.username}</span>
                              <span className="text-muted-foreground ml-1">{item.content || item.type}</span>
                            </p>
                            <span className="text-[11px] text-muted-foreground/50">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                          </div>

                          {item.post_media?.url && (
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                              {item.post_media.type === 'video' ? (
                                <div className="w-full h-full bg-secondary flex items-center justify-center"><Play className="w-3 h-3 text-muted-foreground fill-current" /></div>
                              ) : (
                                <LazyImage src={item.post_media.url} className="w-full h-full object-cover" alt="Post" priority />
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}