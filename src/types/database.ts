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
  // joined at query time
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

// Minimal Database interface shape for @supabase/ssr generics.
// Replace with the full generated type when available.
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile };
      posts: { Row: Post };
      stories: { Row: Story };
      account_strikes: { Row: AccountStrike };
      conversations: { Row: Conversation };
      messages: { Row: Message };
    };
  };
}
