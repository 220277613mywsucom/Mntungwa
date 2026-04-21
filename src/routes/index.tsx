import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Composer } from "@/components/Composer";
import { StoriesTray } from "@/components/Stories";
import { PostCard, type PostRow } from "@/components/PostCard";
import { PostSkeleton, EmptyState } from "@/components/Skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useBlocks } from "@/lib/blocks";
import { Sparkles, Globe, UserCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Feed — Nexus" },
      { name: "description", content: "Your UWC campus feed." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Feed />
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

type Tab = "all" | "following";

function Feed() {
  const { user } = useAuth();
  const { blockedIds } = useBlocks();
  const [tab, setTab] = useState<Tab>("all");
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    if (tab === "following") {
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user!.id);
      const ids = (follows ?? []).map((f) => f.following_id);
      if (ids.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("posts")
        .select(POST_QUERY)
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(50);
      setPosts((data ?? []) as unknown as PostRow[]);
    } else {
      const { data } = await supabase
        .from("posts")
        .select(POST_QUERY)
        .order("created_at", { ascending: false })
        .limit(50);
      setPosts((data ?? []) as unknown as PostRow[]);
    }
    setLoading(false);
  }, [tab, user]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("feed-posts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-3xl bg-gradient-brand p-6 text-white shadow-glow">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <span className="text-xs font-bold uppercase tracking-wider opacity-90">
            UWC Students Only
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold">Your campus, in real time.</h1>
        <p className="mt-1 text-sm opacity-90">Post, react, chat & join groups.</p>
      </div>

      <StoriesTray />

      <Composer onPosted={load} />

      <div className="flex rounded-2xl border border-border bg-card p-1 shadow-soft">
        <TabBtn active={tab === "all"} onClick={() => setTab("all")} icon={Globe} label="All campus" />
        <TabBtn
          active={tab === "following"}
          onClick={() => setTab("following")}
          icon={UserCheck}
          label="Following"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : posts.filter((p) => !blockedIds.has(p.user_id)).length === 0 ? (
        <EmptyState
          emoji="👀"
          title={tab === "following" ? "Nothing here yet" : "No posts yet"}
          hint={
            tab === "following" ? (
              <>
                Follow students in{" "}
                <Link to="/explore" className="text-primary hover:underline">
                  Explore
                </Link>{" "}
                to fill this feed.
              </>
            ) : (
              "Be the first to post on Nexus!"
            )
          }
        />
      ) : (
        posts
          .filter((p) => !blockedIds.has(p.user_id))
          .map((p) => <PostCard key={p.id} post={p} onChange={load} />)
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
        active ? "bg-gradient-brand text-white shadow-glow" : "text-muted-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
