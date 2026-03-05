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

// ── Analytics ──
export async function getAnalyticsData() {
  const supabase = createAdminClient();

  // Completions per week (last 8 weeks)
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const { data: completionRows } = await supabase
    .from("trail_completions")
    .select("completed_at")
    .gte("completed_at", eightWeeksAgo.toISOString())
    .eq("status", "approved");

  // Group by ISO week
  const weekMap: Record<string, number> = {};
  (completionRows ?? []).forEach((row) => {
    const d = new Date(row.completed_at);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    weekMap[key] = (weekMap[key] ?? 0) + 1;
  });
  const completionsPerWeek = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week: week.slice(5), count })); // "MM-DD"

  // Top 5 trails by completions
  const { data: trailRows } = await supabase
    .from("trail_completions")
    .select("trail_id, trails:trail_id(name_en)")
    .eq("status", "approved");

  const trailMap: Record<string, { name: string; count: number }> = {};
  (trailRows ?? []).forEach((row: any) => {
    const id = row.trail_id;
    if (!trailMap[id]) trailMap[id] = { name: row.trails?.name_en ?? id, count: 0 };
    trailMap[id].count++;
  });
  const topTrails = Object.values(trailMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // User signups per month (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const { data: userRows } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", sixMonthsAgo.toISOString());

  const monthMap: Record<string, number> = {};
  (userRows ?? []).forEach((row) => {
    const key = row.created_at.slice(0, 7); // "YYYY-MM"
    monthMap[key] = (monthMap[key] ?? 0) + 1;
  });
  const signupsPerMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month: month.slice(5), count })); // "MM"

  return { completionsPerWeek, topTrails, signupsPerMonth };
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
  const [{ data: trail }, { data: checkpoints }, { data: media }, { data: routeGeojson }] = await Promise.all([
    supabase.from("trails").select("*").eq("id", id).single(),
    supabase.from("trail_checkpoints").select("*").eq("trail_id", id).order("sort_order"),
    supabase.from("trail_media").select("*").eq("trail_id", id).order("sort_order"),
    supabase.rpc("get_trail_route", { trail_uuid: id }),
  ]);
  return { trail, checkpoints: checkpoints ?? [], media: media ?? [], routeGeojson: routeGeojson ?? null };
}

export async function getTrailRoute(trailId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.rpc("get_trail_route", { trail_uuid: trailId });
  return (data as { type: string; coordinates: [number, number][] } | null) ?? null;
}

const BACKEND_URL = process.env.BACKEND_URL ?? "https://trails-en04.onrender.com/api";

export async function saveTrail(id: string | null, payload: Record<string, unknown>) {
  const supabase = createAdminClient();
  if (!id) {
    const { data, error } = await supabase.from("trails").insert(payload).select().single();
    return { data, error: error?.message ?? null };
  }
  const { error } = await supabase.from("trails").update(payload).eq("id", id);
  if (!error) {
    // Invalidate backend TTL cache so mobile sees changes immediately
    await fetch(`${BACKEND_URL}/trails/${id}/cache`, {
      method: "DELETE",
      headers: { "x-service-key": process.env.SUPABASE_SERVICE_ROLE_KEY ?? "" },
    }).catch(() => {}); // non-fatal
  }
  return { data: null, error: error?.message ?? null };
}

export async function uploadGpxRoute(trailId: string, formData: FormData) {
  const file = formData.get("file") as File;
  if (!file) return { error: "No file provided", points: 0 };

  const text = await file.text();

  // Extract trkpt elements — handle both attribute orders (lat/lon or lon/lat)
  const coords: [number, number][] = []; // [lng, lat]
  const trkptRegex = /<trkpt\b[^>]*>/g;
  const latRe = /lat="([\d.eE+-]+)"/;
  const lonRe = /lon="([\d.eE+-]+)"/;

  let m;
  while ((m = trkptRegex.exec(text)) !== null) {
    const latM = latRe.exec(m[0]);
    const lonM = lonRe.exec(m[0]);
    if (latM && lonM) {
      coords.push([parseFloat(lonM[1]), parseFloat(latM[1])]);
    }
  }

  if (coords.length < 2) {
    return { error: "No valid track points found. Make sure the file is a valid GPX with a <trkseg>.", points: 0 };
  }

  // Subsample to ≤800 points so API responses stay snappy; always keep first+last
  let sampled = coords;
  if (coords.length > 800) {
    const step = Math.ceil(coords.length / 800);
    sampled = coords.filter((_, i) => i % step === 0);
    if (sampled[sampled.length - 1] !== coords[coords.length - 1]) {
      sampled.push(coords[coords.length - 1]);
    }
  }

  const linestring = `SRID=4326;LINESTRING(${sampled.map(([lng, lat]) => `${lng} ${lat}`).join(",")})`;
  const startPt = `SRID=4326;POINT(${sampled[0][0]} ${sampled[0][1]})`;
  const endPt = `SRID=4326;POINT(${sampled[sampled.length - 1][0]} ${sampled[sampled.length - 1][1]})`;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("trails")
    .update({ route: linestring, start_point: startPt, end_point: endPt })
    .eq("id", trailId);

  if (error) return { error: error.message, points: 0 };

  // Invalidate backend cache
  await fetch(`${BACKEND_URL}/trails/${trailId}/cache`, {
    method: "DELETE",
    headers: { "x-service-key": process.env.SUPABASE_SERVICE_ROLE_KEY ?? "" },
  }).catch(() => {});

  return { error: null, points: sampled.length, originalPoints: coords.length };
}

export async function uploadCoverImage(id: string, formData: FormData) {
  const file = formData.get("file") as File;
  if (!file) return { error: "No file provided", url: null };

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const path = `covers/${id}/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("trail-media")
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true });

  if (uploadError) return { error: uploadError.message, url: null };

  const { data: urlData } = supabase.storage.from("trail-media").getPublicUrl(path);
  return { error: null, url: urlData.publicUrl };
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

// ── Shop Products ──
export async function getProducts() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, description, image_url, price, shop_name, external_url, is_published, sort_order")
    .order("sort_order")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getProductDetail(id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("products").select("*").eq("id", id).single();
  return data;
}

export async function saveProduct(id: string | null, payload: Record<string, unknown>) {
  const supabase = createAdminClient();
  if (!id) {
    const { data, error } = await supabase.from("products").insert(payload).select().single();
    return { data, error: error?.message ?? null };
  }
  const { error } = await supabase.from("products").update(payload).eq("id", id);
  return { data: null, error: error?.message ?? null };
}

export async function deleteProduct(id: string) {
  const supabase = createAdminClient();
  await supabase.from("products").delete().eq("id", id);
}
