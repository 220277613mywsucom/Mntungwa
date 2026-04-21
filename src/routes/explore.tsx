import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Search, UserPlus, UserCheck } from "lucide-react";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore — Nexus" },
      { name: "description", content: "Discover and follow other UWC students." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Explore />
    </RequireAuth>
  ),
});

interface ProfileItem {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  faculty: string | null;
}

function Explore() {
  const { user } = useAuth();
  const [people, setPeople] = useState<ProfileItem[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  const load = async () => {
    let query = supabase.from("profiles").select("*").neq("id", user!.id).limit(50);
    if (q.trim()) {
      query = query.or(`display_name.ilike.%${q}%,username.ilike.%${q}%`);
    }
    const { data } = await query;
    setPeople((data ?? []) as ProfileItem[]);

    const { data: f } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user!.id);
    setFollowing(new Set((f ?? []).map((x) => x.following_id)));
  };

  useEffect(() => {
    load();
  }, [q]);

  const toggle = async (id: string) => {
    if (following.has(id)) {
      await supabase.from("follows").delete().eq("follower_id", user!.id).eq("following_id", id);
    } else {
      await supabase.from("follows").insert({ follower_id: user!.id, following_id: id });
    }
    load();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Explore</h1>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search students by name or @username"
          className="w-full bg-transparent outline-none"
        />
      </div>

      <div className="space-y-2">
        {people.map((p) => {
          const isFollowing = following.has(p.id);
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft"
            >
              <Link to="/u/$username" params={{ username: p.username }}>
                <Avatar name={p.display_name} url={p.avatar_url} size={48} userId={p.id} showPresence />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to="/u/$username"
                  params={{ username: p.username }}
                  className="font-semibold hover:underline"
                >
                  {p.display_name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
                {p.bio && <p className="truncate text-sm text-muted-foreground">{p.bio}</p>}
              </div>
              <button
                onClick={() => toggle(p.id)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isFollowing
                    ? "border border-border bg-secondary text-foreground"
                    : "bg-gradient-brand text-white shadow-glow"
                }`}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="h-4 w-4" /> Following
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" /> Follow
                  </>
                )}
              </button>
            </div>
          );
        })}
        {people.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No students found. Try another search!
          </p>
        )}
      </div>
    </div>
  );
}
