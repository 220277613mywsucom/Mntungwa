import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { PostCard, type PostRow } from "@/components/PostCard";
import { PostSkeleton, EmptyState } from "@/components/Skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Bookmark } from "lucide-react";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved — Nexus" },
      { name: "description", content: "Your saved posts on Nexus." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Saved />
    </RequireAuth>
  ),
});

const POST_QUERY = `
  id, user_id, group_id, content, image_url, created_at,
  profiles!posts_author_profile_fkey ( username, display_name, avatar_url ),
  groups ( slug, name ),
  likes ( user_id ),
  comments ( count ),
  bookmarks ( user_id )
`;

function Saved() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: bk } = await supabase
      .from("bookmarks")
      .select("post_id, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(100);
    const ids = (bk ?? []).map((b) => b.post_id);
    if (ids.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("posts")
      .select(POST_QUERY)
      .in("id", ids);
    const byId = new Map((data ?? []).map((p) => [p.id, p as unknown as PostRow]));
    setPosts(ids.map((id) => byId.get(id)!).filter(Boolean));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-glow">
          <Bookmark className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold">Saved posts</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          emoji="🔖"
          title="No saved posts yet"
          hint="Tap the bookmark icon on any post to save it for later."
        />
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onChange={load} />)
      )}
    </div>
  );
}
