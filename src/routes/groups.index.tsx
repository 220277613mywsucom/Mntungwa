import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Users, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/groups/")({
  head: () => ({
    meta: [
      { title: "Groups — Nexus" },
      { name: "description", content: "Join UWC campus communities." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Groups />
    </RequireAuth>
  ),
});

interface GroupItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_gradient: string;
  group_members: { count: number }[];
}

function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [memberships, setMemberships] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("groups")
      .select("id, slug, name, description, cover_gradient, group_members(count)")
      .order("created_at", { ascending: false });
    setGroups((data ?? []) as unknown as GroupItem[]);
    const { data: mems } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user!.id);
    setMemberships(new Set((mems ?? []).map((m) => m.group_id)));
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (id: string) => {
    if (memberships.has(id)) {
      await supabase.from("group_members").delete().eq("group_id", id).eq("user_id", user!.id);
    } else {
      await supabase.from("group_members").insert({ group_id: id, user_id: user!.id });
    }
    load();
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) return toast.error("Pick a name");
    const { data, error } = await supabase
      .from("groups")
      .insert({ name: name.trim(), slug, description: desc.trim() || null, created_by: user!.id })
      .select()
      .single();
    if (error) return toast.error(error.message);
    if (data) {
      await supabase.from("group_members").insert({ group_id: data.id, user_id: user!.id });
      toast.success("Group created!");
      setName("");
      setDesc("");
      setCreating(false);
      load();
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campus Groups</h1>
        <button
          onClick={() => setCreating((c) => !c)}
          className="flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-glow"
        >
          <Plus className="h-4 w-4" /> New
        </button>
      </div>

      {creating && (
        <form
          onSubmit={create}
          className="space-y-3 rounded-3xl border border-border bg-card p-4 shadow-soft"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            maxLength={60}
            required
            className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="What's this group about?"
            maxLength={300}
            rows={2}
            className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-white shadow-glow"
          >
            Create group
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {groups.map((g) => {
          const joined = memberships.has(g.id);
          const count = g.group_members[0]?.count ?? 0;
          return (
            <div
              key={g.id}
              className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
            >
              <Link
                to="/groups/$slug"
                params={{ slug: g.slug }}
                className={`block h-20 bg-gradient-to-br ${g.cover_gradient}`}
              />
              <div className="p-4">
                <Link
                  to="/groups/$slug"
                  params={{ slug: g.slug }}
                  className="text-lg font-bold hover:underline"
                >
                  {g.name}
                </Link>
                {g.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {g.description}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> {count} members
                  </span>
                  <button
                    onClick={() => toggle(g.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      joined
                        ? "border border-border bg-secondary"
                        : "bg-gradient-brand text-white shadow-glow"
                    }`}
                  >
                    {joined ? "Joined" : "Join"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
