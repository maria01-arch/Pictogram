// Hand-written types mirroring supabase/schema.sql.
// Swap for `supabase gen types typescript` output once the project is live.

export type MediaType = "image" | "video";
export type StrikeStatus = "active" | "appealed" | "overturned" | "upheld";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_business: boolean;
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
  caption: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  profiles?: Pick<Profile, "username" | "avatar_url">;
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: MediaType;
  thumbnail_url: string | null;
  created_at: string;
  expires_at: string;
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
  created_at: string;
  profiles?: Pick<Profile, "username" | "avatar_url">;
}

// Every table needs Row/Insert/Update/Relationships to satisfy
// @supabase/supabase-js's generic constraints — omitting Relationships
// causes update()/insert() argument types to silently collapse to `never`.
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
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
