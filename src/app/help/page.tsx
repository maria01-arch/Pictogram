import Link from "next/link";

const TOPICS = [
  {
    q: "How do I report something?",
    a: "Tap the ⋯ menu on a post, the Report link under a comment, Report on a story, or ⋯ on someone's profile. Pick a reason and submit. Our team reviews every report.",
  },
  {
    q: "How do I block someone?",
    a: "Open their profile, tap ⋯ and choose Block. Blocked people can't message, follow or comment on you, and you won't see their content. Manage blocked accounts in Menu → Privacy.",
  },
  {
    q: "What happens when I get a strike?",
    a: "You'll get a notification and the full reason appears in Menu → Account health. You can appeal a strike there and a reviewer will reply.",
  },
  {
    q: "How do I delete my account?",
    a: "Go to Menu → Settings → Delete account. Everything you posted and all of your messages are permanently removed.",
  },
  {
    q: "Who can see my posts?",
    a: "Posts are visible to everyone on the app. Turn on \"Approve new followers\" in Settings to review follow requests before anyone can follow you.",
  },
];

export default function HelpPage() {
  return (
    <div className="px-4 pb-10 pt-4">
      <h2 className="text-lg font-bold">Help</h2>
      <p className="mt-1 text-sm text-ink-muted">Quick answers, and how to reach us.</p>

      <div className="mt-5 space-y-3">
        {TOPICS.map((t) => (
          <div key={t.q} className="rounded-xl2 glass-card p-4">
            <p className="text-sm font-semibold">{t.q}</p>
            <p className="mt-1.5 text-sm text-ink-muted">{t.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl2 glass-card p-4">
        <p className="text-sm font-semibold">Still need help?</p>
        <p className="mt-1.5 text-sm text-ink-muted">
          Email us at{" "}
          <a href="mailto:support@xchord.space" className="font-semibold text-brand-from">
            support@xchord.space
          </a>
          .
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-brand-from">
          <Link href="/terms">Terms &amp; Community Guidelines</Link>
          <Link href="/privacy-policy">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}
