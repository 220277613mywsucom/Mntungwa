import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { timeAgo } from "@/lib/helpers";
import { Heart, MessageCircle, UserPlus, Bell, Mail } from "lucide-react";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Nexus" }] }),
  component: () => (
    <RequireAuth>
      <Notifications />
    </RequireAuth>
  ),
});

interface Notif {
  id: string;
  type: "like" | "comment" | "follow" | "message";
  post_id: string | null;
  read_at: string | null;
  created_at: string;
  actor_id: string;
  actor: { username: string; display_name: string; avatar_url: string | null } | null;
  post: { content: string } | null;
}

function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("notifications")
      .select(
        `id, type, post_id, read_at, created_at, actor_id,
         actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_url),
         post:posts(content)`
      )
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data ?? []) as unknown as Notif[]);
    setLoading(false);

    // mark all as read
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user!.id)
      .is("read_at", null);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("notif-page")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user!.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const verb = (t: Notif["type"]) =>
    t === "like"
      ? "liked your post ❤️"
      : t === "comment"
        ? "commented on your post 💬"
        : t === "follow"
          ? "started following you ✨"
          : "sent you a message 💌";

  const Icon = ({ t }: { t: Notif["type"] }) =>
    t === "like" ? (
      <Heart className="h-4 w-4 fill-current text-pink-500" />
    ) : t === "comment" ? (
      <MessageCircle className="h-4 w-4 text-violet-500" />
    ) : t === "follow" ? (
      <UserPlus className="h-4 w-4 text-emerald-500" />
    ) : (
      <Mail className="h-4 w-4 text-sky-500" />
    );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Notifications</h1>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">All caught up</p>
          <p className="mt-1 text-sm text-muted-foreground">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const username = n.actor?.username ?? "unknown";
            const target =
              n.type === "follow"
                ? `/u/${username}`
                : n.type === "message"
                  ? `/messages/${n.actor_id}`
                  : "/";
            return (
              <Link
                key={n.id}
                to={target as "/"}
                className={`flex items-center gap-3 rounded-2xl border border-border p-3 shadow-soft transition hover:shadow-glow ${
                  !n.read_at ? "bg-primary/5" : "bg-card"
                }`}
              >
                <div className="relative">
                  <Avatar
                    name={n.actor?.display_name ?? "?"}
                    url={n.actor?.avatar_url}
                    size={44}
                  />
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-card">
                    <Icon t={n.type} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{n.actor?.display_name ?? "Someone"}</span>{" "}
                    <span className="text-muted-foreground">{verb(n.type)}</span>
                  </p>
                  {n.post?.content && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      "{n.post.content}"
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
