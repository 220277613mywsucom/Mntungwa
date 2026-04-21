import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { isUwcEmail, UWC_DOMAINS } from "@/lib/helpers";
import { Sparkles, Mail, Lock, User, IdCard } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Nexus" },
      { name: "description", content: "Join Nexus with your UWC student email." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUwcEmail(email)) {
      toast.error(`Use your UWC email (@${UWC_DOMAINS.join(" or @")})`);
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!displayName.trim()) {
          toast.error("Please enter your name");
          setBusy(false);
          return;
        }
        const sn = studentNumber.trim();
        if (!/^\d{6,12}$/.test(sn)) {
          toast.error("Student number must be 6–12 digits");
          setBusy(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName.trim(), student_number: sn },
          },
        });
        if (error) throw error;
        toast.success("Welcome to Nexus! 🎉");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-mesh px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-brand shadow-glow">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gradient-brand">Nexus</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The social home for UWC students 💜
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="mb-6 flex rounded-2xl bg-secondary p-1">
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                mode === "signup" ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}
            >
              Sign up
            </button>
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                mode === "signin" ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}
            >
              Sign in
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <>
                <Field icon={User} label="Display name">
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-transparent outline-none"
                  />
                </Field>
                <Field icon={IdCard} label="Student number">
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    pattern="\d{6,12}"
                    value={studentNumber}
                    onChange={(e) => setStudentNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 4123456"
                    className="w-full bg-transparent outline-none"
                  />
                </Field>
              </>
            )}
            <Field icon={Mail} label="UWC email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@myuwc.ac.za"
                className="w-full bg-transparent outline-none"
              />
            </Field>
            <Field icon={Lock} label="Password">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-transparent outline-none"
              />
            </Field>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-gradient-brand py-3 font-semibold text-white shadow-glow transition active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Only UWC students can join. Use your{" "}
            <span className="font-semibold text-foreground">@myuwc.ac.za</span> or{" "}
            <span className="font-semibold text-foreground">@uwc.ac.za</span> email.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        {children}
      </div>
    </label>
  );
}
