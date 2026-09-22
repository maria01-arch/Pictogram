import type { ReactNode } from "react";

// Shared building blocks for the public legal pages (privacy, terms, delete-account).
export function LegalPage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 pb-16 pt-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {updated && <p className="mt-1 text-xs text-ink-muted">Last updated: {updated}</p>}
      <div className="mt-6 space-y-6 text-sm leading-relaxed text-ink-muted">{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-ink-light dark:text-ink-dark">{title}</h3>
      <div className="mt-1 space-y-2">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export const SUPPORT_EMAIL = "support@xchord.space";

export function SupportLink() {
  return (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-from underline">
      {SUPPORT_EMAIL}
    </a>
  );
}
