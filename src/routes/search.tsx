import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/AppShell";
import { PostCard, type PostRow } from "@/components/PostCard";
import { ListSkeleton, EmptyState } from "@/components/Skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Search as SearchIcon, Hash, Users, FileText } from "lucide-react";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — Nexus" },
      { name: "description", content: "Search students, posts, hashtags and groups across UWC." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <SearchPage />
    </RequireAuth>
  ),
});

type Tab = "all" | "people" | "posts" | "tags" | "groups";

interface ProfileItem {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
}

interface GroupItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

interface TagCount {
  tag: string;
  count: number;
}

const POST_QUERY = `
  id, user_id, group_id, content, image_url, created_at,
  profiles!posts_author_profile_fkey ( username, display_name, avatar_url ),
  groups ( slug, name ),
  likes ( user_id ),
  comments ( count ),
  bookmarks ( user_id )
`;

function SearchPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [people, setPeople] = useState<ProfileItem[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setPeople([]);
      setPosts([]);
      setTags([]);
      setGroups([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const tagTerm = term.replace(/^#/, "").toLowerCase();
      const [pe, po, ta, gr] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, bio")
          .or(`display_name.ilike.%${term}%,username.ilike.%${term}%`)
          .neq("id", user!.id)
          .limit(20),
        supabase
          .from("posts")
          .select(POST_QUERY)
          .ilike("content", `%${term}%`)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("post_hashtags")
          .select("tag")
          .ilike("tag", `%${tagTerm}%`)
          .limit(200),
        supabase
          .from("groups")
          .select("id, slug, name, description")
          .or(`name.ilike.%${term}%,description.ilike.%${term}%,slug.ilike.%${term}%`)
          .limit(10),
      ]);
      setPeople((pe.data ?? []) as ProfileItem[]);
      setPosts((po.data ?? []) as unknown as PostRow[]);
      setGroups((gr.data ?? []) as GroupItem[]);
      // tally tags
      const counts = new Map<string, number>();
      for (const row of ta.data ?? []) counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
      setTags(
        Array.from(counts.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20)
      );
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, user]);

  const showAll = tab === "all";
  const hasResults = people.length || posts.length || tags.length || groups.length;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Search</h1>

      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft focus-within:border-primary">
        <SearchIcon className="h-4 w-4 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people, posts, #hashtags, groups…"
          className="w-full bg-transparent outline-none"
        />
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1 shadow-soft">
        {(["all", "people", "posts", "tags", "groups"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-xl px-4 py-1.5 text-sm font-semibold capitalize transition ${
              tab === t ? "bg-gradient-brand text-white shadow-glow" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {!q.trim() ? (
        <EmptyState emoji="🔍" title="Search Nexus" hint="Find students, posts, hashtags, groups." />
      ) : loading ? (
        <ListSkeleton />
      ) : !hasResults ? (
        <EmptyState emoji="🤷" title="No results" hint="Try a different search term." />
      ) : (
        <div className="space-y-6">
          {(showAll || tab === "people") && people.length > 0 && (
            <section className="space-y-2">
              {showAll && (
                <h2 className="flex items-center gap-2 px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  <Users className="h-4 w-4" /> People
                </h2>
              )}
              {people.map((p) => (
                <Link
                  key={p.id}
                  to="/u/$username"
                  params={{ username: p.username }}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:shadow-glow"
                >
                  <Avatar
                    name={p.display_name}
                    url={p.avatar_url}
                    size={44}
                    userId={p.id}
                    showPresence
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p.display_name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
                  </div>
                </Link>
              ))}
            </section>
          )}

          {(showAll || tab === "tags") && tags.length > 0 && (
            <section className="space-y-2">
              {showAll && (
                <h2 className="flex items-center gap-2 px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  <Hash className="h-4 w-4" /> Hashtags
                </h2>
              )}
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Link
                    key={t.tag}
                    to="/tag/$tag"
                    params={{ tag: t.tag }}
                    className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold shadow-soft transition hover:shadow-glow"
                  >
                    <span className="text-primary">#{t.tag}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">{t.count}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {(showAll || tab === "groups") && groups.length > 0 && (
            <section className="space-y-2">
              {showAll && (
                <h2 className="flex items-center gap-2 px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  <Users className="h-4 w-4" /> Groups
                </h2>
              )}
              {groups.map((g) => (
                <Link
                  key={g.id}
                  to="/groups/$slug"
                  params={{ slug: g.slug }}
                  className="block rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:shadow-glow"
                >
                  <p className="font-semibold">{g.name}</p>
                  {g.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{g.description}</p>
                  )}
                </Link>
              ))}
            </section>
          )}

          {(showAll || tab === "posts") && posts.length > 0 && (
            <section className="space-y-3">
              {showAll && (
                <h2 className="flex items-center gap-2 px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  <FileText className="h-4 w-4" /> Posts
                </h2>
              )}
              {posts.map((p) => (
                <PostCard key={p.id} post={p} onChange={() => setQ(q)} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
