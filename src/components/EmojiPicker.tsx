import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

const EMOJIS = [
  "😀","😂","🥹","😍","🥰","😎","🤩","🥳","😇","🙃",
  "😉","😘","😋","🤔","🤨","😏","😴","🤤","🥺","😭",
  "😤","😡","🤯","🥶","🥵","😱","🤗","🤝","👋","👏",
  "🙏","💪","🔥","✨","💯","🎉","🎊","💖","💜","💙",
  "💚","💛","🧡","❤️","🤍","💔","👀","👌","✌️","🤞",
  "🫶","🫡","🤙","🙌","💃","🕺","🎓","📚","☕","🍕",
  "🍔","🍟","🌮","🍦","🍩","🍪","⚽","🏀","🎮","🎵",
];

export function EmojiPicker({ onPick, align = "left" }: { onPick: (e: string) => void; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        aria-label="Add emoji"
      >
        <Smile className="h-5 w-5" />
      </button>
      {open && (
        <div
          className={`absolute bottom-full z-40 mb-2 w-72 rounded-2xl border border-border bg-card p-3 shadow-glow ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onPick(e);
                  setOpen(false);
                }}
                className="rounded-lg p-1 text-xl transition hover:bg-secondary"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
