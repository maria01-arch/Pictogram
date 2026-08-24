import Link from "next/link";

// Splits text on #hashtags and turns them into search links, everything
// else renders as plain text.
export default function HashtagText({ text }: { text: string }) {
  const parts = text.split(/(#[a-zA-Z0-9_]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("#") ? (
          <Link key={i} href={`/search?q=${encodeURIComponent(part)}`} className="text-brand-from">
            {part}
          </Link>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
