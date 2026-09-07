"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkIsAdmin,
  getPendingApplications,
  getReviewedApplications,
  getSignedDocUrl,
  reviewApplication,
  getOpenReports,
  dismissReport,
  issueStrikeFromReport,
  type PendingApplication,
  type ReportRow,
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
  const [tab, setTab] = useState<"pending" | "reviewed" | "reports">("pending");
  const [pending, setPending] = useState<PendingApplication[]>([]);
  const [reviewed, setReviewed] = useState<PendingApplication[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [strikeFormFor, setStrikeFormFor] = useState<string | null>(null);
  const [guideline, setGuideline] = useState<Record<string, string>>({});
  const [strikeReason, setStrikeReason] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugStatus, setDebugStatus] = useState<string>("(no action taken yet)");

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
    const [p, r, rep] = await Promise.all([getPendingApplications(), getReviewedApplications(), getOpenReports()]);
    setPending(p);
    setReviewed(r);
    setReports(rep);
  }

  async function handleReview(id: string, status: "approved" | "rejected") {
    setDebugStatus(`Tapped "${status}" for application ${id.slice(0, 8)}… starting…`);
    setBusyId(id);
    setError(null);
    try {
      await reviewApplication(id, status, notes[id] ?? "");
      setDebugStatus(`✅ Success — marked ${status}. Refreshing list…`);
      await loadAll();
      setDebugStatus(`✅ Done — ${status}, list refreshed.`);
    } catch (err) {
      console.error("Review failed:", err);
      const message = err instanceof Error ? err.message : JSON.stringify(err);
      setDebugStatus(`❌ Failed on "${status}": ${message}`);
      setError(message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismissReport(id: string) {
    setBusyId(id);
    try {
      await dismissReport(id);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dismiss report");
    } finally {
      setBusyId(null);
    }
  }

  async function handleIssueStrike(report: ReportRow) {
    const g = guideline[report.id]?.trim();
    const r = strikeReason[report.id]?.trim();
    if (!g || !r) {
      setError("Both the guideline and reason are required to issue a strike.");
      return;
    }
    setBusyId(report.id);
    try {
      await issueStrikeFromReport(report, g, r);
      setStrikeFormFor(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to issue strike");
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

      <div className="mt-3 rounded-xl2 border-2 border-dashed border-brand-from/40 bg-brand-from/5 p-3 font-mono text-xs">
        <span className="font-semibold">Debug status:</span> {debugStatus}
      </div>

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
        <button
          onClick={() => setTab("reports")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === "reports" ? "bg-brand-gradient text-white" : "bg-black/5 dark:bg-white/10"}`}
        >
          Reports ({reports.length})
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
      {tab === "reports" && (
        <div className="mt-4 space-y-4">
          {reports.length === 0 && <p className="text-sm text-ink-muted">No open reports.</p>}
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl2 glass-card p-4">
              <p className="text-sm font-semibold">
                {r.reporter?.username ?? "unknown"} reported {r.reported?.username ?? "unknown"}
              </p>
              {r.reason && <p className="mt-1 text-sm text-ink-muted">"{r.reason}"</p>}
              <p className="mt-1 text-xs text-ink-muted">{new Date(r.created_at).toLocaleString()}</p>

              {strikeFormFor === r.id ? (
                <div className="mt-3 space-y-2">
                  <input
                    value={guideline[r.id] ?? ""}
                    onChange={(e) => setGuideline((g) => ({ ...g, [r.id]: e.target.value }))}
                    placeholder="Guideline violated (e.g. Harassment)"
                    className="w-full rounded-xl2 bg-black/5 p-2.5 text-sm outline-none dark:bg-white/10"
                  />
                  <textarea
                    value={strikeReason[r.id] ?? r.reason ?? ""}
                    onChange={(e) => setStrikeReason((s) => ({ ...s, [r.id]: e.target.value }))}
                    placeholder="Reason shown to the user"
                    rows={2}
                    className="w-full rounded-xl2 bg-black/5 p-2.5 text-sm outline-none dark:bg-white/10"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleIssueStrike(r)}
                      disabled={busyId === r.id}
                      className="flex-1 rounded-full bg-red-500 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Confirm strike
                    </button>
                    <button onClick={() => setStrikeFormFor(null)} className="flex-1 rounded-full bg-black/5 py-2 text-sm font-semibold dark:bg-white/10">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setStrikeFormFor(r.id)}
                    disabled={busyId === r.id}
                    className="flex-1 rounded-full bg-red-500 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Issue strike
                  </button>
                  <button
                    onClick={() => handleDismissReport(r.id)}
                    disabled={busyId === r.id}
                    className="flex-1 rounded-full bg-black/5 py-2 text-sm font-semibold dark:bg-white/10"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
