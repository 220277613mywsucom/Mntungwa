import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/AppShell";
import { PostCard, type PostRow } from "@/components/PostCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadImage } from "@/lib/upload";
import { UserPlus, UserCheck, MessageCircle, Pencil, Check, X, Camera, IdCard, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/u/$username")({
  head: () => ({ meta: [{ title: "Profile — Nexus" }] }),
  component: () => (
    <RequireAuth>
      <ProfilePage />
    </RequireAuth>
  ),
});

interface ProfileData {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  faculty: string | null;
  student_number: string | null;
  show_student_number: boolean;
}

function ProfilePage() {
  const { username } = Route.useParams();
  const { user, profile: me, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [faculty, setFaculty] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [usernameField, setUsernameField] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [showStudentNumber, setShowStudentNumber] = useState(false);

  const load = useCallback(async () => {
    const { data: p } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .maybeSingle();
    if (!p) {
      setLoading(false);
      return;
    }
    setProfile(p as ProfileData);
    setBio(p.bio ?? "");
    setFaculty(p.faculty ?? "");
    setDisplayName(p.display_name);
    setUsernameField(p.username);
    setStudentNumber(p.student_number ?? "");
    setShowStudentNumber(!!p.show_student_number);

    const [{ data: ps }, { count: fr }, { count: fg }, { data: rel }] = await Promise.all([
      supabase
        .from("posts")
        .select(
          `id, user_id, group_id, content, image_url, created_at,
           profiles!posts_author_profile_fkey(username, display_name, avatar_url),
           groups(slug, name),
           likes(user_id),
           comments(count)`
        )
        .eq("user_id", p.id)
        .order("created_at", { ascending: false }),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", p.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", p.id),
      supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user!.id)
        .eq("following_id", p.id),
    ]);
    setPosts((ps ?? []) as unknown as PostRow[]);
    setFollowers(fr ?? 0);
    setFollowingCount(fg ?? 0);
    setIsFollowing((rel ?? []).length > 0);
    setLoading(false);
  }, [username, user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFollow = async () => {
    if (!profile) return;
    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user!.id)
        .eq("following_id", profile.id);
    } else {
      await supabase.from("follows").insert({ follower_id: user!.id, following_id: profile.id });
    }
    load();
  };

  const save = async () => {
    if (!profile) return;
    const sn = studentNumber.trim();
    if (sn && !/^\d{6,12}$/.test(sn)) {
      return toast.error("Student number must be 6–12 digits");
    }
    const newUsername = usernameField.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(newUsername)) {
      return toast.error("Username: 3–20 chars, letters/numbers/underscores");
    }
    if (newUsername !== profile.username) {
      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", newUsername)
        .maybeSingle();
      if (taken) return toast.error("Username already taken");
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        username: newUsername,
        display_name: displayName.trim() || profile.display_name,
        bio: bio.trim() || null,
        faculty: faculty.trim() || null,
        student_number: sn || null,
        show_student_number: showStudentNumber,
      })
      .eq("id", profile.id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    setEditing(false);
    refreshProfile();
    if (newUsername !== profile.username) {
      navigate({ to: "/u/$username", params: { username: newUsername } });
    } else {
      load();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <p className="font-semibold">User not found</p>
      </div>
    );
  }

  const isMe = me?.id === profile.id;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        <div
          className="relative h-32 bg-gradient-brand bg-cover bg-center"
          style={profile.cover_url ? { backgroundImage: `url(${profile.cover_url})` } : undefined}
        >
          {isMe && (
            <CoverUploader
              userId={profile.id}
              onDone={() => {
                refreshProfile();
                load();
              }}
            />
          )}
        </div>
        <div className="px-5 pb-5">
          <div className="-mt-10 flex items-end justify-between">
            <div className="relative rounded-full ring-4 ring-card">
              <Avatar name={profile.display_name} url={profile.avatar_url} size={88} userId={profile.id} showPresence />
              {isMe && (
                <AvatarUploader
                  userId={profile.id}
                  onDone={() => {
                    refreshProfile();
                    load();
                  }}
                />
              )}
            </div>
            {isMe ? (
              editing ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="rounded-full border border-border bg-secondary p-2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    onClick={save}
                    className="rounded-full bg-gradient-brand p-2 text-white shadow-glow"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-4 py-2 text-sm font-semibold"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              )
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => navigate({ to: "/messages/$userId", params: { userId: profile.id } })}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-4 py-2 text-sm font-semibold"
                >
                  <MessageCircle className="h-4 w-4" /> Message
                </button>
                <button
                  onClick={toggleFollow}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${
                    isFollowing
                      ? "border border-border bg-secondary"
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
            )}
          </div>

          <div className="mt-3">
            {editing ? (
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xl font-bold outline-none focus:border-primary"
              />
            ) : (
              <h1 className="text-2xl font-bold">{profile.display_name}</h1>
            )}
            {editing ? (
              <div className="mt-1 flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1">
                <span className="text-sm text-muted-foreground">@</span>
                <input
                  value={usernameField}
                  onChange={(e) => setUsernameField(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  maxLength={20}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            )}

            {editing ? (
              <>
                <input
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  placeholder="Faculty (e.g. Computer Science)"
                  maxLength={80}
                  className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                />
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Short bio..."
                  maxLength={200}
                  rows={2}
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                />
                <div className="mt-2 rounded-xl border border-border bg-background p-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <IdCard className="h-3.5 w-3.5" /> Student number
                  </label>
                  <input
                    value={studentNumber}
                    onChange={(e) => setStudentNumber(e.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    placeholder="e.g. 4123456"
                    className="mt-1 w-full bg-transparent text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStudentNumber((v) => !v)}
                    className="mt-2 flex w-full items-center justify-between rounded-lg bg-secondary px-3 py-2 text-xs font-semibold"
                  >
                    <span className="flex items-center gap-1.5">
                      {showStudentNumber ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      Show on my profile
                    </span>
                    <span
                      className={`relative h-5 w-9 rounded-full transition ${
                        showStudentNumber ? "bg-gradient-brand" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                          showStudentNumber ? "left-[18px]" : "left-0.5"
                        }`}
                      />
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.faculty && (
                  <p className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                    🎓 {profile.faculty}
                  </p>
                )}
                {profile.show_student_number && profile.student_number && (
                  <p className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                    <IdCard className="h-3.5 w-3.5" /> {profile.student_number}
                  </p>
                )}
                {profile.bio && <p className="mt-1 w-full text-sm">{profile.bio}</p>}
              </div>
            )}

            <div className="mt-3 flex gap-4 text-sm">
              <span>
                <strong>{followers}</strong>{" "}
                <span className="text-muted-foreground">followers</span>
              </span>
              <span>
                <strong>{followingCount}</strong>{" "}
                <span className="text-muted-foreground">following</span>
              </span>
              <span>
                <strong>{posts.length}</strong>{" "}
                <span className="text-muted-foreground">posts</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No posts yet.
        </div>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onChange={load} />)
      )}
    </div>
  );
}

function AvatarUploader({ userId, onDone }: { userId: string; onDone: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage("avatars", userId, file);
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
      if (error) throw error;
      toast.success("Avatar updated");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <>
      <input ref={ref} type="file" accept="image/*" onChange={handle} className="hidden" />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-brand text-white shadow-glow disabled:opacity-60"
        aria-label="Upload avatar"
      >
        <Camera className="h-4 w-4" />
      </button>
    </>
  );
}

function CoverUploader({ userId, onDone }: { userId: string; onDone: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage("covers", userId, file);
      const { error } = await supabase.from("profiles").update({ cover_url: url }).eq("id", userId);
      if (error) throw error;
      toast.success("Cover updated");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <>
      <input ref={ref} type="file" accept="image/*" onChange={handle} className="hidden" />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/70 disabled:opacity-60"
        aria-label="Upload cover"
      >
        <Camera className="h-3.5 w-3.5" /> Cover
      </button>
    </>
  );
}
