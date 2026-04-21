import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { X } from "lucide-react";

const REASONS = [
  "Spam",
  "Harassment or bullying",
  "Hate speech",
  "Sexual content",
  "Violence",
  "Misinformation",
  "Other",
];

export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  targetType: "post" | "message" | "profile";
  targetId: string;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    const finalReason = details.trim() ? `${reason}: ${details.trim().slice(0, 500)}` : reason;
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason: finalReason,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Report sent. Thanks for keeping Nexus safe 💛");
    setDetails("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Report {targetType}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Your report is private. Thanks for helping the campus stay safe.
        </p>

        <div className="mt-4 space-y-1.5">
          {REASONS.map((r) => (
            <label
              key={r}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition ${
                reason === r
                  ? "border-primary bg-primary/10 font-semibold text-primary"
                  : "border-border hover:bg-secondary"
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="sr-only"
              />
              {r}
            </label>
          ))}
        </div>

        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Add details (optional)…"
          className="mt-3 w-full resize-none rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-border bg-secondary py-2.5 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 rounded-full bg-gradient-brand py-2.5 text-sm font-semibold text-white shadow-glow disabled:opacity-60"
          >
            {busy ? "Sending…" : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}
