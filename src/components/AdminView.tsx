"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkIsAdmin,
  getPendingApplications,
  getReviewedApplications,
  getSignedDocUrl,
  reviewApplication,
  type PendingApplication,
} from "@/lib/admin";

function DocImage({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    getSignedDocUrl(path).then(setUrl);
  }, [path]);
  if (!path) return null;
  if (!url) return <div className="h-40 w-full animate-pulse rounded-xl2 bg-black/5 dark:bg-white/10" />;
  return <img src={url} alt="" className="w-full rounded-xl2 object-contain" />;
}

export default function AdminView() {
  const router = useRouter();
  // null = still checking, false = not an admin (redirecting), true = show the panel
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");
  const [pending, setPending] = useState<PendingApplication[]>([]);
  const [reviewed, setReviewed] = useState<PendingApplication[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkIsAdmin().then((isAdmin) => {
      if (!isAdmin) {
        router.replace("/");
        return;
      }
      setAllowed(true);
      loadAll();
    });
  }, []);

  async function loadAll() {
    const [p, r] = await Promise.all([getPendingApplications(), getReviewedApplications()]);
    setPending(p);
    setReviewed(r);
  }

  async function handleReview(id: string, status: "approved" | "rejected") {
    setBusyId(id);
    setError(null);
    try {
      await reviewApplication(id, status, notes[id] ?? "");
      await loadAll();
    } catch (err) {
      console.error("Review failed:", err);
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setBusyId(null);
    }
  }

  // Render nothing at all while checking / redirecting — no "access
  // denied" flash that would confirm this route does something.
  if (allowed !== true) return null;

  return (
    <div className="mx-auto max-w-lg px-4 pb-16 pt-6">
      <h1 className="text-lg font-bold">Verification review</h1>

      {error && (
        <div className="mt-3 rounded-xl2 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setTab("pending")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === "pending" ? "bg-brand-gradient text-white" : "bg-black/5 dark:bg-white/10"}`}
        >
          Pending ({pending.length})
        </button>
        <button
          onClick={() => setTab("reviewed")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === "reviewed" ? "bg-brand-gradient text-white" : "bg-black/5 dark:bg-white/10"}`}
        >
          History
        </button>
      </div>

      {tab === "pending" && (
        <div className="mt-4 space-y-4">
          {pending.length === 0 && <p className="text-sm text-ink-muted">No pending applications.</p>}
          {pending.map((app) => (
            <div key={app.id} className="rounded-xl2 glass-card p-4">
              <p className="text-sm font-semibold">{app.profiles?.username ?? "unknown"} — {app.full_name}</p>
              {app.statement && <p className="mt-1 text-sm text-ink-muted">{app.statement}</p>}
              <p className="mt-1 text-xs text-ink-muted">
                Payment: {app.payment_method}{app.crypto_currency ? ` (${app.crypto_currency})` : ""}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <DocImage path={app.id_document_url} />
                <DocImage path={app.tx_screenshot_url} />
              </div>

              <textarea
                value={notes[app.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [app.id]: e.target.value }))}
                placeholder="Reviewer notes (optional)"
                rows={2}
                className="mt-3 w-full rounded-xl2 bg-black/5 p-2.5 text-sm outline-none dark:bg-white/10"
              />

              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => handleReview(app.id, "approved")}
                  disabled={busyId === app.id}
                  className="flex-1 rounded-full bg-brand-gradient py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReview(app.id, "rejected")}
                  disabled={busyId === app.id}
                  className="flex-1 rounded-full bg-red-500 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "reviewed" && (
        <div className="mt-4 space-y-2">
          {reviewed.length === 0 && <p className="text-sm text-ink-muted">Nothing reviewed yet.</p>}
          {reviewed.map((app) => (
            <div key={app.id} className="rounded-xl2 glass-card p-3 text-sm">
              <p className="font-semibold">
                {app.profiles?.username ?? "unknown"} —{" "}
                <span className={app.status === "approved" ? "text-green-500" : "text-red-500"}>{app.status}</span>
              </p>
              {app.reviewer_notes && <p className="mt-1 text-ink-muted">{app.reviewer_notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
