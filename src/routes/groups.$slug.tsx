import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Composer } from "@/components/Composer";
import { PostCard, type PostRow } from "@/components/PostCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Users, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/groups/$slug")({
  head: () => ({
    meta: [{ title: "Group — Nexus" }],
  }),
  component: () => (
    <RequireAuth>
      <GroupPage />
    </RequireAuth>
  ),
});

interface GroupData {
  id: string;
  name: string;
  description: string | null;
  cover_gradient: string;
}

function GroupPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState<GroupData | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: g } = await supabase
      .from("groups")
      .select("id, name, description, cover_gradient")
      .eq("slug", slug)
      .maybeSingle();
    if (!g) {
      setLoading(false);
      return;
    }
    setGroup(g as GroupData);

    const [{ data: p }, { count }, { data: m }] = await Promise.all([
      supabase
        .from("posts")
        .select(
          `id, user_id, group_id, content, image_url, created_at,
           profiles!posts_author_profile_fkey(username, display_name, avatar_url),
           groups(slug, name),
           likes(user_id),
           comments(count)`
        )
        .eq("group_id", g.id)
        .order("created_at", { ascending: false }),
      supabase.from("group_members").select("*", { count: "exact", head: true }).eq("group_id", g.id),
      supabase.from("group_members").select("user_id").eq("group_id", g.id).eq("user_id", user!.id),
    ]);
    setPosts((p ?? []) as unknown as PostRow[]);
    setMemberCount(count ?? 0);
    setJoined((m ?? []).length > 0);
    setLoading(false);
  }, [slug, user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async () => {
    if (!group) return;
    if (joined) {
      await supabase
        .from("group_members")
        .delete()
        .eq("group_id", group.id)
        .eq("user_id", user!.id);
    } else {
      await supabase.from("group_members").insert({ group_id: group.id, user_id: user!.id });
    }
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <p className="font-semibold">Group not found</p>
        <Link to="/groups" className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to groups
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        to="/groups"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All groups
      </Link>
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        <div className={`h-32 bg-gradient-to-br ${group.cover_gradient}`} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{group.name}</h1>
              {group.description && (
                <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
              )}
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> {memberCount} members
              </p>
            </div>
            <button
              onClick={toggle}
              className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition ${
                joined
                  ? "border border-border bg-secondary"
                  : "bg-gradient-brand text-white shadow-glow"
              }`}
            >
              {joined ? "Joined" : "Join group"}
            </button>
          </div>
        </div>
      </div>

      {joined && <Composer groupId={group.id} onPosted={load} />}

      {posts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No posts in this group yet.
        </div>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onChange={load} />)
      )}
    </div>
  );
}
