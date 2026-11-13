// Shapes exchanged between the server actions and the admin pages.

export const PAGE_SIZE = 50;

// Allowed values of the trail_difficulty / checkpoint_type enums and the trails.status check.
export const DIFFICULTIES = ["easy", "medium", "hard", "ultra"];
export const TRAIL_STATUSES = ["open", "closed", "seasonal", "maintenance"];
export const CHECKPOINT_TYPES = ["viewpoint", "water_source", "campsite", "landmark", "summit", "shelter", "bridge", "pass", "lake", "waterfall", "ruins", "church", "tower"];

// Every action resolves to one of these: `error` is a message when nothing was done (or read),
// and null on success. `warning` is set when the action took effect but a follow-up step failed.
export type Failure = { error: string };
export type Result<T = object> = (T & { error: null }) | Failure;
export type Paged<T> = Result<{ data: T[]; total: number }>;
export type Mutation = Result<{ warning: string | null }>;

export interface GeoPoint {
  type: string;
  coordinates: [number, number]; // [lng, lat]
}

export interface RouteGeoJSON {
  type: string;
  coordinates: [number, number][]; // [lng, lat] — GeoJSON order
}

export interface Stats {
  trails: number;
  users: number;
  completions: number;
  reviews: number;
}

export interface AnalyticsData {
  completionsPerWeek: { week: string; count: number }[];
  topTrails: { name: string; count: number }[];
  signupsPerMonth: { month: string; count: number }[];
}

export interface TrailListItem {
  id: string;
  name_en: string;
  name_ka: string | null;
  region: string;
  difficulty: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  is_published: boolean;
}

export interface TrailInput {
  name_en: string;
  name_ka: string | null;
  description_en: string | null;
  description_ka: string | null;
  region: string;
  difficulty: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  estimated_hours: number | null;
  cover_image_url: string | null;
  is_published: boolean;
  status: string;
  status_note: string | null;
}

export interface Trail extends TrailInput {
  id: string;
}

export interface Checkpoint {
  id: string;
  name_en: string;
  name_ka: string | null;
  type: string;
  elevation_m: number | null;
  is_checkable: boolean;
  sort_order: number | null;
  coordinates: GeoPoint | null;
}

export interface CheckpointInput {
  name_en: string;
  name_ka: string | null;
  type: string;
  lat: number;
  lng: number;
  elevation_m: number | null;
  is_checkable: boolean;
}

export interface TrailMedia {
  id: string;
  url: string;
  caption: string | null;
  type: string;
}

export interface UserListItem {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  total_trails_completed: number;
  created_at: string;
}

export interface ProfileInput {
  username: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
}

export interface UserCompletion {
  id: string;
  trail_id: string;
  status: string;
  elapsed_seconds: number | null;
  completed_at: string;
  trails: { name_en: string; difficulty: string } | null;
}

export interface UserBadge {
  id: string;
  earned_at: string;
  badges: { name_en: string; icon: string; category: string } | null;
}

export type CompletionStatus = "pending" | "approved" | "rejected";

export interface CompletionRow {
  id: string;
  user_id: string;
  trail_id: string;
  status: CompletionStatus;
  elapsed_seconds: number | null;
  completed_at: string;
  reviewer_note: string | null;
  proof_photo_url: string | null;
  profiles: { username: string } | null;
  trails: { name_en: string } | null;
}

export interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles: { username: string } | null;
  trails: { name_en: string } | null;
}

export interface ConditionRow {
  id: string;
  condition_type: string;
  severity: string;
  description: string | null;
  is_active: boolean;
  reported_at: string;
  profiles: { username: string } | null;
  trails: { name_en: string } | null;
}

export interface BookmarkRow {
  id: string;
  created_at: string;
  profiles: { username: string } | null;
  trails: { name_en: string } | null;
}

export interface PhotoRow {
  id: string;
  url: string;
  caption: string | null;
  taken_at: string;
  profiles: { username: string } | null;
  trails: { name_en: string } | null;
}

export interface CommentRow {
  id: string;
  activity_id: string;
  activity_type: string;
  comment: string;
  created_at: string;
  profiles: { username: string } | null;
}

export interface EventRow {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  created_at: string;
  organizer: { username: string } | null;
  trails: { name_en: string } | null;
  participants: { count: number }[];
}

// content_reports comes from migration 050, which may not be applied yet.
export const REPORT_STATUSES = ["open", "dismissed", "actioned"];
export const REPORTS_UNAVAILABLE =
  "Reports are not available until database migration 050 (content_reports) has been applied.";

export interface ReportRow {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reporter: { username: string } | null;
  target_name?: string | null; // the trail's name, for target_type 'trail'
}

// Trail review state and hike quality come from migrations 051 and 052.
export const REVIEW_UNAVAILABLE = "Trail review needs database migrations 051 and 052 to be applied.";
export const HIKE_QUALITY_UNAVAILABLE = "The hike quality report needs database migration 052 to be applied.";
export const REVIEW_NOTES_MAX = 2000;

export interface TrailReviewData {
  trail: {
    id: string;
    name_en: string;
    name_ka: string | null;
    region: string;
    difficulty: string;
    distance_km: number | null;
    elevation_gain_m: number | null;
    estimated_hours: number | null;
    is_published: boolean;
    reviewed_at: string | null;
    review_notes: string | null;
    review_flags: string[];
    elevation_profile: unknown;
  };
  checkpoints: Checkpoint[];
  media: TrailMedia[];
  route: RouteGeoJSON | null;
  reports: { id: string; reason: string; details: string | null; created_at: string; reporter: { username: string } | null }[];
  reportsUnavailable: boolean;
}

export interface ProductListItem {
  id: string;
  name: string;
  price: number | null;
  shop_name: string | null;
  image_url: string | null;
  is_published: boolean;
  sort_order: number;
}

export interface ProductInput {
  name: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  shop_name: string | null;
  external_url: string | null;
  is_published: boolean;
  sort_order: number;
}

export interface Product extends ProductInput {
  id: string;
}
