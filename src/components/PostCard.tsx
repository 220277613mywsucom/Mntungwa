import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useBlocks } from "@/lib/blocks";
import { Avatar } from "./AppShell";
import { renderWithTags } from "@/lib/hashtags";
import { timeAgo } from "@/lib/helpers";
import {
  Heart,
  MessageCircle,
  Trash2,
  Send,
  Bookmark,
  MoreHorizontal,
  Flag,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { ReportDialog } from "./ReportDialog";

export interface PostRow {
  id: string;
  user_id: string;
  group_id: string | null;
  content: string;
  image_url: string | null;
  created_at: string;
  profiles: { username: string; display_name: string; avatar_url: string | null } | null;
  groups: { slug: string; name: string } | null;
  likes: { user_id: string }[];
  comments: { count: number }[];
  bookmarks?: { user_id: string }[];
}

export function PostCard({ post, onChange }: { post: PostRow; onChange: () => void }) {
  const { user } = useAuth();
  const { isBlocked, block } = useBlocks();
  const liked = post.likes.some((l) => l.user_id === user?.id);
  const likeCount = post.likes.length;
  const commentCount = post.comments[0]?.count ?? 0;
  const saved = post.bookmarks?.some((b) => b.user_id === user?.id) ?? false;
  const [showComments, setShowComments] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
    }
    onChange();
  };

  const toggleSave = async () => {
    if (!user) return;
    if (saved) {
      await supabase.from("bookmarks").delete().eq("post_id", post.id).eq("user_id", user.id);
      toast.success("Removed from saved");
    } else {
      await supabase.from("bookmarks").insert({ post_id: post.id, user_id: user.id });
      toast.success("Saved 🔖");
    }
    onChange();
  };

  const remove = async () => {
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    onChange();
  };

  const handleBlock = async () => {
    if (!confirm(`Block @${post.profiles?.username}? You won't see their posts or DMs.`)) return;
    await block(post.user_id);
    onChange();
  };

  if (isBlocked(post.user_id)) return null;

  const author = post.profiles;
  const authorName = author?.display_name ?? "Unknown";
  const username = author?.username ?? "unknown";
  const isOwn = user?.id === post.user_id;

  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-soft transition hover:shadow-glow">
      <header className="flex items-start gap-3">
        <Link to="/u/$username" params={{ username }}>
          <Avatar
            name={authorName}
            url={author?.avatar_url}
            size={44}
            userId={post.user_id}
            showPresence
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <Link
              to="/u/$username"
              params={{ username }}
              className="font-semibold hover:underline"
            >
              {authorName}
            </Link>
            <span className="text-xs text-muted-foreground">@{username}</span>
            <span className="text-xs text-muted-foreground">· {timeAgo(post.created_at)}</span>
          </div>
          {post.groups && (
            <Link
              to="/groups/$slug"
              params={{ slug: post.groups.slug }}
              className="mt-0.5 inline-block text-xs font-semibold text-primary hover:underline"
            >
              in {post.groups.name}
            </Link>
          )}
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((s) => !s)}
            className="rounded-xl p-2 text-muted-foreground hover:bg-secondary"
            aria-label="More"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-2xl border border-border bg-popover shadow-glow">
              {isOwn ? (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    remove();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-destructive hover:bg-secondary"
                >
                  <Trash2 className="h-4 w-4" /> Delete post
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setReporting(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-secondary"
                  >
                    <Flag className="h-4 w-4" /> Report
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleBlock();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-destructive hover:bg-secondary"
                  >
                    <Ban className="h-4 w-4" /> Block @{username}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">
        {renderWithTags(post.content)}
      </p>
      {post.image_url && (
        <img
          src={post.image_url}
          alt=""
          className="mt-3 max-h-96 w-full rounded-2xl border border-border object-cover"
        />
      )}

      <div className="mt-4 flex items-center gap-1">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition active:scale-95 ${
            liked
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          {likeCount}
        </button>
        <button
          onClick={() => setShowComments((s) => !s)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground active:scale-95"
        >
          <MessageCircle className="h-4 w-4" />
          {commentCount}
        </button>
        <button
          onClick={toggleSave}
          className={`ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition active:scale-95 ${
            saved
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
          aria-label={saved ? "Unsave" : "Save"}
        >
          <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
        </button>
      </div>

      {showComments && <Comments postId={post.id} onChange={onChange} />}

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        targetType="post"
        targetId={post.id}
      />
    </article>
  );
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { username: string; display_name: string; avatar_url: string | null } | null;
}

function Comments({ postId, onChange }: { postId: string; onChange: () => void }) {
  const { user } = useAuth();
  const { isBlocked } = useBlocks();
  const [items, setItems] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("comments")
      .select("id, content, created_at, user_id, profiles!comments_author_profile_fkey(username, display_name, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setItems((data ?? []) as unknown as Comment[]);
  };

  useEffect(() => {
    load();
  }, [postId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("comments")
      .insert({ post_id: postId, user_id: user.id, content: text.trim() });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    load();
    onChange();
  };

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      {items
        .filter((c) => !isBlocked(c.user_id))
        .map((c) => (
          <div key={c.id} className="flex items-start gap-2.5">
            <Avatar name={c.profiles?.display_name ?? "?"} url={c.profiles?.avatar_url} size={32} />
            <div className="flex-1 rounded-2xl bg-secondary px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold">
                  {c.profiles?.display_name ?? "Unknown"}
                </span>
                <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
              </div>
              <p className="text-sm">{renderWithTags(c.content)}</p>
            </div>
          </div>
        ))}
      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment..."
          maxLength={500}
          className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-full bg-gradient-brand p-2 text-white shadow-glow disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
