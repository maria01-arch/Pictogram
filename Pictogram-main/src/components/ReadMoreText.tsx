"use client";

import { useState, type ReactNode } from "react";

// Truncates long text with a "more"/"less" toggle. `render` lets a caller
// still run the truncated string through something like HashtagText —
// pass children as a function if you need that; otherwise plain text is
// rendered as-is.
export default function ReadMoreText({
  text,
  limit = 140,
  className = "",
  render,
}: {
  text: string;
  limit?: number;
  className?: string;
  render?: (text: string) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > limit;
  const display = !isLong || expanded ? text : text.slice(0, limit).trimEnd() + "…";

  return (
    <span className={className}>
      {render ? render(display) : display}
      {isLong && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="ml-1 font-medium text-ink-muted"
        >
          {expanded ? "less" : "more"}
        </button>
      )}
    </span>
  );
}
