import { supabase } from "./supabaseClient";
import type { VerificationApplication } from "@/types/database";

export async function checkIsAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
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
