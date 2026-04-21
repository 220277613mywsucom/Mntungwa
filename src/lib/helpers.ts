export const UWC_DOMAINS = ["myuwc.ac.za", "uwc.ac.za"];

export function isUwcEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  return UWC_DOMAINS.some((d) => lower.endsWith("@" + d));
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function gradientFor(seed: string): string {
  const palettes = [
    "from-fuchsia-500 to-orange-400",
    "from-violet-500 to-pink-500",
    "from-cyan-400 to-fuchsia-500",
    "from-emerald-400 to-cyan-500",
    "from-amber-400 to-rose-500",
    "from-indigo-500 to-fuchsia-500",
    "from-pink-500 to-yellow-400",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length];
}
