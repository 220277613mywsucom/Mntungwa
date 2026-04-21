import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { PostCard, type PostRow } from "@/components/PostCard";
import { PostSkeleton, EmptyState } from "@/components/Skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Hash } from "lucide-react";

export const Route = createFileRoute("/tag/$tag")({
  head: ({ params }) => ({
    meta: [
      { title: `#${params.tag} — Nexus` },
      { name: "description", content: `UWC student posts tagged #${params.tag}.` },
    ],
  }),
  component: () => (
    <RequireAuth>
      <TagPage />
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

function TagPage() {
  const { tag } = Route.useParams();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: tagged } = await supabase
      .from("post_hashtags")
      .select("post_id")
      .eq("tag", tag.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(100);
    const ids = (tagged ?? []).map((t) => t.post_id);
    if (ids.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("posts")
      .select(POST_QUERY)
      .in("id", ids)
      .order("created_at", { ascending: false });
    setPosts((data ?? []) as unknown as PostRow[]);
    setLoading(false);
  }, [tag]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/explore" className="text-sm text-muted-foreground hover:underline">
        ← Explore
      </Link>
      <div className="rounded-3xl bg-gradient-cool p-6 text-white shadow-glow">
        <div className="flex items-center gap-3">
          <Hash className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">#{tag}</h1>
            <p className="text-sm opacity-90">{posts.length} {posts.length === 1 ? "post" : "posts"}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          emoji="🏷️"
          title={`No posts tagged #${tag}`}
          hint="Be the first to use this tag!"
        />
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onChange={load} />)
      )}
    </div>
  );
}
