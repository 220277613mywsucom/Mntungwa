import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/upload";
import { Avatar } from "./AppShell";
import { EmojiPicker } from "./EmojiPicker";
import { Send, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";

export function Composer({
  groupId,
  onPosted,
}: {
  groupId?: string;
  onPosted: () => void;
}) {
  const { user, profile } = useAuth();
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const url = await uploadImage("post-images", user.id, file);
      setImageUrl(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      group_id: groupId ?? null,
      content: text.trim(),
      image_url: imageUrl,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setText("");
    setImageUrl(null);
    onPosted();
  };

  if (!profile) return null;

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-border bg-card p-4 shadow-soft"
    >
      <div className="flex gap-3">
        <Avatar name={profile.display_name} url={profile.avatar_url} size={44} />
        <div className="flex-1 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={groupId ? "Share with this group..." : "What's happening on campus? 🎓"}
            maxLength={2000}
            rows={3}
            className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-[15px] outline-none focus:border-primary"
          />
          {imageUrl && (
            <div className="relative">
              <img
                src={imageUrl}
                alt=""
                className="max-h-64 w-full rounded-2xl border border-border object-cover"
              />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary disabled:opacity-60"
              >
                <ImageIcon className="h-4 w-4" />
                {uploading ? "Uploading..." : "Photo"}
              </button>
              <EmojiPicker onPick={(e) => setText((t) => t + e)} />
            </div>
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Post
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
