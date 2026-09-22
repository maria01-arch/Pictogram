import { supabase } from "./supabaseClient";
import { getUserLocal } from "@/lib/authUser";

export type ReportTargetType = "user" | "post" | "comment" | "story" | "conversation";

export const REPORT_CATEGORIES = [
  "Spam or scam",
  "Nudity or sexual content",
  "Harassment or bullying",
  "Hate speech",
  "Violence or threats",
  "Self-harm",
  "Child safety concern",
  "Impersonation",
  "Something else",
] as const;

export interface SubmitReportArgs {
  targetType: ReportTargetType;
  reportedUserId: string;
  category: string;
  details?: string;
  postId?: string;
  commentId?: string;
  storyId?: string;
  conversationId?: string;
  // A short copy of what was reported. Kept on the report so an admin can still
  // see it after the author deletes the content.
  evidence?: string | null;
  evidenceUrl?: string | null;
}

export async function submitReport(args: SubmitReportArgs) {
  const { data: { user } } = await getUserLocal();
  if (!user) throw new Error("You must be signed in.");
  if (user.id === args.reportedUserId) throw new Error("You can't report yourself.");

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    reported_user_id: args.reportedUserId,
    target_type: args.targetType,
    category: args.category,
    reason: args.details?.trim() ? args.details.trim().slice(0, 1000) : null,
    post_id: args.postId ?? null,
    comment_id: args.commentId ?? null,
    story_id: args.storyId ?? null,
    conversation_id: args.conversationId ?? null,
    evidence: args.evidence ? args.evidence.slice(0, 2000) : null,
    evidence_url: args.evidenceUrl ?? null,
  });
  if (error) {
    if (error.message?.includes("Too many reports")) {
      throw new Error("You've sent a lot of reports recently. Please try again in a while.");
    }
    throw error;
  }
}
