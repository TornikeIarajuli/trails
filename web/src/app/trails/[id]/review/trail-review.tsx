"use client";

import { use, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { getTrailReview, setReportStatus, setTrailReviewed } from "@/lib/actions";
import { call } from "@/lib/call";
import { checkpointPosition } from "@/lib/geo";
import { flagLabel, profileStats, reportReasonLabel } from "@/lib/trail-review";
import { httpUrl } from "@/lib/url";
import { REVIEW_NOTES_MAX, type TrailReviewData } from "@/lib/types";
import { AdminError } from "@/components/admin-error";
import { ElevationProfile } from "@/components/ElevationProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Check, Pencil, Undo2 } from "lucide-react";

const RouteMap = dynamic(
  () => import("@/components/RouteMap").then((m) => m.RouteMap),
  { ssr: false, loading: () => <div className="h-[460px] rounded-lg bg-muted animate-pulse" /> },
);

const CHECKLIST = [
  "The route follows a real path on the topographic map",
  "The start and the end are in the right places",
  "The name is right",
  "Distance, ascent, time and difficulty are plausible",
  "The photos (if any) show this trail",
];

const fmt = (value: number | null, unit: string) => (value === null ? "–" : `${value} ${unit}`);

export function TrailReviewScreen({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);
  const [review, setReview] = useState<TrailReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checks, setChecks] = useState<boolean[]>(() => CHECKLIST.map(() => false));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    call(getTrailReview(id)).then((res) => {
      if (cancelled) return;
      if (res.error !== null) {
        setLoadError(res.error);
      } else {
        setReview(res.review);
        setNotes(res.review?.trail.review_notes ?? "");
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function save(reviewed: boolean) {
    setSaving(true);
    setSaved(null);
    const res = await call(setTrailReviewed(id, reviewed, notes));
    setSaving(false);
    if (res.error !== null) {
      alert(`Could not save: ${res.error}`);
      return;
    }
    setReview((prev) => (prev ? { ...prev, trail: { ...prev.trail, reviewed_at: res.reviewed_at, review_notes: notes.trim() || null } } : prev));
    setSaved(reviewed ? "Marked as reviewed." : "Review mark removed.");
  }

  async function closeReport(reportId: string, status: "dismissed" | "actioned") {
    const res = await call(setReportStatus(reportId, status));
    if (res.error !== null) {
      alert(`Could not update the report: ${res.error}`);
      return;
    }
    setReview((prev) => (prev ? { ...prev, reports: prev.reports.filter((r) => r.id !== reportId) } : prev));
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (loadError) return <AdminError message={loadError} onRetry={() => window.location.reload()} />;
  if (!review) return <p>Trail not found</p>;

  const { trail, checkpoints, media, route, reports } = review;
  const stats = profileStats(trail.elevation_profile);
  const markers = checkpoints.flatMap((cp) => {
    const position = checkpointPosition(cp);
    return position ? [{ ...position, label: cp.name_en }] : [];
  });
  const allChecked = checks.every(Boolean);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/trail-review">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{trail.name_en}</h2>
          <p className="text-sm text-muted-foreground">
            {[trail.name_ka, trail.region, trail.difficulty].filter(Boolean).join(" · ")}
          </p>
        </div>
        {!trail.is_published && <Badge variant="secondary">Draft</Badge>}
        <Badge variant={trail.reviewed_at ? "default" : "secondary"}>
          {trail.reviewed_at ? `Reviewed ${new Date(trail.reviewed_at).toLocaleDateString()}` : "Not reviewed"}
        </Badge>
        <Link href={`/trails/${id}`}>
          <Button variant="outline"><Pencil className="h-4 w-4 mr-1" />Edit trail</Button>
        </Link>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader><CardTitle>Route</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {route ? (
              <>
                <RouteMap geojson={route} checkpointMarkers={markers} baseLayer="topo" height={460} />
                <p className="text-xs text-muted-foreground">
                  Green = start · Red = end · Orange = checkpoints (hover for names). Switch between the terrain and street maps with the layer button.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">This trail has no route. Upload a GPX file in the trail editor.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Elevation profile</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {stats ? (
              <>
                <ElevationProfile points={stats.points} />
                <p className="text-sm">
                  Measured along the route: {stats.lengthKm.toFixed(1)} km, ascent ≈ {stats.ascentM} m, {stats.minM}–{stats.maxM} m.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No elevation profile was measured for this trail.</p>
            )}
            <p className="text-sm text-muted-foreground">
              In the catalogue: {fmt(trail.distance_km, "km")}, ascent {fmt(trail.elevation_gain_m, "m")}, {fmt(trail.estimated_hours, "h")}, difficulty {trail.difficulty}.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Flags</CardTitle></CardHeader>
            <CardContent>
              {trail.review_flags.length === 0 ? (
                <p className="text-sm text-muted-foreground">The content pipeline raised no flags for this trail.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {trail.review_flags.map((flag) => (
                    <Badge key={flag} variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">{flagLabel(flag)}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Open reports from hikers ({reports.length})</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {review.reportsUnavailable ? (
                <p className="text-sm text-muted-foreground">Reports are not available until database migration 050 has been applied.</p>
              ) : reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open reports about this trail.</p>
              ) : (
                reports.map((r) => (
                  <div key={r.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{reportReasonLabel(r.reason)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {r.reporter?.username ?? "unknown user"} · {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {r.details && <p className="mt-2 whitespace-pre-wrap break-words">{r.details}</p>}
                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => closeReport(r.id, "dismissed")}>Dismiss</Button>
                      <Button variant="outline" size="sm" onClick={() => closeReport(r.id, "actioned")}>Resolved</Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Photos ({media.length})</CardTitle></CardHeader>
          <CardContent>
            {media.length === 0 ? (
              <p className="text-sm text-muted-foreground">This trail has no photos.</p>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {media.map((m) => {
                  const url = httpUrl(m.url);
                  return url ? (
                    <a key={m.id} href={url} target="_blank" rel="noopener noreferrer" title={m.caption ?? undefined}>
                      <img src={url} alt={m.caption ?? "Trail photo"} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
                    </a>
                  ) : null;
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Review</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              {CHECKLIST.map((item, i) => (
                <label key={item} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={checks[i]}
                    onChange={(e) => setChecks((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
                  />
                  {item}
                </label>
              ))}
            </div>
            <div>
              <Label htmlFor="review-notes">Notes</Label>
              <Textarea
                id="review-notes"
                rows={4}
                maxLength={REVIEW_NOTES_MAX}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What you checked, what you corrected, what still needs work"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">{notes.length} / {REVIEW_NOTES_MAX}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => save(true)} disabled={saving || !allChecked}>
                <Check className="h-4 w-4 mr-1" />
                {trail.reviewed_at ? "Mark reviewed again" : "Mark reviewed"}
              </Button>
              {trail.reviewed_at && (
                <Button variant="outline" onClick={() => save(false)} disabled={saving}>
                  <Undo2 className="h-4 w-4 mr-1" />Unmark
                </Button>
              )}
              {!allChecked && <span className="text-xs text-muted-foreground">Tick every item to mark the trail as reviewed.</span>}
              {saved && <span className="text-sm text-green-700">{saved}</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
