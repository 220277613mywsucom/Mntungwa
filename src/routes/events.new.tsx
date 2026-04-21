import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadImage } from "@/lib/upload";
import { ArrowLeft, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/events/new")({
  head: () => ({ meta: [{ title: "Create event — Nexus" }] }),
  component: () => (
    <RequireAuth>
      <NewEvent />
    </RequireAuth>
  ),
});

function NewEvent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const url = await uploadImage("post-images", user.id, file);
      setCover(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !startAt) return;
    setBusy(true);
    const { error } = await supabase.from("events").insert({
      created_by: user.id,
      title: title.trim().slice(0, 120),
      description: description.trim() || null,
      location: location.trim() || null,
      start_at: new Date(startAt).toISOString(),
      end_at: endAt ? new Date(endAt).toISOString() : null,
      cover_url: cover,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event created 🎉");
    navigate({ to: "/events" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/events" className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to events
      </Link>
      <h1 className="text-2xl font-bold">Create campus event 🎉</h1>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-soft"
      >
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            required
            placeholder="e.g. CS101 Study Jam"
            className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
          />
        </Field>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="What's happening?"
            className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts">
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
              className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
            />
          </Field>
          <Field label="Ends (optional)">
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
            />
          </Field>
        </div>

        <Field label="Location (optional)">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={120}
            placeholder="e.g. Library 3rd floor"
            className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
          />
        </Field>

        <Field label="Cover image (optional)">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
          {cover ? (
            <div className="relative">
              <img src={cover} alt="" className="max-h-56 w-full rounded-2xl object-cover" />
              <button
                type="button"
                onClick={() => setCover(null)}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background px-4 py-6 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary"
            >
              <ImageIcon className="h-5 w-5" />
              {uploading ? "Uploading…" : "Add cover image"}
            </button>
          )}
        </Field>

        <button
          type="submit"
          disabled={busy || !title.trim() || !startAt}
          className="w-full rounded-full bg-gradient-brand py-3 font-semibold text-white shadow-glow disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create event"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
