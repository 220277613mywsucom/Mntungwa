import { supabase } from "@/integrations/supabase/client";

const MAX_IMG_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB

export async function uploadImage(
  bucket: "avatars" | "post-images" | "stories" | "covers",
  userId: string,
  file: File
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please select an image file");
  if (file.size > MAX_IMG_BYTES) throw new Error("Image must be under 5MB");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Uploads a voice note to the private `voice-notes` bucket. Returns the storage path (not a URL). */
export async function uploadVoiceNote(userId: string, blob: Blob): Promise<string> {
  if (blob.size > MAX_AUDIO_BYTES) throw new Error("Voice note must be under 10MB");
  const path = `${userId}/${crypto.randomUUID()}.webm`;
  const { error } = await supabase.storage.from("voice-notes").upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: blob.type || "audio/webm",
  });
  if (error) throw error;
  return path;
}

/** Returns a short-lived signed URL for a voice note. */
export async function signVoiceNote(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("voice-notes")
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
