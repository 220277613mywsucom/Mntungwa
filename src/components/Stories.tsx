import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadImage } from "@/lib/upload";
import { Avatar } from "./AppShell";
import { Plus, X, ChevronLeft, ChevronRight, Eye, Trash2, Send, Music, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { timeAgo } from "@/lib/helpers";
import { EmojiPicker } from "./EmojiPicker";

interface StoryRow {
  id: string;
  user_id: string;
  image_url: string;
  audio_url: string | null;
  caption: string | null;
  created_at: string;
  expires_at: string;
}

interface UserStories {
  user: { id: string; username: string; display_name: string; avatar_url: string | null };
  stories: StoryRow[];
  hasUnseen: boolean;
}

export function StoriesTray() {
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState<UserStories[]>([]);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const [composer, setComposer] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    const { data: stories } = await supabase
      .from("stories")
      .select("id, user_id, image_url, audio_url, caption, created_at, expires_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    const list = (stories ?? []) as StoryRow[];
    if (list.length === 0) {
      setGroups([]);
      return;
    }
    const userIds = Array.from(new Set(list.map((s) => s.user_id)));
    const [{ data: profs }, { data: views }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds),
      supabase
        .from("story_views")
        .select("story_id")
        .eq("viewer_id", user.id)
        .in(
          "story_id",
          list.map((s) => s.id)
        ),
    ]);
    const seen = new Set((views ?? []).map((v) => v.story_id));
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    const byUser = new Map<string, UserStories>();
    for (const s of list) {
      const p = profMap.get(s.user_id);
      if (!p) continue;
      if (!byUser.has(s.user_id)) {
        byUser.set(s.user_id, { user: p, stories: [], hasUnseen: false });
      }
      const g = byUser.get(s.user_id)!;
      g.stories.push(s);
      if (!seen.has(s.id) && s.user_id !== user.id) g.hasUnseen = true;
    }
    const sorted = Array.from(byUser.values()).sort((a, b) => {
      if (a.user.id === user.id) return -1;
      if (b.user.id === user.id) return 1;
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      return b.stories[b.stories.length - 1].created_at.localeCompare(
        a.stories[a.stories.length - 1].created_at
      );
    });
    setGroups(sorted);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("stories-tray")
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setComposer(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (!profile) return null;

  const myGroup = groups.find((g) => g.user.id === user?.id);

  return (
    <>
      <div className="rounded-3xl border border-border bg-card p-3 shadow-soft">
        <div className="flex gap-3 overflow-x-auto pb-1">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-16 shrink-0 flex-col items-center gap-1"
          >
            <div className="relative">
              <Avatar
                name={profile.display_name}
                url={profile.avatar_url}
                size={60}
              />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-gradient-brand text-white">
                <Plus className="h-3 w-3" />
              </span>
            </div>
            <span className="truncate text-[11px] font-medium">Your story</span>
          </button>

          {myGroup && (
            <button
              onClick={() => setViewerIdx(groups.indexOf(myGroup))}
              className="flex w-16 shrink-0 flex-col items-center gap-1"
            >
              <div className="rounded-full bg-gradient-brand p-[2px]">
                <div className="rounded-full border-2 border-card">
                  <Avatar
                    name={profile.display_name}
                    url={profile.avatar_url}
                    size={56}
                  />
                </div>
              </div>
              <span className="truncate text-[11px] font-medium">You</span>
            </button>
          )}

          {groups
            .filter((g) => g.user.id !== user?.id)
            .map((g) => (
              <button
                key={g.user.id}
                onClick={() => setViewerIdx(groups.indexOf(g))}
                className="flex w-16 shrink-0 flex-col items-center gap-1"
              >
                <div
                  className={`rounded-full p-[2px] ${
                    g.hasUnseen ? "bg-gradient-brand" : "bg-muted"
                  }`}
                >
                  <div className="rounded-full border-2 border-card">
                    <Avatar
                      name={g.user.display_name}
                      url={g.user.avatar_url}
                      size={56}
                    />
                  </div>
                </div>
                <span className="truncate text-[11px] font-medium">
                  {g.user.display_name.split(" ")[0]}
                </span>
              </button>
            ))}

          {groups.length === 0 && !myGroup && (
            <p className="flex items-center px-2 text-xs text-muted-foreground">
              No stories yet — be the first! 🎉
            </p>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {composer && user && (
        <StoryComposer
          file={composer}
          userId={user.id}
          onClose={() => setComposer(null)}
          onPosted={() => {
            setComposer(null);
            load();
          }}
        />
      )}

      {viewerIdx !== null && (
        <StoryViewer
          groups={groups}
          startIdx={viewerIdx}
          onClose={() => {
            setViewerIdx(null);
            load();
          }}
        />
      )}
    </>
  );
}

function StoryViewer({
  groups,
  startIdx,
  onClose,
}: {
  groups: UserStories[];
  startIdx: number;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [groupIdx, setGroupIdx] = useState(startIdx);
  const [storyIdx, setStoryIdx] = useState(0);
  const [viewers, setViewers] = useState<
    { id: string; display_name: string; avatar_url: string | null }[] | null
  >(null);
  const [showViewers, setShowViewers] = useState(false);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const startedAt = useRef<number>(Date.now());
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];
  const isMine = group?.user.id === user?.id;

  useEffect(() => {
    if (!story || !user || isMine) return;
    supabase
      .from("story_views")
      .insert({ story_id: story.id, viewer_id: user.id })
      .then(() => {});
  }, [story?.id, user, isMine]);

  useEffect(() => {
    if (!story || !isMine) {
      setViewers(null);
      return;
    }
    setViewers(null);
    supabase
      .from("story_views")
      .select("viewer_id, profiles!story_views_viewer_id_fkey(id, display_name, avatar_url)")
      .eq("story_id", story.id)
      .then(({ data }) => {
        const list = ((data ?? []) as unknown as Array<{
          profiles: { id: string; display_name: string; avatar_url: string | null };
        }>).map((r) => r.profiles);
        setViewers(list);
      });
  }, [story?.id, isMine]);

  const next = () => {
    if (!group) return;
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx((i) => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((i) => i + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  };

  const prev = () => {
    if (storyIdx > 0) setStoryIdx((i) => i - 1);
    else if (groupIdx > 0) {
      setGroupIdx((i) => i - 1);
      setStoryIdx(0);
    }
  };

  useEffect(() => {
    setProgress(0);
    setShowViewers(false);
    setReplyText("");
    startedAt.current = Date.now();
    const DURATION = 5000;
    const tick = () => {
      if (!pausedRef.current) {
        const p = Math.min(1, (Date.now() - startedAt.current) / DURATION);
        setProgress(p);
        if (p >= 1) {
          next();
          return;
        }
      } else {
        startedAt.current = Date.now() - progress * DURATION;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [groupIdx, storyIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groupIdx, storyIdx]);

  const deleteStory = async () => {
    if (!story) return;
    if (!confirm("Delete this story?")) return;
    await supabase.from("stories").delete().eq("id", story.id);
    onClose();
  };

  const sendReply = async (textOverride?: string) => {
    const text = (textOverride ?? replyText).trim();
    if (!text || !user || !story || isMine || sendingReply) return;
    setSendingReply(true);
    pausedRef.current = true;
    try {
      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        recipient_id: group.user.id,
        content: `↩️ Replied to your story\n${text}`,
        image_url: story.image_url,
      });
      if (error) throw error;
      setReplyText("");
      toast.success("Reply sent 💬");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSendingReply(false);
      pausedRef.current = false;
      startedAt.current = Date.now() - progress * 5000;
    }
  };

  if (!group || !story) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur"
      onMouseDown={() => (pausedRef.current = true)}
      onMouseUp={() => (pausedRef.current = false)}
      onTouchStart={() => (pausedRef.current = true)}
      onTouchEnd={() => (pausedRef.current = false)}
    >
      <div className="relative flex h-full max-h-[100dvh] w-full max-w-md flex-col">
        <div className="flex gap-1 px-3 pt-3">
          {group.stories.map((_, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white"
                style={{
                  width: `${i < storyIdx ? 100 : i === storyIdx ? progress * 100 : 0}%`,
                }}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-3 py-2 text-white">
          <div className="flex items-center gap-2">
            <Avatar
              name={group.user.display_name}
              url={group.user.avatar_url}
              size={36}
            />
            <div>
              <p className="text-sm font-semibold">{group.user.display_name}</p>
              <p className="text-[11px] opacity-80">{timeAgo(story.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isMine && (
              <button
                onClick={deleteStory}
                className="rounded-full p-2 hover:bg-white/10"
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          <img
            src={story.image_url}
            alt=""
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
          {story.audio_url && (
            <audio src={story.audio_url} autoPlay loop className="hidden" />
          )}
          {story.caption && (
            <div className="pointer-events-none absolute bottom-4 left-4 right-4 rounded-2xl bg-black/50 px-3 py-2 text-center text-sm font-semibold text-white backdrop-blur">
              {story.caption}
            </div>
          )}
          <button
            onClick={prev}
            className="absolute inset-y-0 left-0 w-1/3"
            aria-label="Previous"
          >
            <ChevronLeft className="absolute left-2 top-1/2 h-6 w-6 -translate-y-1/2 text-white/70" />
          </button>
          <button
            onClick={next}
            className="absolute inset-y-0 right-0 w-1/3"
            aria-label="Next"
          >
            <ChevronRight className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 text-white/70" />
          </button>
        </div>

        {isMine && (
          <div className="border-t border-white/10 bg-black/60 p-3 text-white">
            <button
              onClick={() => setShowViewers((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <Eye className="h-4 w-4" />
              {viewers?.length ?? 0} {viewers?.length === 1 ? "view" : "views"}
            </button>
            {showViewers && viewers && (
              <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                {viewers.length === 0 ? (
                  <p className="text-xs opacity-70">No views yet.</p>
                ) : (
                  viewers.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 text-xs">
                      <Avatar name={v.display_name} url={v.avatar_url} size={24} />
                      <span>{v.display_name}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {!isMine && (
          <div
            className="flex items-center gap-2 border-t border-white/10 bg-black/70 p-3"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="flex flex-1 items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white">
              <input
                ref={replyInputRef}
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => (pausedRef.current = true)}
                onBlur={() => {
                  pausedRef.current = false;
                  startedAt.current = Date.now() - progress * 5000;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder={`Reply to ${group.user.display_name.split(" ")[0]}...`}
                className="flex-1 bg-transparent text-sm placeholder:text-white/60 focus:outline-none"
                disabled={sendingReply}
              />
              <div className="text-white/80">
                <EmojiPicker
                  align="right"
                  onPick={(emoji) => {
                    setReplyText((t) => t + emoji);
                    replyInputRef.current?.focus();
                  }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1">
              {["❤️", "🔥", "😂"].map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => sendReply(e)}
                  disabled={sendingReply}
                  className="rounded-full p-2 text-xl transition hover:bg-white/10 disabled:opacity-50"
                  aria-label={`React with ${e}`}
                >
                  {e}
                </button>
              ))}
              <button
                type="button"
                onClick={() => sendReply()}
                disabled={sendingReply || !replyText.trim()}
                className="rounded-full bg-gradient-brand p-2 text-white shadow-glow transition disabled:opacity-50"
                aria-label="Send reply"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StoryComposer({
  file,
  userId,
  onClose,
  onPosted,
}: {
  file: File;
  userId: string;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [preview, setPreview] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [musicPrompt, setMusicPrompt] = useState("");
  const [musicBlob, setMusicBlob] = useState<Blob | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const generateMusic = async () => {
    const prompt = musicPrompt.trim();
    if (!prompt) {
      toast.error("Describe the vibe first (e.g. 'lofi study beat')");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-story-music", {
        body: { prompt, duration_seconds: 10 },
      });
      if (error) throw error;
      const blob = data instanceof Blob ? data : new Blob([data as ArrayBuffer], { type: "audio/mpeg" });
      if (musicUrl) URL.revokeObjectURL(musicUrl);
      const url = URL.createObjectURL(blob);
      setMusicBlob(blob);
      setMusicUrl(url);
      toast.success("Track ready 🎵");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Music generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const post = async () => {
    setPosting(true);
    try {
      const imageUrl = await uploadImage("stories", userId, file);
      let audioUrl: string | null = null;
      if (musicBlob) {
        const audioFile = new File([musicBlob], `${crypto.randomUUID()}.mp3`, { type: "audio/mpeg" });
        const path = `${userId}/${crypto.randomUUID()}.mp3`;
        const { error: upErr } = await supabase.storage
          .from("story-audio")
          .upload(path, audioFile, { contentType: "audio/mpeg", cacheControl: "3600" });
        if (upErr) throw upErr;
        audioUrl = supabase.storage.from("story-audio").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("stories").insert({
        user_id: userId,
        image_url: imageUrl,
        audio_url: audioUrl,
        caption: caption.trim() || null,
      });
      if (error) throw error;
      toast.success("Story posted ✨");
      onPosted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post story");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur">
      <div className="flex max-h-[95vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/10 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h3 className="font-bold">New story</h3>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-3 overflow-y-auto p-4">
          <div className="relative overflow-hidden rounded-2xl bg-black">
            {preview && <img src={preview} alt="" className="max-h-72 w-full object-contain" />}
            {caption && (
              <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl bg-black/60 px-3 py-1.5 text-center text-sm font-semibold text-white">
                {caption}
              </div>
            )}
          </div>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 80))}
            placeholder="Add a caption..."
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="rounded-2xl border border-border bg-secondary/40 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Music className="h-3.5 w-3.5" /> Add music (optional)
            </div>
            <div className="flex gap-2">
              <input
                value={musicPrompt}
                onChange={(e) => setMusicPrompt(e.target.value)}
                placeholder="e.g. dreamy lofi beat"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={generateMusic}
                disabled={generating}
                className="flex items-center gap-1 rounded-xl bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-white shadow-glow disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {generating ? "..." : "Generate"}
              </button>
            </div>
            {musicUrl && (
              <audio ref={audioRef} src={musicUrl} controls className="mt-2 w-full" />
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-3">
          <button
            onClick={onClose}
            className="rounded-full border border-border bg-secondary px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={post}
            disabled={posting}
            className="rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-50"
          >
            {posting ? "Posting..." : "Share story"}
          </button>
        </div>
      </div>
    </div>
  );
}
