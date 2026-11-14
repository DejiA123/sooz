import { useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useGoBack } from "@/hooks/useGoBack";
import { ReelsViewer } from "@/components/reels/ReelsViewer";
import { fetchPostsByIds } from "@/services/api/posts";
import { postItem } from "@/services/api/feed";

/**
 * One post (from Activity, a notification or a shared link): shown in the same full-screen player
 * as Home and profile videos — same buttons, comments and share — instead of an old-style card.
 */
export default function PostDetails() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const goBack = useGoBack("/");

  const q = useQuery({
    queryKey: ["post", id, user?.id ?? null],
    queryFn: async () => (await fetchPostsByIds([id!], user?.id))[0] ?? null,
    enabled: !!id && !authLoading,
    staleTime: 30_000,
  });
  const items = useMemo(() => (q.data ? [postItem(q.data)] : []), [q.data]);

  const post = q.data;
  const who = post?.profiles?.display_name || post?.profiles?.username;
  const pageTitle = who ? `Post by ${who} on SOOZ` : "Post | SOOZ";
  const meta = (
    <Helmet>
      <title>{pageTitle}</title>
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={post?.caption || "Check out this post on SOOZ"} />
      {post?.media_url && <meta property="og:image" content={post.thumbnail_url || post.media_url} />}
    </Helmet>
  );

  if (q.isLoading || authLoading) {
    return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black">{meta}<Loader2 className="h-8 w-8 animate-spin text-white/60" /></div>;
  }
  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-8 pt-24 text-center">
        {meta}
        <p className="text-[17px] font-semibold">This post isn't available</p>
        <p className="text-[14px] text-muted-foreground">It may have been deleted.</p>
        <button type="button" onClick={goBack} className="mt-2 h-10 rounded-full bg-foreground/[0.07] px-6 text-[15px] font-semibold active:bg-foreground/10">Go back</button>
      </div>
    );
  }
  return (
    <>
      {meta}
      <ReelsViewer items={items} startIndex={0} onClose={goBack} />
    </>
  );
}
