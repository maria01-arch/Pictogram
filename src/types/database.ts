// Hand-written types mirroring supabase/schema.sql.
// Swap for `supabase gen types typescript` output once the project is live.

export type MediaType = "image" | "video" | "text";
export type StrikeStatus = "active" | "appealed" | "overturned" | "upheld";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_business: boolean;
  location: string | null;
  requires_follow_approval: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  media_url: string;
  media_type: MediaType;
  thumbnail_url: string | null;
  blurhash: string | null;
  text_content: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  profiles?: Pick<Profile, "username" | "avatar_url" | "is_verified">;
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: MediaType;
  thumbnail_url: string | null;
  created_at: string;
  expires_at: string;
  text_content: string | null;
}

export interface AccountStrike {
  id: string;
  user_id: string;
  guideline_violated: string;
  reason: string;
  evidence_url: string | null;
  status: StrikeStatus;
  appeal_text: string | null;
  appeal_submitted_at: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  is_group: boolean;
  title: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  reply_to_id: string | null;
  edited_at: string | null;
  created_at: string;
  profiles?: Pick<Profile, "username" | "avatar_url" | "is_verified">;
}

type TableDef<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<Profile>;
      posts: TableDef<Post>;
      stories: TableDef<Story>;
      account_strikes: TableDef<AccountStrike>;
      conversations: TableDef<Conversation>;
      messages: TableDef<Message>;
    };
    // Matches the shape Supabase's own `supabase gen types` output uses for
    // "nothing here" — a real empty object, NOT Record<string, never>
    // (which is an index signature that maps every key to never and was
    // the actual cause of the update()/insert() "never" type errors).
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type FollowStatus = "pending" | "accepted";

export interface Like {
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface SavedPost {
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Pick<Profile, "username" | "avatar_url" | "is_verified">;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  status: FollowStatus;
  created_at: string;
  profiles?: Profile; // joined profile of whichever side the query selected
}

export interface MessageReaction {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface BlockedUser {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}
