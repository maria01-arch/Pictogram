"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  checkIsAdmin,
  getPendingApplications,
  getReviewedApplications,
  getSignedDocUrl,
  reviewApplication,
  getOpenReports,
  dismissReport,
  removeReportedContent,
  issueStrikeFromReport,
  setUserSuspended,
  getAppeals,
  resolveAppeal,
  getSuspendedUsers,
  type SuspendedUser,
  type PendingApplication,
  type ReportRow,
  type AppealRow,
} from "@/lib/admin";
import ConfirmModal from "./ConfirmModal";
import { getErrorMessage } from "@/lib/errorMessage";

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

type Tab = "reports" | "appeals" | "pending" | "suspended" | "reviewed";

const TYPE_LABEL: Record<ReportRow["target_type"], string> = {
  user: "Profile",
  post: "Post",
  comment: "Comment",
  story: "Story",
  conversation: "Chat",
};

// Shows what was reported. Falls back to the copy saved at report time, so
// it still works after the author deletes the content.
function ReportedContent({ r }: { r: ReportRow }) {
  const thumb =
    r.post?.thumbnail_url ?? r.post?.media_url ?? r.story?.thumbnail_url ?? r.story?.media_url ?? r.evidence_url;
  const text =
    r.post?.caption ??
    r.post?.text_content ??
    r.comment?.content ??
    r.story?.text_content ??
    r.evidence ??
    null;
  const gone =
    (r.target_type === "post" && !r.post) ||
    (r.target_type === "comment" && !r.comment) ||
    (r.target_type === "story" && !r.story);

  return (
    <div className="mt-3 space-y-2">
      {gone && (
        <p className="text-xs font-semibold text-amber-500">
          The original has been deleted — showing the copy saved when it was reported.
        </p>
      )}
      {thumb && r.target_type !== "conversation" && (
        <img src={thumb} alt="" className="max-h-60 w-full rounded-xl2 object-contain bg-black/5 dark:bg-white/5" />
      )}
      {text && (
        <p className="whitespace-pre-wrap rounded-xl2 bg-black/5 p-2.5 text-sm dark:bg-white/10">{text}</p>
      )}
    </div>
  );
}

export default function AdminView() {
  const router = useRouter();
  // null = still checking, false = not an admin (redirecting), true = show the panel
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("reports");
  const [pending, setPending] = useState<PendingApplication[]>([]);
  const [reviewed, setReviewed] = useState<PendingApplication[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [appeals, setAppeals] = useState<AppealRow[]>([]);
  const [suspended, setSuspended] = useState<SuspendedUser[]>([]);
  const [strikeFormFor, setStrikeFormFor] = useState<string | null>(null);
  const [guideline, setGuideline] = useState<Record<string, string>>({});
  const [strikeReason, setStrikeReason] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<ReportRow | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<ReportRow | null>(null);

  useEffect(() => {
    checkIsAdmin().then((isAdmin) => {
      if (!isAdmin) {
        router.replace("/");
        return;
      }
      setAllowed(true);
      loadAll();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    try {
      const [p, r, rep, ap, su] = await Promise.all([
        getPendingApplications(),
        getReviewedApplications(),
        getOpenReports(),
        getAppeals(),
        getSuspendedUsers(),
      ]);
      setSuspended(su);
      setPending(p);
      setReviewed(r);
      setReports(rep);
      setAppeals(ap);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  // Runs one admin action with the shared busy / error / refresh handling.
  async function run(id: string, action: () => Promise<void>) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await loadAll();
    } catch (err) {
      console.error("Admin action failed:", err);
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  function handleIssueStrike(report: ReportRow) {
    const g = guideline[report.id]?.trim();
    const r = strikeReason[report.id]?.trim() ?? report.reason?.trim();
    if (!g || !r) {
      setError("Both the guideline and reason are required to issue a strike.");
      return;
    }
    run(report.id, async () => {
      await issueStrikeFromReport(report, g, r);
      setStrikeFormFor(null);
    });
  }

  // Render nothing at all while checking / redirecting — no "access
  // denied" flash that would confirm this route does something.
  if (allowed !== true) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "reports", label: `Reports (${reports.length})` },
    { key: "appeals", label: `Appeals (${appeals.length})` },
    { key: "pending", label: `Verification (${pending.length})` },
    { key: "suspended", label: `Suspended (${suspended.length})` },
    { key: "reviewed", label: "History" },
  ];

  return (
    <div className="mx-auto max-w-lg px-4 pb-16 pt-6">
      <h1 className="text-lg font-bold">Admin</h1>

      {error && <div className="mt-3 rounded-xl2 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              tab === t.key ? "bg-brand-gradient text-white" : "bg-black/5 dark:bg-white/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------------- REPORTS ---------------- */}
      {tab === "reports" && (
        <div className="mt-4 space-y-4">
          {reports.length === 0 && <p className="text-sm text-ink-muted">No open reports. 🎉</p>}
          {reports.map((r) => {
            const canRemove =
              (r.target_type === "post" && r.post_id) ||
              (r.target_type === "comment" && r.comment_id) ||
              (r.target_type === "story" && r.story_id);
            return (
              <div key={r.id} className="rounded-xl2 glass-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand-gradient px-2.5 py-0.5 text-xs font-semibold text-white">
                    {TYPE_LABEL[r.target_type] ?? r.target_type}
                  </span>
                  {r.category && <span className="text-xs font-semibold">{r.category}</span>}
                </div>
                <p className="mt-2 text-sm">
                  <span className="font-semibold">{r.reporter?.username ?? "unknown"}</span> reported{" "}
                  <Link href={`/profile/${r.reported?.username ?? ""}`} className="font-semibold text-brand-from">
                    @{r.reported?.username ?? "unknown"}
                  </Link>
                </p>
                {r.reason && <p className="mt-1 text-sm text-ink-muted">"{r.reason}"</p>}
                <p className="mt-1 text-xs text-ink-muted">{new Date(r.created_at).toLocaleString()}</p>

                <ReportedContent r={r} />

                {strikeFormFor === r.id ? (
                  <div className="mt-3 space-y-2">
                    <input
                      value={guideline[r.id] ?? r.category ?? ""}
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
                      <button
                        onClick={() => setStrikeFormFor(null)}
                        className="flex-1 rounded-full bg-black/5 py-2 text-sm font-semibold dark:bg-white/10"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {canRemove && (
                      <button
                        onClick={() => setConfirmRemove(r)}
                        disabled={busyId === r.id}
                        className="rounded-full bg-red-500 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      >
                        Remove content
                      </button>
                    )}
                    <button
                      onClick={() => setStrikeFormFor(r.id)}
                      disabled={busyId === r.id}
                      className="rounded-full bg-amber-500 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Issue strike
                    </button>
                    <button
                      onClick={() => setConfirmSuspend(r)}
                      disabled={busyId === r.id}
                      className="rounded-full bg-black/80 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white/20"
                    >
                      Suspend account
                    </button>
                    <button
                      onClick={() => run(r.id, () => dismissReport(r.id))}
                      disabled={busyId === r.id}
                      className="rounded-full bg-black/5 py-2 text-sm font-semibold dark:bg-white/10"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------- APPEALS ---------------- */}
      {tab === "appeals" && (
        <div className="mt-4 space-y-4">
          {appeals.length === 0 && <p className="text-sm text-ink-muted">No appeals waiting.</p>}
          {appeals.map((a) => (
            <div key={a.id} className="rounded-xl2 glass-card p-4">
              <p className="text-sm font-semibold">@{a.profiles?.username ?? "unknown"}</p>
              <p className="mt-1 text-xs text-ink-muted">
                Strike: {a.guideline_violated} — {a.reason}
              </p>
              <p className="mt-2 whitespace-pre-wrap rounded-xl2 bg-black/5 p-2.5 text-sm dark:bg-white/10">
                {a.appeal_text}
              </p>
              <textarea
                value={notes[a.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                placeholder="Response shown to the user (optional)"
                rows={2}
                className="mt-3 w-full rounded-xl2 bg-black/5 p-2.5 text-sm outline-none dark:bg-white/10"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => run(a.id, () => resolveAppeal(a, "overturned", notes[a.id] ?? ""))}
                  disabled={busyId === a.id}
                  className="flex-1 rounded-full bg-brand-gradient py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Overturn strike
                </button>
                <button
                  onClick={() => run(a.id, () => resolveAppeal(a, "upheld", notes[a.id] ?? ""))}
                  disabled={busyId === a.id}
                  className="flex-1 rounded-full bg-red-500 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Uphold strike
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- VERIFICATION ---------------- */}
      {tab === "pending" && (
        <div className="mt-4 space-y-4">
          {pending.length === 0 && <p className="text-sm text-ink-muted">No pending applications.</p>}
          {pending.map((app) => (
            <div key={app.id} className="rounded-xl2 glass-card p-4">
              <p className="text-sm font-semibold">
                {app.profiles?.username ?? "unknown"} — {app.full_name}
              </p>
              {app.statement && <p className="mt-1 text-sm text-ink-muted">{app.statement}</p>}
              <p className="mt-1 text-xs text-ink-muted">
                Payment: {app.payment_method}
                {app.crypto_currency ? ` (${app.crypto_currency})` : ""}
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
                  onClick={() => run(app.id, () => reviewApplication(app.id, "approved", notes[app.id] ?? ""))}
                  disabled={busyId === app.id}
                  className="flex-1 rounded-full bg-brand-gradient py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  onClick={() => run(app.id, () => reviewApplication(app.id, "rejected", notes[app.id] ?? ""))}
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

      {/* ---------------- SUSPENDED ---------------- */}
      {tab === "suspended" && (
        <div className="mt-4 space-y-2">
          {suspended.length === 0 && <p className="text-sm text-ink-muted">No suspended accounts.</p>}
          {suspended.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-xl2 glass-card p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">@{u.username}</p>
                <p className="text-xs text-ink-muted">Since {new Date(u.suspended_at).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => run(u.id, () => setUserSuspended(u.id, false))}
                disabled={busyId === u.id}
                className="rounded-full bg-brand-gradient px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                Restore
              </button>
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

      {confirmRemove && (
        <ConfirmModal
          title={`Remove this ${TYPE_LABEL[confirmRemove.target_type].toLowerCase()}?`}
          message="It will be deleted for everyone and the report will be closed. This can't be undone."
          confirmLabel="Remove"
          danger
          onConfirm={() => {
            const r = confirmRemove;
            setConfirmRemove(null);
            run(r.id, () => removeReportedContent(r));
          }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

      {confirmSuspend && (
        <ConfirmModal
          title={`Suspend @${confirmSuspend.reported?.username ?? "this user"}?`}
          message="They will be signed out and unable to log in until you restore the account. Reports stay open — issue a strike or dismiss afterwards."
          confirmLabel="Suspend"
          danger
          onConfirm={() => {
            const r = confirmSuspend;
            setConfirmSuspend(null);
            run(r.id, () => setUserSuspended(r.reported_user_id, true));
          }}
          onCancel={() => setConfirmSuspend(null)}
        />
      )}
    </div>
  );
}
