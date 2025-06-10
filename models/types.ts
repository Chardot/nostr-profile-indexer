export interface Profile {
  pubkey: string;
  has_picture: boolean;
  has_username: boolean;
  has_bio: boolean;
  score: number;
  relay_list: string[];
  last_seen: Date;
  created_at: Date;
}

export interface UserSession {
  session_id: string;
  seen_profiles: string[];
  created_at: Date;
  last_active: Date;
}

export interface ProfileBatchResponse {
  profiles: {
    pubkey: string;
    relays: string[];
    score: number;
    last_updated: string;
  }[];
  next_cursor?: string;
}