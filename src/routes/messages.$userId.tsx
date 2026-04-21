import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/AppShell";
import { EmojiPicker } from "@/components/EmojiPicker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePresence } from "@/lib/presence";
import { uploadImage, uploadVoiceNote, signVoiceNote } from "@/lib/upload";
import {
  ArrowLeft,
  Send,
  Image as ImageIcon,
  X,
  SmilePlus,
  Mic,
  Square,
  Reply,
  Check,
  CheckCheck,
  Play,
  Pause,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/messages/$userId")({
  head: () => ({ meta: [{ title: "Chat — Nexus" }] }),
  component: () => (
    <RequireAuth>
      <Chat />
    </RequireAuth>
  ),
});

interface Msg {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  image_url: string | null;
  audio_url: string | null;
  audio_duration_ms: number | null;
  reply_to_id: string | null;
  read_at: string | null;
  created_at: string;
}

interface Reaction {
  message_id: string;
  user_id: string;
  emoji: string;
}

interface OtherProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms: number | null) {
  if (!ms) return "0:00";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function Chat() {
  const { userId } = Route.useParams();
  const { user, profile } = useAuth();
  const { isOnline } = usePresence();
  const navigate = useNavigate();
  const [other, setOther] = useState<OtherProfile | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [theyTyping, setTheyTyping] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunks = useRef<Blob[]>([]);
  const recordStart = useRef<number>(0);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingSentAt = useRef(0);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const online = isOnline(userId);

  const load = async () => {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    setOther(p as OtherProfile | null);

    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user!.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user!.id})`
      )
      .order("created_at", { ascending: true })
      .limit(200);
    const messages = (data ?? []) as Msg[];
    setMsgs(messages);

    if (messages.length) {
      const ids = messages.map((m) => m.id);
      const { data: rx } = await supabase
        .from("message_reactions")
        .select("message_id, user_id, emoji")
        .in("message_id", ids);
      setReactions((rx ?? []) as Reaction[]);
    } else {
      setReactions([]);
    }

    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", userId)
      .eq("recipient_id", user!.id)
      .is("read_at", null);
  };

  useEffect(() => {
    if (!user || !profile) return;
    load();

    const pair = [user.id, userId].sort().join("__");
    const channel = supabase.channel(`dm:${pair}`);
    channelRef.current = channel;

    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Msg;
        if (
          (m.sender_id === user.id && m.recipient_id === userId) ||
          (m.sender_id === userId && m.recipient_id === user.id)
        ) {
          setMsgs((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id === userId) {
            setTheyTyping(false);
            supabase
              .from("messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", m.id);
          }
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Msg;
        setMsgs((prev) => prev.map((p) => (p.id === m.id ? { ...p, ...m } : p)));
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reactions" },
        (payload) => {
          const r = payload.new as Reaction;
          setReactions((prev) =>
            prev.some(
              (x) => x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji
            )
              ? prev
              : [...prev, r]
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_reactions" },
        (payload) => {
          const r = payload.old as Reaction;
          setReactions((prev) =>
            prev.filter(
              (x) =>
                !(x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji)
            )
          );
        }
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.userId === userId) {
          setTheyTyping(true);
          if (typingTimeout.current) clearTimeout(typingTimeout.current);
          typingTimeout.current = setTimeout(() => setTheyTyping(false), 2500);
        }
      })
      .subscribe();

    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, user?.id, profile?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, theyTyping, reactions.length]);

  const reactionsByMsg = useMemo(() => {
    const map = new Map<string, Map<string, Set<string>>>();
    for (const r of reactions) {
      if (!map.has(r.message_id)) map.set(r.message_id, new Map());
      const inner = map.get(r.message_id)!;
      if (!inner.has(r.emoji)) inner.set(r.emoji, new Set());
      inner.get(r.emoji)!.add(r.user_id);
    }
    return map;
  }, [reactions]);

  const msgById = useMemo(() => new Map(msgs.map((m) => [m.id, m])), [msgs]);

  const handleType = (v: string) => {
    setText(v);
    const now = Date.now();
    if (channelRef.current && now - typingSentAt.current > 1500) {
      typingSentAt.current = now;
      channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: user!.id },
      });
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const url = await uploadImage("post-images", user.id, file);
      setPendingImage(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content && !pendingImage) return;
    const imgToSend = pendingImage;
    const replyId = replyTo?.id ?? null;
    setText("");
    setPendingImage(null);
    setReplyTo(null);
    const { error } = await supabase.from("messages").insert({
      sender_id: user!.id,
      recipient_id: userId,
      content,
      image_url: imgToSend,
      reply_to_id: replyId,
    });
    if (error) {
      toast.error(error.message);
      setText(content);
      setPendingImage(imgToSend);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recordChunks.current = [];
      recordStart.current = Date.now();
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunks.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const duration = Date.now() - recordStart.current;
        const blob = new Blob(recordChunks.current, { type: "audio/webm" });
        if (blob.size === 0) return;
        try {
          const path = await uploadVoiceNote(user!.id, blob);
          const { error } = await supabase.from("messages").insert({
            sender_id: user!.id,
            recipient_id: userId,
            content: "",
            audio_url: path,
            audio_duration_ms: duration,
            reply_to_id: replyTo?.id ?? null,
          });
          if (error) throw error;
          setReplyTo(null);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to send voice note");
        }
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
      setRecordSecs(0);
      recordTimer.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone access denied 🎤");
    }
  };

  const stopRecording = (cancel = false) => {
    if (recordTimer.current) clearInterval(recordTimer.current);
    setRecording(false);
    setRecordSecs(0);
    const mr = recorderRef.current;
    if (!mr) return;
    if (cancel) {
      mr.ondataavailable = null;
      mr.onstop = () => mr.stream.getTracks().forEach((t) => t.stop());
    }
    if (mr.state !== "inactive") mr.stop();
    recorderRef.current = null;
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const mine = reactionsByMsg.get(messageId)?.get(emoji)?.has(user.id);
    setReactionPickerFor(null);
    if (mine) {
      setReactions((prev) =>
        prev.filter(
          (x) => !(x.message_id === messageId && x.user_id === user.id && x.emoji === emoji)
        )
      );
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", user.id)
        .eq("emoji", emoji);
    } else {
      setReactions((prev) => [...prev, { message_id: messageId, user_id: user.id, emoji }]);
      const { error } = await supabase
        .from("message_reactions")
        .insert({ message_id: messageId, user_id: user.id, emoji });
      if (error && !error.message.includes("duplicate")) toast.error(error.message);
    }
  };

  if (!other) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <p className="font-semibold">User not found</p>
      </div>
    );
  }

  // Build groups of consecutive messages by sender
  const groups: Msg[][] = [];
  for (const m of msgs) {
    const last = groups[groups.length - 1];
    if (last && last[0].sender_id === m.sender_id) {
      const lastTime = new Date(last[last.length - 1].created_at).getTime();
      const cur = new Date(m.created_at).getTime();
      if (cur - lastTime < 5 * 60 * 1000) {
        last.push(m);
        continue;
      }
    }
    groups.push([m]);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-2xl flex-col rounded-3xl border border-border bg-card shadow-soft md:h-[calc(100vh-3rem)]">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          onClick={() => navigate({ to: "/messages" })}
          className="rounded-xl p-1.5 hover:bg-secondary"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Link
          to="/u/$username"
          params={{ username: other.username }}
          className="flex items-center gap-3"
        >
          <Avatar
            name={other.display_name}
            url={other.avatar_url}
            size={40}
            userId={other.id}
            showPresence
          />
          <div>
            <p className="font-semibold leading-tight">{other.display_name}</p>
            <p className="text-xs text-muted-foreground">
              {theyTyping ? "typing…" : online ? "🟢 Online" : `@${other.username}`}
            </p>
          </div>
        </Link>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-mesh px-3 py-4">
        {msgs.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Say hi 👋</p>
        )}

        {groups.map((group, gi) => {
          const mine = group[0].sender_id === user!.id;
          return (
            <div
              key={gi}
              className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}
            >
              {group.map((m, idx) => {
                const isLast = idx === group.length - 1;
                const rx = reactionsByMsg.get(m.id);
                const replied = m.reply_to_id ? msgById.get(m.reply_to_id) : null;
                const tail =
                  isLast &&
                  (mine
                    ? "rounded-br-md"
                    : "rounded-bl-md");
                return (
                  <div
                    key={m.id}
                    className={`group relative flex max-w-[80%] items-end gap-1 ${
                      mine ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                      style={{ maxWidth: "100%" }}
                    >
                      <div
                        className={`overflow-hidden rounded-2xl text-sm ${tail} ${
                          mine
                            ? "bg-gradient-brand text-white shadow-glow"
                            : "bg-secondary text-foreground"
                        }`}
                      >
                        {replied && (
                          <div
                            className={`mx-1.5 mt-1.5 rounded-xl border-l-4 px-2 py-1 text-xs ${
                              mine
                                ? "border-white/70 bg-white/15"
                                : "border-primary bg-background/60"
                            }`}
                          >
                            <p className="font-semibold opacity-90">
                              {replied.sender_id === user!.id ? "You" : other.display_name}
                            </p>
                            <p className="line-clamp-2 opacity-80">
                              {replied.audio_url
                                ? "🎤 Voice note"
                                : replied.image_url && !replied.content
                                  ? "📷 Photo"
                                  : replied.content}
                            </p>
                          </div>
                        )}
                        {m.image_url && (
                          <img
                            src={m.image_url}
                            alt=""
                            className="max-h-72 w-full object-cover"
                          />
                        )}
                        {m.audio_url && (
                          <VoiceBubble path={m.audio_url} duration={m.audio_duration_ms} mine={mine} />
                        )}
                        {m.content && (
                          <p className="whitespace-pre-wrap break-words px-3 py-1.5">{m.content}</p>
                        )}
                        <div
                          className={`flex items-center justify-end gap-1 px-2 pb-1 text-[10px] ${
                            mine ? "text-white/80" : "text-muted-foreground"
                          }`}
                        >
                          <span>{formatTime(m.created_at)}</span>
                          {mine && (
                            m.read_at ? (
                              <CheckCheck className="h-3 w-3" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )
                          )}
                        </div>
                      </div>
                      {rx && rx.size > 0 && (
                        <div
                          className={`-mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : "justify-start"}`}
                        >
                          {Array.from(rx.entries()).map(([emoji, users]) => {
                            const mineReaction = users.has(user!.id);
                            return (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(m.id, emoji)}
                                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                                  mineReaction
                                    ? "border-primary bg-primary/10"
                                    : "border-border bg-card hover:bg-secondary"
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="font-semibold">{users.size}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div
                      className={`flex flex-col gap-1 self-center opacity-0 transition group-hover:opacity-100 ${
                        reactionPickerFor === m.id ? "opacity-100" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setReplyTo(m)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                        aria-label="Reply"
                      >
                        <Reply className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setReactionPickerFor((cur) => (cur === m.id ? null : m.id))
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                        aria-label="React"
                      >
                        <SmilePlus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {reactionPickerFor === m.id && (
                      <div
                        className={`absolute -top-10 z-20 flex gap-1 rounded-full border border-border bg-card px-2 py-1 shadow-glow ${
                          mine ? "right-10" : "left-10"
                        }`}
                      >
                        {QUICK_REACTIONS.map((e) => {
                          const mineReaction = rx?.get(e)?.has(user!.id);
                          return (
                            <button
                              key={e}
                              onClick={() => toggleReaction(m.id, e)}
                              className={`rounded-full p-1 text-lg transition hover:scale-125 ${
                                mineReaction ? "bg-primary/15" : ""
                              }`}
                            >
                              {e}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {theyTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-secondary px-4 py-2.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {replyTo && (
        <div className="flex items-center gap-2 border-t border-border bg-secondary/40 px-3 py-2">
          <div className="flex-1 border-l-4 border-primary pl-2 text-xs">
            <p className="font-semibold">
              Replying to {replyTo.sender_id === user!.id ? "yourself" : other.display_name}
            </p>
            <p className="line-clamp-1 text-muted-foreground">
              {replyTo.audio_url
                ? "🎤 Voice note"
                : replyTo.image_url && !replyTo.content
                  ? "📷 Photo"
                  : replyTo.content}
            </p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="rounded-full p-1 hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {pendingImage && (
        <div className="relative mx-3 mb-2 inline-block self-start">
          <img
            src={pendingImage}
            alt=""
            className="max-h-32 rounded-xl border border-border object-cover"
          />
          <button
            type="button"
            onClick={() => setPendingImage(null)}
            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {recording ? (
        <div className="flex items-center gap-2 border-t border-border p-3">
          <button
            type="button"
            onClick={() => stopRecording(true)}
            className="rounded-full bg-secondary p-2.5 text-foreground"
            aria-label="Cancel"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center gap-2 rounded-full bg-secondary px-4 py-2.5">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm font-semibold">Recording… {Math.floor(recordSecs / 60)}:{(recordSecs % 60).toString().padStart(2, "0")}</span>
          </div>
          <button
            type="button"
            onClick={() => stopRecording(false)}
            className="rounded-full bg-gradient-brand p-2.5 text-white shadow-glow"
            aria-label="Send"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <form onSubmit={send} className="flex items-center gap-1 border-t border-border p-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center justify-center rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-60"
            aria-label="Attach image"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          <EmojiPicker onPick={(e) => setText((t) => t + e)} />
          <input
            value={text}
            onChange={(e) => handleType(e.target.value)}
            placeholder={uploading ? "Uploading…" : "Message…"}
            maxLength={2000}
            className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
          />
          {text.trim() || pendingImage ? (
            <button
              type="submit"
              disabled={uploading}
              className="rounded-full bg-gradient-brand p-2.5 text-white shadow-glow disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="rounded-full bg-gradient-brand p-2.5 text-white shadow-glow"
              aria-label="Record voice note"
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
        </form>
      )}
    </div>
  );
}

function VoiceBubble({
  path,
  duration,
  mine,
}: {
  path: string;
  duration: number | null;
  mine: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancel = false;
    signVoiceNote(path).then((u) => {
      if (!cancel) setUrl(u);
    });
    return () => {
      cancel = true;
    };
  }, [path]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      a.play().catch(() => {});
    }
  };

  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <button
        type="button"
        onClick={toggle}
        disabled={!url}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          mine ? "bg-white/25 text-white" : "bg-primary text-primary-foreground"
        } disabled:opacity-60`}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex flex-col">
        <div className={`flex items-center gap-0.5 ${mine ? "text-white/90" : "text-foreground"}`}>
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className={`w-0.5 rounded-full ${mine ? "bg-white/80" : "bg-foreground/60"}`}
              style={{ height: `${6 + ((i * 7) % 14)}px` }}
            />
          ))}
        </div>
        <span className={`text-[10px] ${mine ? "text-white/80" : "text-muted-foreground"}`}>
          🎤 {formatDuration(duration)}
        </span>
      </div>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}
    </div>
  );
}
