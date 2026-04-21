import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { usePresence } from "@/lib/presence";
import { initials } from "@/lib/helpers";
import { supabase } from "@/integrations/supabase/client";
import {
  Home,
  Users,
  MessageCircle,
  User as UserIcon,
  Compass,
  LogOut,
  Sparkles,
  Bell,
  Bookmark,
  Calendar,
  Search,
} from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Feed", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/events", label: "Events", icon: Calendar },
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/notifications", label: "Activity", icon: Bell },
  { to: "/saved", label: "Saved", icon: Bookmark },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [unreadDms, setUnreadDms] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ count: notifCount }, { count: dmCount }] = await Promise.all([
        supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("read_at", null)
          .neq("type", "message"),
        supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("recipient_id", user.id)
          .is("read_at", null),
      ]);
      setUnread(notifCount ?? 0);
      setUnreadDms(dmCount ?? 0);
    };
    load();
    const channel = supabase
      .channel("nav-badges")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        load
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        load
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `sender_id=eq.${user.id}` },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const badgeFor = (to: string) => {
    if (to === "/notifications") return unread;
    if (to === "/messages") return unreadDms;
    return 0;
  };

  return (
    <div className="min-h-screen bg-background bg-mesh">
      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-brand shadow-glow">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold text-gradient-brand">Nexus</span>
        </Link>
        {profile && (
          <Link to="/u/$username" params={{ username: profile.username }}>
            <Avatar name={profile.display_name} url={profile.avatar_url} size={36} />
          </Link>
        )}
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-60 shrink-0 flex-col md:flex">
          <Link to="/" className="mb-8 flex items-center gap-2 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-brand shadow-glow">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-gradient-brand">Nexus</span>
          </Link>
          <nav className="flex flex-col gap-1">
            {nav.map((n) => {
              const Icon = n.icon;
              const active = isActive(n.to);
              const badge = badgeFor(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? "bg-gradient-brand text-white shadow-glow"
                      : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="flex-1">{n.label}</span>
                  {badge > 0 && (
                    <span
                      className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                        active ? "bg-white text-primary" : "bg-gradient-brand text-white"
                      }`}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </Link>
              );
            })}
            {profile && (
              <Link
                to="/u/$username"
                params={{ username: profile.username }}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  location.pathname.startsWith("/u/")
                    ? "bg-gradient-brand text-white shadow-glow"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                <UserIcon className="h-5 w-5" />
                Profile
              </Link>
            )}
          </nav>
          {profile && (
            <div className="mt-auto rounded-2xl border border-border bg-card p-3 shadow-soft">
              <div className="flex items-center gap-3">
                <Avatar name={profile.display_name} url={profile.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{profile.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="rounded-xl p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 pb-24 md:pb-6">{children}</main>
      </div>

      {/* Bottom nav (mobile) — 5 most-used */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-background/95 px-2 py-2 backdrop-blur md:hidden">
        {nav
          .filter((n) => ["/", "/search", "/events", "/messages", "/notifications"].includes(n.to))
          .map((n) => {
            const Icon = n.icon;
            const active = isActive(n.to);
            const badge = badgeFor(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {n.label}
                {badge > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-brand px-1 text-[10px] font-bold text-white">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
      </nav>
    </div>
  );
}

export function Avatar({
  name,
  url,
  size = 40,
  userId,
  showPresence = false,
}: {
  name: string;
  url?: string | null;
  size?: number;
  userId?: string | null;
  showPresence?: boolean;
}) {
  const { isOnline } = usePresence();
  const online = showPresence && isOnline(userId);
  const dot = Math.max(10, Math.round(size * 0.28));

  const inner = url ? (
    <img
      src={url}
      alt={name}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-brand font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </div>
  );

  if (!showPresence) return inner;

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {inner}
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-card bg-emerald-500"
          style={{ width: dot, height: dot }}
          title="Online"
          aria-label="Online"
        />
      )}
    </div>
  );
}
