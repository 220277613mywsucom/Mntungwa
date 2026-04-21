import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { ListSkeleton, EmptyState } from "@/components/Skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Calendar, MapPin, Plus, Users } from "lucide-react";

export const Route = createFileRoute("/events/")({
  head: () => ({
    meta: [
      { title: "Events — Nexus" },
      { name: "description", content: "Upcoming UWC campus events. RSVP and never miss out." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Events />
    </RequireAuth>
  ),
});

interface EventRow {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  cover_url: string | null;
}

interface RsvpRow {
  event_id: string;
  user_id: string;
  status: "going" | "maybe" | "not_going";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [rsvps, setRsvps] = useState<RsvpRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const nowIso = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(); // include events that started in last 6h
    const { data: ev } = await supabase
      .from("events")
      .select("*")
      .gte("start_at", nowIso)
      .order("start_at", { ascending: true })
      .limit(100);
    setEvents((ev ?? []) as EventRow[]);
    const ids = (ev ?? []).map((e) => e.id);
    if (ids.length) {
      const { data: rs } = await supabase
        .from("event_rsvps")
        .select("event_id, user_id, status")
        .in("event_id", ids);
      setRsvps((rs ?? []) as RsvpRow[]);
    } else {
      setRsvps([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("events-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_rsvps" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const setRsvp = async (eventId: string, status: RsvpRow["status"]) => {
    if (!user) return;
    const existing = rsvps.find((r) => r.event_id === eventId && r.user_id === user.id);
    if (existing && existing.status === status) {
      await supabase
        .from("event_rsvps")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("event_rsvps")
        .upsert({ event_id: eventId, user_id: user.id, status });
    }
    load();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campus events</h1>
        <Link
          to="/events/new"
          className="flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-glow"
        >
          <Plus className="h-4 w-4" /> Create
        </Link>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : events.length === 0 ? (
        <EmptyState
          emoji="📅"
          title="No upcoming events"
          hint="Be the first to host one!"
          action={
            <Link
              to="/events/new"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white shadow-glow"
            >
              <Plus className="h-4 w-4" /> Create event
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const my = rsvps.find((r) => r.event_id === e.id && r.user_id === user!.id);
            const going = rsvps.filter((r) => r.event_id === e.id && r.status === "going").length;
            return (
              <article
                key={e.id}
                className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition hover:shadow-glow"
              >
                {e.cover_url ? (
                  <img src={e.cover_url} alt="" className="h-40 w-full object-cover" />
                ) : (
                  <div className="h-24 bg-gradient-brand" />
                )}
                <div className="p-5">
                  <h2 className="text-lg font-bold">{e.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" /> {formatDate(e.start_at)}
                    </span>
                    {e.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" /> {e.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" /> {going} going
                    </span>
                  </div>
                  {e.description && (
                    <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm">{e.description}</p>
                  )}
                  <div className="mt-4 flex gap-2">
                    {(["going", "maybe", "not_going"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setRsvp(e.id, s)}
                        className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition active:scale-95 ${
                          my?.status === s
                            ? "bg-gradient-brand text-white shadow-glow"
                            : "border border-border bg-secondary text-foreground hover:bg-accent"
                        }`}
                      >
                        {s === "going" ? "✅ Going" : s === "maybe" ? "🤔 Maybe" : "❌ Can't go"}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
