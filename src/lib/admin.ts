import { supabase } from "./supabaseClient";
import { createNotification } from "./notifications";
import type { VerificationApplication } from "@/types/database";
import { getUserLocal } from "@/lib/authUser";

export async function checkIsAdmin(): Promise<boolean> {
  const { data: { user } } = await getUserLocal();
  if (!user) return false;
  // RLS only ever returns a row for the caller's own admin status — this
  // can never be used to check whether someone ELSE is an admin.
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return !!data;
}

export type PendingApplication = VerificationApplication & {
  profiles?: { username: string; avatar_url: string | null };
};

export async function getPendingApplications(): Promise<PendingApplication[]> {
  const { data, error } = await supabase
    .from("verification_applications")
    .select("*, profiles(username, avatar_url)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getReviewedApplications(): Promise<PendingApplication[]> {
  const { data, error } = await supabase
    .from("verification_applications")
    .select("*, profiles(username, avatar_url)")
    .neq("status", "pending")
    .order("reviewed_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getSignedDocUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("verification-docs").createSignedUrl(path, 600);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function reviewApplication(
  applicationId: string,
  status: "approved" | "rejected",
  reviewerNotes: string
) {
  // Delete the doc files via the Storage API BEFORE updating status — this
  // can't happen in a database trigger (Supabase blocks raw SQL deletes on
  // storage.objects), so it has to happen here.
  const { data: current, error: fetchDocsError } = await supabase
    .from("verification_applications")
    .select("id_document_url, tx_screenshot_url")
    .eq("id", applicationId)
    .single();
  if (fetchDocsError) throw fetchDocsError;

  const pathsToDelete = [current?.id_document_url, current?.tx_screenshot_url].filter(
    (p): p is string => !!p
  );
  if (pathsToDelete.length > 0) {
    const { error: removeError } = await supabase.storage.from("verification-docs").remove(pathsToDelete);
    if (removeError) throw removeError;
  }

  const { error } = await supabase
    .from("verification_applications")
    .update({
      status,
      reviewer_notes: reviewerNotes || null,
      id_document_url: null,
      tx_screenshot_url: null,
    })
    .eq("id", applicationId);
  if (error) throw error;

  if (status === "approved") {
    const { data: application, error: fetchError } = await supabase
      .from("verification_applications")
      .select("user_id")
      .eq("id", applicationId)
      .single();
    if (fetchError) throw fetchError;

    const { error: verifyError } = await supabase
      .from("profiles")
      .update({ is_verified: true })
      .eq("id", application.user_id);
    if (verifyError) throw verifyError;
  }
}

export interface ReportRow {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  conversation_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  story_id: string | null;
  target_type: "user" | "post" | "comment" | "story" | "conversation";
  category: string | null;
  reason: string | null;
  evidence: string | null;
  evidence_url: string | null;
  status: "open" | "actioned" | "dismissed";
  created_at: string;
  reporter?: { username: string } | null;
  reported?: { username: string } | null;
  post?: {
    id: string;
    media_type: string;
    media_url: string | null;
    thumbnail_url: string | null;
    caption: string | null;
    text_content: string | null;
  } | null;
  comment?: { id: string; content: string } | null;
  story?: {
    id: string;
    media_type: string;
    media_url: string | null;
    thumbnail_url: string | null;
    text_content: string | null;
  } | null;
}

export async function getOpenReports(): Promise<ReportRow[]> {
  const { data, error } = await supabase
    .from("reports")
    .select(
      `*,
       reporter:profiles!reports_reporter_id_fkey(username),
       reported:profiles!reports_reported_user_id_fkey(username),
       post:posts!reports_post_id_fkey(id, media_type, media_url, thumbnail_url, caption, text_content),
       comment:comments!reports_comment_id_fkey(id, content),
       story:stories!reports_story_id_fkey(id, media_type, media_url, thumbnail_url, text_content)`
    )
    .eq("status", "open")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Marks a report handled and records who handled it and when.
async function resolveReport(reportId: string, status: "actioned" | "dismissed", note?: string) {
  const { data: { user } } = await getUserLocal();
  const { error } = await supabase
    .from("reports")
    .update({
      status,
      resolved_by: user?.id ?? null,
      resolved_at: new Date().toISOString(),
      resolution_note: note?.trim() || null,
    })
    .eq("id", reportId);
  if (error) throw error;
}

export async function dismissReport(reportId: string, note?: string) {
  await resolveReport(reportId, "dismissed", note);
}

// Deletes the reported post / comment / story (admin RLS allows it) and closes the
// report. Files are queued for removal by database triggers.
export async function removeReportedContent(report: ReportRow, note?: string) {
  if (report.target_type === "post" && report.post_id) {
    const { error } = await supabase.from("posts").delete().eq("id", report.post_id);
    if (error) throw error;
  } else if (report.target_type === "comment" && report.comment_id) {
    const { error } = await supabase.from("comments").delete().eq("id", report.comment_id);
    if (error) throw error;
  } else if (report.target_type === "story" && report.story_id) {
    const { error } = await supabase.from("stories").delete().eq("id", report.story_id);
    if (error) throw error;
  }
  await resolveReport(report.id, "actioned", note || "Content removed");
  fetch("/api/media/drain", { method: "POST" }).catch(() => {});
}

// Issues a strike against the reported user, marks the report actioned, and
// notifies the struck user — all steps happen together so a report can't
// silently get actioned without the user ever finding out.
export async function issueStrikeFromReport(
  report: Pick<ReportRow, "id" | "reported_user_id">,
  guidelineViolated: string,
  reason: string
) {
  const { error: strikeError } = await supabase.from("account_strikes").insert({
    user_id: report.reported_user_id,
    guideline_violated: guidelineViolated,
    reason,
  });
  if (strikeError) throw strikeError;

  await resolveReport(report.id, "actioned", `Strike issued: ${guidelineViolated}`);

  await createNotification({
    targetUserId: report.reported_user_id,
    type: "account_strike",
  });
}

// Blocks (or restores) a user's ability to sign in. Server-side, admin-only.
export async function setUserSuspended(userId: string, suspend: boolean) {
  const res = await fetch("/api/admin/suspend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, suspend }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not update the account");
}

// ---- strike appeals ----------------------------------------------------
export interface AppealRow {
  id: string;
  user_id: string;
  guideline_violated: string;
  reason: string;
  appeal_text: string | null;
  appeal_submitted_at: string | null;
  status: string;
  profiles?: { username: string } | null;
}

export async function getAppeals(): Promise<AppealRow[]> {
  const { data, error } = await supabase
    .from("account_strikes")
    .select("*, profiles!account_strikes_user_id_fkey(username)")
    .eq("status", "appealed")
    .order("appeal_submitted_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function resolveAppeal(
  strike: Pick<AppealRow, "id" | "user_id">,
  outcome: "upheld" | "overturned",
  note: string
) {
  const { error } = await supabase
    .from("account_strikes")
    .update({
      status: outcome,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: note.trim() || null,
    })
    .eq("id", strike.id);
  if (error) throw error;

  await createNotification({ targetUserId: strike.user_id, type: "account_strike" });
}

export interface SuspendedUser {
  id: string;
  username: string;
  suspended_at: string;
}

export async function getSuspendedUsers(): Promise<SuspendedUser[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, suspended_at")
    .not("suspended_at", "is", null)
    .order("suspended_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SuspendedUser[];
}
