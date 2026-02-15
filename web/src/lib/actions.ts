"use server";

import { createAdminClient } from "./supabase";

// ── Dashboard ──
export async function getStats() {
  const supabase = createAdminClient();
  const [trails, users, completions, reviews] = await Promise.all([
    supabase.from("trails").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("trail_completions").select("*", { count: "exact", head: true }),
    supabase.from("trail_reviews").select("*", { count: "exact", head: true }),
  ]);
  return {
    trails: trails.count ?? 0,
    users: users.count ?? 0,
    completions: completions.count ?? 0,
    reviews: reviews.count ?? 0,
  };
}

// ── Trails ──
export async function getTrails() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("trails")
    .select("id, name_en, name_ka, region, difficulty, distance_km, elevation_gain_m, is_published")
    .order("name_en");
  return data ?? [];
}

export async function deleteTrail(id: string) {
  const supabase = createAdminClient();
  await supabase.from("trails").delete().eq("id", id);
}

// ── Trail Detail ──
export async function getTrailDetail(id: string) {
  const supabase = createAdminClient();
  const [{ data: trail }, { data: checkpoints }, { data: media }] = await Promise.all([
    supabase.from("trails").select("*").eq("id", id).single(),
    supabase.from("trail_checkpoints").select("*").eq("trail_id", id).order("sort_order"),
    supabase.from("trail_media").select("*").eq("trail_id", id).order("sort_order"),
  ]);
  return { trail, checkpoints: checkpoints ?? [], media: media ?? [] };
}

export async function saveTrail(id: string | null, payload: Record<string, unknown>) {
  const supabase = createAdminClient();
  if (!id) {
    const { data, error } = await supabase.from("trails").insert(payload).select().single();
    return { data, error: error?.message ?? null };
  }
  const { error } = await supabase.from("trails").update(payload).eq("id", id);
  return { data: null, error: error?.message ?? null };
}

export async function uploadTrailPhoto(id: string, formData: FormData) {
  const file = formData.get("file") as File;
  if (!file) return { error: "No file provided", record: null };

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const path = `trails/${id}/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("trail-media")
    .upload(path, arrayBuffer, { contentType: file.type });

  if (uploadError) return { error: uploadError.message, record: null };

  const { data: urlData } = supabase.storage.from("trail-media").getPublicUrl(path);

  const { data: record, error: dbError } = await supabase
    .from("trail_media")
    .insert({ trail_id: id, url: urlData.publicUrl, type: "photo", sort_order: 0 })
    .select()
    .single();

  if (dbError) return { error: dbError.message, record: null };
  return { error: null, record };
}

export async function deleteTrailMedia(mediaId: string) {
  const supabase = createAdminClient();
  await supabase.from("trail_media").delete().eq("id", mediaId);
}

// ── Users ──
export async function getUsers() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function deleteUser(id: string) {
  const supabase = createAdminClient();
  await supabase.auth.admin.deleteUser(id);
}

// ── User Detail ──
export async function getUserDetail(id: string) {
  const supabase = createAdminClient();
  const [{ data: profile }, { data: completions }, { data: badges }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    supabase
      .from("trail_completions")
      .select("id, trail_id, status, elapsed_seconds, completed_at, trails(name_en, difficulty)")
      .eq("user_id", id)
      .order("completed_at", { ascending: false }),
    supabase
      .from("user_badges")
      .select("id, earned_at, badges(name_en, icon, category)")
      .eq("user_id", id),
  ]);
  return { profile, completions: completions ?? [], badges: badges ?? [] };
}

export async function saveProfile(id: string, data: { username: string; full_name: string | null; bio: string | null; avatar_url: string | null }) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("profiles").update(data).eq("id", id);
  return { error: error?.message ?? null };
}

// ── Completions ──
export async function getCompletions() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("trail_completions")
    .select("id, user_id, trail_id, status, elapsed_seconds, completed_at, profiles(username), trails(name_en)")
    .order("completed_at", { ascending: false })
    .limit(200);
  return data ?? [];
}

export async function deleteCompletion(id: string) {
  const supabase = createAdminClient();
  await supabase.from("trail_completions").delete().eq("id", id);
}

// ── Reviews ──
export async function getReviews() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("trail_reviews")
    .select("id, rating, comment, created_at, profiles(username), trails(name_en)")
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
}

export async function deleteReview(id: string) {
  const supabase = createAdminClient();
  await supabase.from("trail_reviews").delete().eq("id", id);
}

// ── Conditions ──
export async function getConditions() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("trail_conditions")
    .select("id, condition_type, severity, description, is_active, reported_at, profiles(username), trails(name_en)")
    .order("reported_at", { ascending: false })
    .limit(200);
  return data ?? [];
}

export async function deleteCondition(id: string) {
  const supabase = createAdminClient();
  await supabase.from("trail_conditions").delete().eq("id", id);
}

export async function toggleConditionActive(id: string, current: boolean) {
  const supabase = createAdminClient();
  await supabase.from("trail_conditions").update({ is_active: !current }).eq("id", id);
}

// ── Bookmarks ──
export async function getBookmarks() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("trail_bookmarks")
    .select("id, created_at, profiles(username), trails(name_en)")
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
}

export async function deleteBookmark(id: string) {
  const supabase = createAdminClient();
  await supabase.from("trail_bookmarks").delete().eq("id", id);
}
