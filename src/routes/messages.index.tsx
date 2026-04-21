import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/AppShell";
import { ListSkeleton, EmptyState } from "@/components/Skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useBlocks } from "@/lib/blocks";
import { timeAgo } from "@/lib/helpers";

export const Route = createFileRoute("/messages/")({
  head: () => ({ meta: [{ title: "Messages — Nexus" }] }),
  component: () => (
    <RequireAuth>
      <Inbox />
    </RequireAuth>
  ),
});

interface MsgRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  image_url: string | null;
  audio_url: string | null;
  read_at: string | null;
  created_at: string;
}

interface Conv {
  otherId: string;
  otherProfile: { username: string; display_name: string; avatar_url: string | null } | null;
  last: MsgRow;
  unread: boolean;
}

function Inbox() {
  const { user } = useAuth();
  const { blockedIds } = useBlocks();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
      .order("created_at", { ascending: false })
      .limit(200);
    const msgs = (data ?? []) as MsgRow[];

    const byOther = new Map<string, MsgRow>();
    for (const m of msgs) {
      const other = m.sender_id === user!.id ? m.recipient_id : m.sender_id;
      if (!byOther.has(other)) byOther.set(other, m);
    }
    const ids = Array.from(byOther.keys());
    let profilesMap = new Map<string, Conv["otherProfile"]>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", ids);
      profilesMap = new Map(
        (profs ?? []).map((p) => [
          p.id,
          { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url },
        ])
      );
    }
    const list: Conv[] = ids.map((id) => {
      const last = byOther.get(id)!;
      return {
        otherId: id,
        otherProfile: profilesMap.get(id) ?? null,
        last,
        unread: last.recipient_id === user!.id && !last.read_at,
      };
    });
    setConvs(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const visible = convs.filter((c) => !blockedIds.has(c.otherId));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Messages</h1>

      {loading ? (
        <ListSkeleton />
      ) : visible.length === 0 ? (
        <EmptyState
          emoji="💬"
          title="No conversations yet"
          hint={
            <>
              Find students in{" "}
              <Link to="/explore" className="text-primary hover:underline">
                Explore
              </Link>{" "}
              to start chatting.
            </>
          }
        />
      ) : (
        <div className="space-y-2">
          {visible.map((c) => (
            <Link
              key={c.otherId}
              to="/messages/$userId"
              params={{ userId: c.otherId }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:shadow-glow"
            >
              <Avatar
                name={c.otherProfile?.display_name ?? "?"}
                url={c.otherProfile?.avatar_url}
                size={48}
                userId={c.otherId}
                showPresence
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">
                    {c.otherProfile?.display_name ?? "Unknown"}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {timeAgo(c.last.created_at)}
                  </span>
                </div>
                <p
                  className={`truncate text-sm ${
                    c.unread ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {c.last.sender_id === user!.id ? "You: " : ""}
                  {c.last.content || (c.last.audio_url ? "🎤 Voice note" : c.last.image_url ? "📷 Photo" : "")}
                </p>
              </div>
              {c.unread && <span className="h-2.5 w-2.5 rounded-full bg-gradient-brand" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
