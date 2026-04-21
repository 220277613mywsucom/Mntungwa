import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const TAG_RE = /(#[A-Za-z0-9_]{2,30})/g;

/** Renders text with #hashtags as Links to /tag/$tag. */
export function renderWithTags(text: string): ReactNode[] {
  const parts = text.split(TAG_RE);
  return parts.map((part, i) => {
    if (TAG_RE.test(part)) {
      const tag = part.slice(1).toLowerCase();
      return (
        <Link
          key={i}
          to="/tag/$tag"
          params={{ tag }}
          className="font-semibold text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
