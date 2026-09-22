import { supabase } from "./supabaseClient";
import { getUserLocal } from "@/lib/authUser";
import type { Profile } from "@/types/database";

export type PermissionSetting = "everyone" | "people_i_follow";

export interface PrivacySettings {
  dm_permission: PermissionSetting;
  comment_permission: PermissionSetting;
  disable_downloads: boolean;
  hide_following_list: boolean;
  is_locked: boolean;
}

export async function getMyPrivacySettings(): Promise<PrivacySettings | null> {
  const { data: { user } } = await getUserLocal();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("dm_permission, comment_permission, disable_downloads, hide_following_list, is_locked")
    .eq("id", user.id)
    .single();
  if (!data) return null;
  return {
    dm_permission: (data.dm_permission as PermissionSetting) ?? "everyone",
    comment_permission: (data.comment_permission as PermissionSetting) ?? "everyone",
    disable_downloads: !!data.disable_downloads,
    hide_following_list: !!data.hide_following_list,
    is_locked: !!data.is_locked,
  };
}

export async function updatePrivacySetting(patch: Partial<PrivacySettings>) {
  const { data: { user } } = await getUserLocal();
  if (!user) throw new Error("You must be signed in.");
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) throw error;
}
