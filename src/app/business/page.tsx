const ITEMS = [
  { label: "DM configuration", description: "Set up automated replies and inbox rules" },
  { label: "Get verified", description: "Apply for a verification badge" },
  { label: "Apply for monetization", description: "Unlock creator payouts and brand tools" },
];

export default function BusinessPage() {
  return (
    <div className="px-4 pb-8 pt-4">
      <h2 className="text-lg font-bold">Business console</h2>
      <p className="mt-1 text-sm text-ink-muted">Tools for creators and businesses.</p>

      <div className="mt-5 overflow-hidden rounded-xl2 glass-card">
        {ITEMS.map((item, i) => (
          <div
            key={item.label}
            className={`px-4 py-3.5 ${i !== 0 ? "border-t border-black/5 dark:border-white/5" : ""}`}
          >
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{item.description} — coming soon.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
