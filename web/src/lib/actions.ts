"use server";

import { requireAdmin } from "./auth";
import { createAdminClient, getServiceRoleKey, getSupabaseUrl } from "./supabase";
import { ilikeAny } from "./postgrest";
import {
  IMAGE_TYPE_ERROR,
  parseGpxTrack,
  sniffImage,
  storageObjectPath,
  subsample,
  uploadSizeError,
  type ImageKind,
} from "./uploads";
import { buildReviewQueue, REVIEW_FILTERS, type QueueTrail, type ReviewFilter, type ReviewQueuePage } from "./trail-review";
import { normalizeQualityRow, type HikeQualityRow } from "./hike-quality";
import { GEAR_NOTES_MAX, normalizeGearTags } from "./gear";
import {
  CHECKPOINT_TYPES,
  DIFFICULTIES,
  HIKE_QUALITY_UNAVAILABLE,
  PAGE_SIZE,
  REPORT_STATUSES,
  REPORTS_UNAVAILABLE,
  REVIEW_NOTES_MAX,
  REVIEW_UNAVAILABLE,
  TRAIL_STATUSES,
  type AnalyticsData,
  type BookmarkRow,
  type Checkpoint,
  type CheckpointInput,
  type CommentRow,
  type CompletionRow,
  type ConditionRow,
  type EventRow,
  type Failure,
  type Mutation,
  type Paged,
  type PhotoRow,
  type Product,
  type ProductInput,
  type ProductListItem,
  type ProfileInput,
  type ReportRow,
  type Result,
  type ReviewRow,
  type RouteGeoJSON,
  type Stats,
  type Trail,
  type TrailInput,
  type TrailListItem,
  type TrailMedia,
  type TrailReviewData,
  type UserBadge,
  type UserCompletion,
  type UserListItem,
} from "./types";

type Supabase = ReturnType<typeof createAdminClient>;
type DbError = { message?: string; code?: string } | null;
type PageResponse = { data: unknown[] | null; error: DbError; count: number | null };

const BACKEND_URL = process.env.BACKEND_URL || "https://trails-en04.onrender.com/api";
const CACHE_BUST_TIMEOUT_MS = 4000;
const TRAIL_MEDIA_BUCKET = "trail-media";
const COMPLETION_STATUSES = ["pending", "approved", "rejected"];
const UUID_RE = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const FETCH_ALL_PAGE = 1000;
const FETCH_ALL_LIMIT = 200_000;

// ── Helpers ──
function fail(error: DbError | string, fallback = "The request failed."): Failure {
  if (typeof error === "string") return { error };
  return { error: error?.message || fallback };
}

const done: Mutation = { error: null, warning: null };

// Every exported action runs its body through this: it checks the admin credentials first and
// only then creates the service-role client. Anything unexpected (missing configuration, a bug)
// is returned as an error the page can show, because production builds replace the message of
// a thrown error with a generic one.
async function asAdmin<T>(body: (supabase: Supabase) => Promise<Result<T>>): Promise<Result<T>> {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return await body(createAdminClient());
  } catch (err) {
    console.error("Admin action failed:", err);
    return fail(err instanceof Error ? err.message : "", "Unexpected server error.");
  }
}

function pageBounds(page: unknown): [number, number] {
  const n = typeof page === "number" && Number.isInteger(page) && page > 0 ? page : 1;
  return [(n - 1) * PAGE_SIZE, n * PAGE_SIZE - 1];
}

function paged<T>(res: PageResponse): Paged<T> {
  if (res.error) {
    // PostgREST's answer when the page starts beyond the last row: an empty page, not a failure.
    if (res.error.code === "PGRST103") return { error: null, data: [], total: 0 };
    return fail(res.error);
  }
  return { error: null, data: (res.data ?? []) as T[], total: res.count ?? 0 };
}

// Reads every row of a query. PostgREST caps a response at its max-rows setting (1000 by
// default), so one request would silently drop the rest; `page` must ask for an exact count.
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<PageResponse>,
): Promise<{ rows: T[]; error: string | null; code?: string }> {
  const rows: T[] = [];
  while (rows.length < FETCH_ALL_LIMIT) {
    const { data, error, count } = await page(rows.length, rows.length + FETCH_ALL_PAGE - 1);
    if (error) return { rows, error: fail(error).error, code: error.code };
    if (!data?.length) return { rows, error: null };
    rows.push(...(data as T[]));
    if (count !== null && rows.length >= count) return { rows, error: null };
  }
  return { rows, error: `More than ${FETCH_ALL_LIMIT} rows; the result would be incomplete.` };
}

// Tells the API to drop its cached copy of a trail (DELETE /trails/:id/cache). Best effort:
// the change itself is already saved, so a failure is logged and never fails the action.
async function bustTrailCache(trailId: unknown): Promise<void> {
  if (typeof trailId !== "string" || !UUID_RE.test(trailId)) return;

  const internalKey = process.env.INTERNAL_API_KEY;
  const headers: Record<string, string> = internalKey
    ? { "x-internal-key": internalKey }
    : { "x-service-key": getServiceRoleKey() ?? "" }; // accepted by API versions without INTERNAL_API_KEY

  try {
    const res = await fetch(`${BACKEND_URL.replace(/\/+$/, "")}/trails/${trailId}/cache`, {
      method: "DELETE",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(CACHE_BUST_TIMEOUT_MS),
    });
    if (!res.ok) console.warn(`Trail cache invalidation failed: HTTP ${res.status}`);
  } catch (err) {
    console.warn("Trail cache invalidation failed:", err instanceof Error ? err.message : err);
  }
}

async function nextSortOrder(
  supabase: Supabase,
  table: "trail_checkpoints" | "trail_media",
  trailId: string,
): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select("sort_order")
    .eq("trail_id", trailId)
    .order("sort_order", { ascending: false, nullsFirst: false })
    .limit(1);
  const last = data?.[0]?.sort_order;
  return typeof last === "number" ? last + 1 : 0;
}

function uploadedFile(formData: FormData): File | null {
  const value = formData.get("file");
  return typeof value === "object" && value !== null && typeof value.arrayBuffer === "function" ? value : null;
}

async function readImage(formData: FormData): Promise<{ bytes: Uint8Array; kind: ImageKind } | Failure> {
  const file = uploadedFile(formData);
  if (!file) return fail("No file provided.");
  const sizeError = uploadSizeError(file.size);
  if (sizeError) return fail(sizeError);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  return kind ? { bytes, kind } : fail(IMAGE_TYPE_ERROR);
}

// Deletes the file behind a public trail-media URL. Returns a warning when it has to stay.
async function removeStoredFile(supabase: Supabase, url: string): Promise<string | null> {
  const path = storageObjectPath(url, getSupabaseUrl(), TRAIL_MEDIA_BUCKET);
  if (!path) return null;

  // A photo's URL can also have been pasted in as a trail's cover image.
  const { count, error: coverError } = await supabase
    .from("trails")
    .select("id", { count: "exact", head: true })
    .eq("cover_image_url", url);
  if (coverError) return "The file was kept in storage because checking whether it is still in use failed.";
  if (count) return null;

  const { error } = await supabase.storage.from(TRAIL_MEDIA_BUCKET).remove([path]);
  return error ? `The file could not be deleted from storage: ${error.message}` : null;
}

async function recountCompletions(supabase: Supabase, userId: string): Promise<string | null> {
  const { count, error } = await supabase
    .from("trail_completions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "approved");
  if (error || count === null) return fail(error).error;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ total_trails_completed: count })
    .eq("id", userId);
  return updateError ? fail(updateError).error : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

// ── Dashboard ──
export async function getStats(): Promise<Result<{ stats: Stats }>> {
  return asAdmin(async (supabase) => {
    const [trails, users, completions, reviews] = await Promise.all([
      supabase.from("trails").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("trail_completions").select("*", { count: "exact", head: true }),
      supabase.from("trail_reviews").select("*", { count: "exact", head: true }),
    ]);
    const failed = [trails, users, completions, reviews].find((res) => res.error || res.count === null);
    if (failed) return fail(failed.error, "The totals could not be loaded.");

    return {
      error: null,
      stats: {
        trails: trails.count ?? 0,
        users: users.count ?? 0,
        completions: completions.count ?? 0,
        reviews: reviews.count ?? 0,
      },
    };
  });
}

// ── Analytics ──
export async function getAnalyticsData(): Promise<Result<{ analytics: AnalyticsData }>> {
  return asAdmin(async (supabase) => {
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setUTCDate(eightWeeksAgo.getUTCDate() - 56);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6);

    const [recent, approved, signups] = await Promise.all([
      // Completions per week (last 8 weeks)
      fetchAll<{ completed_at: string }>((from, to) =>
        supabase
          .from("trail_completions")
          .select("completed_at", { count: "exact" })
          .gte("completed_at", eightWeeksAgo.toISOString())
          .eq("status", "approved")
          .order("id")
          .range(from, to),
      ),
      // Top 5 trails by completions
      fetchAll<{ trail_id: string }>((from, to) =>
        supabase
          .from("trail_completions")
          .select("trail_id", { count: "exact" })
          .eq("status", "approved")
          .order("id")
          .range(from, to),
      ),
      // User signups per month (last 6 months)
      fetchAll<{ created_at: string }>((from, to) =>
        supabase
          .from("profiles")
          .select("created_at", { count: "exact" })
          .gte("created_at", sixMonthsAgo.toISOString())
          .order("id")
          .range(from, to),
      ),
    ]);
    const failed = recent.error ?? approved.error ?? signups.error;
    if (failed) return fail(failed);

    // Group by the Monday that starts each week
    const weekMap: Record<string, number> = {};
    recent.rows.forEach((row) => {
      const monday = new Date(row.completed_at);
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      weekMap[key] = (weekMap[key] ?? 0) + 1;
    });
    const completionsPerWeek = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, count]) => ({ week: week.slice(5), count })); // "MM-DD"

    const trailCounts: Record<string, number> = {};
    approved.rows.forEach((row) => {
      trailCounts[row.trail_id] = (trailCounts[row.trail_id] ?? 0) + 1;
    });
    const top = Object.entries(trailCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    const names: Record<string, string> = {};
    if (top.length > 0) {
      const { data, error } = await supabase
        .from("trails")
        .select("id, name_en")
        .in("id", top.map(([id]) => id));
      if (error) return fail(error);
      (data ?? []).forEach((trail) => {
        names[trail.id] = trail.name_en;
      });
    }
    const topTrails = top.map(([id, count]) => ({ name: names[id] ?? id, count }));

    const monthMap: Record<string, number> = {};
    signups.rows.forEach((row) => {
      const key = row.created_at.slice(0, 7); // "YYYY-MM"
      monthMap[key] = (monthMap[key] ?? 0) + 1;
    });
    const signupsPerMonth = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month: month.slice(5), count })); // "MM"

    return { error: null, analytics: { completionsPerWeek, topTrails, signupsPerMonth } };
  });
}

// ── Trails ──
export async function getTrails(): Promise<Result<{ data: TrailListItem[] }>> {
  return asAdmin(async (supabase) => {
    const { rows, error } = await fetchAll<TrailListItem>((from, to) =>
      supabase
        .from("trails")
        .select("id, name_en, name_ka, region, difficulty, distance_km, elevation_gain_m, is_published", {
          count: "exact",
        })
        .order("name_en")
        .order("id")
        .range(from, to),
    );
    return error ? fail(error) : { error: null, data: rows };
  });
}

export async function deleteTrail(id: string): Promise<Mutation> {
  return asAdmin(async (supabase) => {
    const { error } = await supabase.from("trails").delete().eq("id", id);
    if (error) return fail(error);
    await bustTrailCache(id);
    return done;
  });
}

// ── Trail Detail ──
export async function getTrailDetail(id: string): Promise<
  Result<{
    trail: Trail | null;
    checkpoints: Checkpoint[];
    media: TrailMedia[];
    routeGeojson: RouteGeoJSON | null;
  }>
> {
  return asAdmin(async (supabase) => {
    const [trail, checkpoints, media, route] = await Promise.all([
      supabase
        .from("trails")
        .select(
          "id, name_en, name_ka, description_en, description_ka, region, difficulty, distance_km, elevation_gain_m, estimated_hours, cover_image_url, is_published, status, status_note, gear_notes, terrain",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("trail_checkpoints")
        .select("id, name_en, name_ka, type, elevation_m, is_checkable, sort_order, coordinates")
        .eq("trail_id", id)
        .order("sort_order"),
      supabase
        .from("trail_media")
        .select("id, url, caption, type")
        .eq("trail_id", id)
        .order("sort_order")
        .order("created_at"),
      supabase.rpc("get_trail_route", { trail_uuid: id }),
    ]);
    const failed = trail.error ?? checkpoints.error ?? media.error ?? route.error;
    if (failed) return fail(failed);

    return {
      error: null,
      trail: (trail.data as Trail | null) ?? null,
      checkpoints: (checkpoints.data ?? []) as Checkpoint[],
      media: (media.data ?? []) as TrailMedia[],
      routeGeojson: (route.data as RouteGeoJSON | null) ?? null,
    };
  });
}

export async function getTrailRoute(trailId: string): Promise<Result<{ route: RouteGeoJSON | null }>> {
  return asAdmin(async (supabase) => {
    const { data, error } = await supabase.rpc("get_trail_route", { trail_uuid: trailId });
    if (error) return fail(error);
    return { error: null, route: (data as RouteGeoJSON | null) ?? null };
  });
}

export async function saveTrail(id: string | null, input: TrailInput): Promise<Result<{ id: string }>> {
  return asAdmin(async (supabase) => {
    const name = typeof input?.name_en === "string" ? input.name_en.trim() : "";
    const region = typeof input?.region === "string" ? input.region.trim() : "";
    const distance = optionalNumber(input?.distance_km);
    const elevation = optionalNumber(input?.elevation_gain_m);
    const hours = optionalNumber(input?.estimated_hours);
    if (!name) return fail("The English name is required.");
    if (!region) return fail("The region is required.");
    if (!DIFFICULTIES.includes(input.difficulty)) return fail("Choose a difficulty.");
    if (!TRAIL_STATUSES.includes(input.status)) return fail("Unknown trail status.");
    if (distance === undefined || elevation === undefined || hours === undefined) {
      return fail("Distance, elevation gain and estimated hours must be numbers of zero or more.");
    }
    const gearNotes = typeof input.gear_notes === "string" ? input.gear_notes.trim() : null;
    if (gearNotes && gearNotes.length > GEAR_NOTES_MAX) {
      return fail(`Gear notes can be at most ${GEAR_NOTES_MAX} characters.`);
    }

    const row = {
      ...("gear_notes" in input ? { gear_notes: gearNotes || null } : {}),
      name_en: name,
      name_ka: optionalText(input.name_ka),
      description_en: optionalText(input.description_en),
      description_ka: optionalText(input.description_ka),
      region,
      difficulty: input.difficulty,
      distance_km: distance,
      elevation_gain_m: elevation,
      estimated_hours: hours,
      cover_image_url: optionalText(input.cover_image_url),
      is_published: input.is_published === true,
      status: input.status,
      status_note: optionalText(input.status_note),
    };

    const { data, error } = id
      ? await supabase.from("trails").update(row).eq("id", id).select("id")
      : await supabase.from("trails").insert(row).select("id");
    if (error) return fail(error);
    const savedId = data?.[0]?.id as string | undefined;
    if (!savedId) return fail("Trail not found. It may have been deleted.");

    // Invalidate backend TTL cache so mobile sees changes immediately
    await bustTrailCache(savedId);
    return { error: null, id: savedId };
  });
}

export async function uploadGpxRoute(
  trailId: string,
  formData: FormData,
): Promise<Result<{ points: number; originalPoints: number }>> {
  return asAdmin(async (supabase) => {
    if (!UUID_RE.test(trailId)) return fail("Save the trail before uploading a route.");
    const file = uploadedFile(formData);
    if (!file) return fail("No file provided.");
    const sizeError = uploadSizeError(file.size);
    if (sizeError) return fail(sizeError);

    const parsed = parseGpxTrack(await file.text());
    if (!parsed.ok) return fail(parsed.error);

    // Subsample to ≤800 points so API responses stay snappy; always keep first+last
    const sampled = subsample(parsed.coords, 800);
    const first = sampled[0];
    const last = sampled[sampled.length - 1];

    const { data, error } = await supabase
      .from("trails")
      .update({
        route: `SRID=4326;LINESTRING(${sampled.map(([lng, lat]) => `${lng} ${lat}`).join(",")})`,
        start_point: `SRID=4326;POINT(${first[0]} ${first[1]})`,
        end_point: `SRID=4326;POINT(${last[0]} ${last[1]})`,
      })
      .eq("id", trailId)
      .select("id");
    if (error) return fail(error);
    if (!data?.length) return fail("Trail not found. The route was not saved.");

    await bustTrailCache(trailId);
    return { error: null, points: sampled.length, originalPoints: parsed.coords.length };
  });
}

// Uploads the file only; the trail row changes when the editor is saved (which also busts the cache).
export async function uploadCoverImage(id: string, formData: FormData): Promise<Result<{ url: string }>> {
  return asAdmin(async (supabase) => {
    if (id !== "new" && !UUID_RE.test(id)) return fail("Unknown trail.");
    const image = await readImage(formData);
    if ("error" in image) return image;

    const bucket = supabase.storage.from(TRAIL_MEDIA_BUCKET);
    const path = `covers/${id}/${crypto.randomUUID()}.${image.kind.ext}`;
    const { error } = await bucket.upload(path, image.bytes, { contentType: image.kind.contentType });
    if (error) return fail(error);

    return { error: null, url: bucket.getPublicUrl(path).data.publicUrl };
  });
}

export async function uploadTrailPhoto(id: string, formData: FormData): Promise<Result<{ record: TrailMedia }>> {
  return asAdmin(async (supabase) => {
    if (!UUID_RE.test(id)) return fail("Save the trail before uploading photos.");
    const image = await readImage(formData);
    if ("error" in image) return image;

    const { data: trail, error: trailError } = await supabase.from("trails").select("id").eq("id", id).maybeSingle();
    if (trailError) return fail(trailError);
    if (!trail) return fail("Trail not found. The photo was not uploaded.");

    const bucket = supabase.storage.from(TRAIL_MEDIA_BUCKET);
    const path = `trails/${id}/${crypto.randomUUID()}.${image.kind.ext}`;
    const { error: uploadError } = await bucket.upload(path, image.bytes, { contentType: image.kind.contentType });
    if (uploadError) return fail(uploadError);

    const { data, error } = await supabase
      .from("trail_media")
      .insert({
        trail_id: id,
        url: bucket.getPublicUrl(path).data.publicUrl,
        type: "photo",
        sort_order: await nextSortOrder(supabase, "trail_media", id),
      })
      .select("id, url, caption, type");
    if (error || !data?.[0]) {
      await bucket.remove([path]); // don't leave an unreferenced public file behind
      return fail(error, "The photo could not be saved.");
    }

    await bustTrailCache(id);
    return { error: null, record: data[0] as TrailMedia };
  });
}

export async function deleteTrailMedia(mediaId: string): Promise<Mutation> {
  return asAdmin(async (supabase) => {
    const { data, error } = await supabase.from("trail_media").delete().eq("id", mediaId).select("trail_id, url");
    if (error) return fail(error);
    const media = data?.[0] as { trail_id: string; url: string } | undefined;
    if (!media) return done;

    const warning = await removeStoredFile(supabase, media.url);
    await bustTrailCache(media.trail_id);
    return { error: null, warning };
  });
}

// ── Checkpoints ──
export async function deleteCheckpoint(id: string): Promise<Mutation> {
  return asAdmin(async (supabase) => {
    const { data, error } = await supabase.from("trail_checkpoints").delete().eq("id", id).select("trail_id");
    if (error) return fail(error);
    await bustTrailCache(data?.[0]?.trail_id);
    return done;
  });
}

export async function addCheckpoint(
  trailId: string,
  payload: CheckpointInput,
): Promise<Result<{ record: Checkpoint }>> {
  return asAdmin(async (supabase) => {
    const name = typeof payload?.name_en === "string" ? payload.name_en.trim() : "";
    if (!name) return fail("Name (EN) is required.");
    if (!CHECKPOINT_TYPES.includes(payload.type)) return fail("Unknown checkpoint type.");
    const { lat, lng } = payload;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return fail("Latitude must be between -90 and 90 and longitude between -180 and 180.");
    }

    const { data, error } = await supabase
      .from("trail_checkpoints")
      .insert({
        trail_id: trailId,
        name_en: name,
        name_ka: optionalText(payload.name_ka),
        type: payload.type,
        coordinates: `SRID=4326;POINT(${lng} ${lat})`,
        elevation_m: Number.isFinite(payload.elevation_m) ? payload.elevation_m : null,
        is_checkable: payload.is_checkable === true,
        sort_order: await nextSortOrder(supabase, "trail_checkpoints", trailId),
      })
      .select("id, name_en, name_ka, type, elevation_m, is_checkable, sort_order, coordinates");
    if (error || !data?.[0]) return fail(error, "The checkpoint could not be saved.");

    await bustTrailCache(trailId);
    return { error: null, record: data[0] as Checkpoint };
  });
}

// ── Users ──
export async function getUsers(params: { page: number; search?: string }): Promise<Paged<UserListItem>> {
  return asAdmin(async (supabase) => {
    const [from, to] = pageBounds(params?.page);
    const search = typeof params?.search === "string" ? params.search.trim().slice(0, 100) : "";

    let query = supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, bio, total_trails_completed, created_at", { count: "exact" });
    if (search) query = query.or(ilikeAny(["username", "full_name"], search));

    return paged<UserListItem>(await query.order("created_at", { ascending: false }).order("id").range(from, to));
  });
}

export async function deleteUser(id: string): Promise<Mutation> {
  return asAdmin(async (supabase) => {
    // Note the user's files first: deleting the auth user cascades away the rows that point at them.
    const [photos, completions, profile] = await Promise.all([
      supabase.from("trail_photos").select("url").eq("user_id", id),
      supabase.from("trail_completions").select("proof_photo_url").eq("user_id", id).not("proof_photo_url", "is", null),
      supabase.from("profiles").select("avatar_url").eq("id", id).maybeSingle(),
    ]);
    const failed = photos.error ?? completions.error ?? profile.error;
    if (failed) return fail(failed);

    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) return fail(error);

    // The buckets are public, so leftover files would stay reachable by URL.
    const base = getSupabaseUrl();
    const paths = (urls: (string | null | undefined)[], bucket: string) =>
      urls.map((url) => (url ? storageObjectPath(url, base, bucket) : null)).filter((p): p is string => p !== null);
    const mediaPaths = paths((photos.data ?? []).map((p) => p.url), TRAIL_MEDIA_BUCKET);
    const proofPaths = paths(
      [...(completions.data ?? []).map((c) => c.proof_photo_url), profile.data?.avatar_url],
      "proof-photos",
    );
    const removals = await Promise.all([
      mediaPaths.length ? supabase.storage.from(TRAIL_MEDIA_BUCKET).remove(mediaPaths) : null,
      proofPaths.length ? supabase.storage.from("proof-photos").remove(proofPaths) : null,
    ]);
    const storageError = removals.find((r) => r?.error)?.error;
    return {
      error: null,
      warning: storageError
        ? `The user was deleted, but some of their files could not be removed from storage: ${storageError.message}`
        : null,
    };
  });
}

// ── User Detail ──
export async function getUserDetail(id: string): Promise<
  Result<{
    profile: UserListItem | null;
    completions: UserCompletion[];
    badges: UserBadge[];
  }>
> {
  return asAdmin(async (supabase) => {
    const [profile, completions, badges] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, bio, total_trails_completed, created_at")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("trail_completions")
        .select("id, trail_id, status, elapsed_seconds, completed_at, trails:trail_id(name_en, difficulty)")
        .eq("user_id", id)
        .order("completed_at", { ascending: false }),
      supabase
        .from("user_badges")
        .select("id, earned_at, badges:badge_id(name_en, icon, category)")
        .eq("user_id", id),
    ]);
    const failed = profile.error ?? completions.error ?? badges.error;
    if (failed) return fail(failed);

    return {
      error: null,
      profile: (profile.data as UserListItem | null) ?? null,
      completions: (completions.data ?? []) as unknown as UserCompletion[],
      badges: (badges.data ?? []) as unknown as UserBadge[],
    };
  });
}

export async function saveProfile(id: string, data: ProfileInput): Promise<Result> {
  return asAdmin(async (supabase) => {
    const username = typeof data?.username === "string" ? data.username.trim() : "";
    if (!username) return fail("The username cannot be empty.");

    const { data: rows, error } = await supabase
      .from("profiles")
      .update({
        username,
        full_name: optionalText(data.full_name),
        bio: optionalText(data.bio),
        avatar_url: optionalText(data.avatar_url),
      })
      .eq("id", id)
      .select("id");
    if (error) return fail(error.code === "23505" ? "That username is already taken." : error);
    if (!rows?.length) return fail("User not found.");
    return { error: null };
  });
}

// ── Completions ──
export async function getCompletions(params: { page: number; status?: string }): Promise<Paged<CompletionRow>> {
  return asAdmin(async (supabase) => {
    const [from, to] = pageBounds(params?.page);

    let query = supabase
      .from("trail_completions")
      .select(
        "id, user_id, trail_id, status, elapsed_seconds, completed_at, reviewer_note, proof_photo_url, profiles:user_id(username), trails:trail_id(name_en)",
        { count: "exact" },
      );
    if (params?.status && COMPLETION_STATUSES.includes(params.status)) {
      query = query.eq("status", params.status);
    }

    return paged<CompletionRow>(await query.order("completed_at", { ascending: false }).order("id").range(from, to));
  });
}

export async function reviewCompletion(id: string, status: "approved" | "rejected"): Promise<Mutation> {
  return asAdmin(async (supabase) => {
    if (status !== "approved" && status !== "rejected") return fail("Unknown status.");

    const { data, error } = await supabase
      .from("trail_completions")
      .update({ status })
      .eq("id", id)
      .eq("status", "pending")
      .select("user_id");
    if (error) return fail(error);
    const userId = data?.[0]?.user_id as string | undefined;
    if (!userId) return fail("This completion is no longer pending. Reload the list.");
    if (status === "rejected") return done;

    // An approved completion counts towards the user's total and can unlock badges.
    let syncError = await recountCompletions(supabase, userId);
    if (!syncError) {
      const { error: badgeError } = await supabase.rpc("check_and_award_badges", { p_user_id: userId });
      if (badgeError) syncError = fail(badgeError).error;
    }
    if (!syncError) return done;

    // Undo the approval so it can be retried, rather than leave it approved without its effects.
    const { error: revertError } = await supabase
      .from("trail_completions")
      .update({ status: "pending" })
      .eq("id", id);
    if (revertError) {
      return {
        error: null,
        warning: `Approved, but updating the user's trail count and badges failed: ${syncError}`,
      };
    }
    await recountCompletions(supabase, userId);
    return fail(`Not approved: updating the user's trail count and badges failed (${syncError}). Try again.`);
  });
}

export async function deleteCompletion(id: string): Promise<Mutation> {
  return asAdmin(async (supabase) => {
    const { data, error } = await supabase.from("trail_completions").delete().eq("id", id).select("user_id");
    if (error) return fail(error);
    const userId = data?.[0]?.user_id as string | undefined;
    if (!userId) return done;

    const recountError = await recountCompletions(supabase, userId);
    return {
      error: null,
      warning: recountError ? `Deleted, but the user's trail count could not be updated: ${recountError}` : null,
    };
  });
}

// ── Reviews ──
export async function getReviews(params: { page: number }): Promise<Paged<ReviewRow>> {
  return asAdmin(async (supabase) => {
    const [from, to] = pageBounds(params?.page);
    return paged<ReviewRow>(
      await supabase
        .from("trail_reviews")
        .select("id, rating, comment, created_at, profiles:user_id(username), trails:trail_id(name_en)", {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
  });
}

export async function deleteReview(id: string): Promise<Mutation> {
  return asAdmin(async (supabase) => {
    const { data, error } = await supabase.from("trail_reviews").delete().eq("id", id).select("trail_id");
    if (error) return fail(error);
    await bustTrailCache(data?.[0]?.trail_id); // the cached trail carries its rating
    return done;
  });
}

// ── Conditions ──
export async function getConditions(params: { page: number }): Promise<Paged<ConditionRow>> {
  return asAdmin(async (supabase) => {
    const [from, to] = pageBounds(params?.page);
    return paged<ConditionRow>(
      await supabase
        .from("trail_conditions")
        .select(
          "id, condition_type, severity, description, is_active, reported_at, profiles:user_id(username), trails:trail_id(name_en)",
          { count: "exact" },
        )
        .order("reported_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
  });
}

export async function deleteCondition(id: string): Promise<Mutation> {
  return asAdmin(async (supabase) => {
    const { data, error } = await supabase.from("trail_conditions").delete().eq("id", id).select("trail_id");
    if (error) return fail(error);
    await bustTrailCache(data?.[0]?.trail_id); // the cached trail carries its recent conditions
    return done;
  });
}

export async function toggleConditionActive(id: string, current: boolean): Promise<Mutation> {
  return asAdmin(async (supabase) => {
    const { data, error } = await supabase
      .from("trail_conditions")
      .update({ is_active: !current })
      .eq("id", id)
      .select("trail_id");
    if (error) return fail(error);
    if (!data?.length) return fail("Condition report not found. It may have been deleted.");
    await bustTrailCache(data[0].trail_id);
    return done;
  });
}

// ── Bookmarks ──
export async function getBookmarks(params: { page: number }): Promise<Paged<BookmarkRow>> {
  return asAdmin(async (supabase) => {
    const [from, to] = pageBounds(params?.page);
    return paged<BookmarkRow>(
      await supabase
        .from("trail_bookmarks")
        .select("id, created_at, profiles:user_id(username), trails:trail_id(name_en)", { count: "exact" })
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
  });
}

export async function deleteBookmark(id: string): Promise<Mutation> {
  return asAdmin(async (supabase) => {
    const { error } = await supabase.from("trail_bookmarks").delete().eq("id", id);
    return error ? fail(error) : done;
  });
}

// ── Moderation ──
export async function getCommunityPhotos(params: { page: number }): Promise<Paged<PhotoRow>> {
  return asAdmin(async (supabase) => {
    const [from, to] = pageBounds(params?.page);
    return paged<PhotoRow>(
      await supabase
        .from("trail_photos")
        .select("id, url, caption, taken_at, profiles:user_id(username), trails:trail_id(name_en)", {
          count: "exact",
        })
        .order("taken_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
  });
}

export async function deleteCommunityPhoto(id: string): Promise<Mutation> {
  return asAdmin(async (supabase) => {
    const { data, error } = await supabase.from("trail_photos").delete().eq("id", id).select("trail_id, url");
    if (error) return fail(error);
    const photo = data?.[0] as { trail_id: string; url: string } | undefined;
    if (!photo) return done;

    const warning = await removeStoredFile(supabase, photo.url);
    await bustTrailCache(photo.trail_id); // the cached trail carries its photo count
    return { error: null, warning };
  });
}

export async function getComments(params: { page: number }): Promise<Paged<CommentRow>> {
  return asAdmin(async (supabase) => {
    const [from, to] = pageBounds(params?.page);
    return paged<CommentRow>(
      await supabase
        .from("activity_comments")
        .select("id, activity_id, activity_type, comment, created_at, profiles:user_id(username)", { count: "exact" })
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
  });
}

export async function deleteComment(id: string): Promise<Mutation> {
  return asAdmin(async (supabase) => {
    const { error } = await supabase.from("activity_comments").delete().eq("id", id);
    return error ? fail(error) : done;
  });
}

export async function getEvents(params: { page: number }): Promise<Paged<EventRow>> {
  return asAdmin(async (supabase) => {
    const [from, to] = pageBounds(params?.page);
    return paged<EventRow>(
      await supabase
        .from("events")
        .select(
          "id, title, description, scheduled_at, created_at, organizer:organizer_id(username), trails:trail_id(name_en), participants:event_participants(count)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
  });
}

export async function deleteEvent(id: string): Promise<Mutation> {
  return asAdmin(async (supabase) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    return error ? fail(error) : done;
  });
}

// PostgREST reports an unknown table as PGRST205; Postgres itself as 42P01.
function isMissingTable(error: DbError): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

// Unknown column: 42703 when selecting it, PGRST204 when writing it.
function isMissingColumn(code: string | undefined): boolean {
  return code === "42703" || code === "PGRST204";
}

export async function getReports(params: { page: number; status?: string }): Promise<Paged<ReportRow>> {
  return asAdmin(async (supabase) => {
    const [from, to] = pageBounds(params?.page);

    let query = supabase
      .from("content_reports")
      .select("id, target_type, target_id, reason, details, status, created_at, reporter:reporter_id(username)", {
        count: "exact",
      });
    if (params?.status && REPORT_STATUSES.includes(params.status)) {
      query = query.eq("status", params.status);
    }

    const res = await query.order("created_at", { ascending: false }).order("id").range(from, to);
    if (isMissingTable(res.error)) return fail(REPORTS_UNAVAILABLE);
    const page = paged<ReportRow>(res);
    if (page.error !== null) return page;

    // Name the reported trails so the list can show and link them.
    const trailIds = [...new Set(page.data.filter((r) => r.target_type === "trail" && UUID_RE.test(r.target_id)).map((r) => r.target_id))];
    if (trailIds.length > 0) {
      const { data: trails, error } = await supabase.from("trails").select("id, name_en").in("id", trailIds);
      if (error) return fail(error);
      const names = new Map((trails ?? []).map((t) => [t.id as string, t.name_en as string]));
      page.data.forEach((r) => {
        if (r.target_type === "trail") r.target_name = names.get(r.target_id) ?? null;
      });
    }
    return page;
  });
}

export async function setReportStatus(id: string, status: "dismissed" | "actioned"): Promise<Mutation> {
  return asAdmin(async (supabase) => {
    if (status !== "dismissed" && status !== "actioned") return fail("Unknown status.");

    const { data, error } = await supabase.from("content_reports").update({ status }).eq("id", id).select("id");
    if (isMissingTable(error)) return fail(REPORTS_UNAVAILABLE);
    if (error) return fail(error);
    if (!data?.length) return fail("Report not found.");
    return done;
  });
}

// ── Trail review ──
export async function getReviewQueue(params: {
  page: number;
  filter?: string;
  region?: string;
}): Promise<Result<ReviewQueuePage>> {
  return asAdmin(async (supabase) => {
    // The catalogue is a few hundred trails, and the queue sorts by the number of flags, which
    // PostgREST cannot order by: read them all and sort, filter and page here.
    const { rows, error, code } = await fetchAll<Record<string, unknown>>((from, to) =>
      supabase
        .from("trails")
        .select(
          "id, name_en, name_ka, region, difficulty, distance_km, elevation_gain_m, estimated_hours, is_published, reviewed_at, review_flags, trail_media(count)",
          { count: "exact" },
        )
        .order("id")
        .range(from, to),
    );
    if (error) return fail(isMissingColumn(code) ? REVIEW_UNAVAILABLE : error);

    const trails: QueueTrail[] = rows.map((row) => ({
      ...(row as unknown as QueueTrail),
      review_flags: Array.isArray(row.review_flags) ? (row.review_flags as string[]) : [],
      photos: (row.trail_media as { count: number }[] | null)?.[0]?.count ?? 0,
    }));
    const filter = REVIEW_FILTERS.includes(params?.filter as ReviewFilter) ? (params.filter as ReviewFilter) : "unreviewed";
    const region = typeof params?.region === "string" ? params.region : "";
    return {
      error: null,
      ...buildReviewQueue(trails, { filter, region, page: params?.page ?? 1, pageSize: PAGE_SIZE }),
    };
  });
}

export async function getTrailReview(id: string): Promise<Result<{ review: TrailReviewData | null }>> {
  return asAdmin(async (supabase) => {
    const [trail, checkpoints, media, route, reports] = await Promise.all([
      supabase
        .from("trails")
        .select(
          "id, name_en, name_ka, region, difficulty, distance_km, elevation_gain_m, estimated_hours, is_published, reviewed_at, review_notes, review_flags, elevation_profile",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("trail_checkpoints")
        .select("id, name_en, name_ka, type, elevation_m, is_checkable, sort_order, coordinates")
        .eq("trail_id", id)
        .order("sort_order"),
      supabase.from("trail_media").select("id, url, caption, type").eq("trail_id", id).order("sort_order").order("created_at"),
      supabase.rpc("get_trail_route", { trail_uuid: id }),
      supabase
        .from("content_reports")
        .select("id, reason, details, created_at, reporter:reporter_id(username)")
        .eq("target_type", "trail")
        .eq("target_id", id)
        .eq("status", "open")
        .order("created_at", { ascending: false }),
    ]);
    if (trail.error) return fail(isMissingColumn(trail.error.code) ? REVIEW_UNAVAILABLE : trail.error);
    const failed = checkpoints.error ?? media.error ?? route.error;
    if (failed) return fail(failed);
    if (!trail.data) return { error: null, review: null };

    const reportsUnavailable = isMissingTable(reports.error);
    if (reports.error && !reportsUnavailable) return fail(reports.error);

    const row = trail.data as TrailReviewData["trail"];
    return {
      error: null,
      review: {
        trail: { ...row, review_flags: Array.isArray(row.review_flags) ? row.review_flags : [] },
        checkpoints: (checkpoints.data ?? []) as Checkpoint[],
        media: (media.data ?? []) as TrailMedia[],
        route: (route.data as RouteGeoJSON | null) ?? null,
        reports: (reports.data ?? []) as unknown as TrailReviewData["reports"],
        reportsUnavailable,
      },
    };
  });
}

export async function setTrailReviewed(
  id: string,
  reviewed: boolean,
  notes: string | null,
): Promise<Result<{ reviewed_at: string | null }>> {
  return asAdmin(async (supabase) => {
    const text = typeof notes === "string" ? notes.trim() : "";
    if (text.length > REVIEW_NOTES_MAX) return fail(`Notes can be at most ${REVIEW_NOTES_MAX} characters.`);

    const { data, error } = await supabase
      .from("trails")
      .update({ reviewed_at: reviewed === true ? new Date().toISOString() : null, review_notes: text || null })
      .eq("id", id)
      .select("reviewed_at");
    if (error) return fail(isMissingColumn(error.code) ? REVIEW_UNAVAILABLE : error);
    if (!data?.length) return fail("Trail not found. It may have been deleted.");

    await bustTrailCache(id); // the app labels unreviewed trails
    return { error: null, reviewed_at: (data[0].reviewed_at as string | null) ?? null };
  });
}

export async function markUnflaggedReviewed(): Promise<Result<{ marked: number }>> {
  return asAdmin(async (supabase) => {
    const { data, error } = await supabase
      .from("trails")
      .update({ reviewed_at: new Date().toISOString() })
      .is("reviewed_at", null)
      .eq("review_flags", "{}")
      .select("id");
    if (error) return fail(isMissingColumn(error.code) ? REVIEW_UNAVAILABLE : error);

    // One invalidation also drops the API's cached trail lists. Busting every trail would trip
    // the API's rate limit; cached trail pages expire on their own within 10 minutes.
    const ids = (data ?? []).map((row) => row.id as string);
    if (ids.length > 0) await bustTrailCache(ids[0]);
    return { error: null, marked: ids.length };
  });
}

// ── Hike quality ──
export async function getHikeQuality(): Promise<Result<{ data: HikeQualityRow[] }>> {
  return asAdmin(async (supabase) => {
    const { data, error } = await supabase.rpc("trail_hike_quality", { p_min_hikes: 1 });
    if (error) {
      const missing = error.code === "PGRST202" || error.code === "42883";
      return fail(missing ? HIKE_QUALITY_UNAVAILABLE : error);
    }
    return { error: null, data: ((data ?? []) as Record<string, unknown>[]).map(normalizeQualityRow) };
  });
}

// ── Shop Products ──
export async function getProducts(): Promise<Result<{ data: ProductListItem[] }>> {
  return asAdmin(async (supabase) => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, image_url, price, shop_name, is_published, sort_order, gear_tags")
      .order("sort_order")
      .order("created_at", { ascending: false });
    if (error) return fail(error);
    return { error: null, data: (data ?? []) as ProductListItem[] };
  });
}

export async function getProductDetail(id: string): Promise<Result<{ product: Product | null }>> {
  return asAdmin(async (supabase) => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, description, image_url, price, shop_name, external_url, is_published, sort_order, gear_tags")
      .eq("id", id)
      .maybeSingle();
    if (error) return fail(error);
    return { error: null, product: (data as Product | null) ?? null };
  });
}

export async function saveProduct(id: string | null, input: ProductInput): Promise<Result<{ id: string }>> {
  return asAdmin(async (supabase) => {
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    if (!name) return fail("The product name is required.");
    // products.price is DECIMAL(10,2) CHECK (price > 0); empty means "no price shown"
    const price = input.price == null ? null : Math.round(Number(input.price) * 100) / 100;
    if (price !== null && !(price > 0 && price < 1e8)) {
      return fail("The price must be a number greater than 0.");
    }

    const row = {
      name,
      description: optionalText(input.description),
      image_url: optionalText(input.image_url),
      price,
      shop_name: optionalText(input.shop_name),
      external_url: optionalText(input.external_url),
      is_published: input.is_published === true,
      sort_order: Number.isInteger(input.sort_order) ? input.sort_order : 0,
      ...("gear_tags" in input ? { gear_tags: normalizeGearTags(input.gear_tags) } : {}),
    };

    const { data, error } = id
      ? await supabase.from("products").update(row).eq("id", id).select("id")
      : await supabase.from("products").insert(row).select("id");
    if (error) return fail(error);
    const savedId = data?.[0]?.id as string | undefined;
    if (!savedId) return fail("Product not found. It may have been deleted.");
    return { error: null, id: savedId };
  });
}

export async function deleteProduct(id: string): Promise<Mutation> {
  return asAdmin(async (supabase) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    return error ? fail(error) : done;
  });
}
