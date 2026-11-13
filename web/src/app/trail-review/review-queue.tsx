"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getReviewQueue, markUnflaggedReviewed } from "@/lib/actions";
import { call } from "@/lib/call";
import { flagLabel, REVIEW_FILTERS, type QueueTrail, type ReviewFilter, type ReviewQueuePage } from "@/lib/trail-review";
import { AdminPagination } from "@/components/admin-pagination";
import { EmptyRow, ListFrame } from "@/components/admin-list";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCheck } from "lucide-react";

const FILTER_LABELS: Record<ReviewFilter, string> = {
  unreviewed: "Unreviewed",
  reviewed: "Reviewed",
  flagged: "Flagged",
  all: "All",
};

const EMPTY_MESSAGES: Record<ReviewFilter, string> = {
  unreviewed: "Every trail here has been reviewed.",
  reviewed: "No trail here has been reviewed yet.",
  flagged: "No trail here has flags.",
  all: "No trails.",
};

function measurements(t: QueueTrail): string {
  const parts = [
    t.distance_km !== null ? `${t.distance_km} km` : null,
    t.elevation_gain_m !== null ? `${t.elevation_gain_m} m ascent` : null,
    t.estimated_hours !== null ? `${t.estimated_hours} h` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "–";
}

export function ReviewQueue() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<ReviewFilter>("unreviewed");
  const [region, setRegion] = useState("");
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; queue: ReviewQueuePage | null; error: string | null } | null>(null);
  const [marking, setMarking] = useState(false);
  const key = `${version}:${page}:${filter}:${region}`;

  useEffect(() => {
    let cancelled = false;
    call(getReviewQueue({ page, filter, region })).then((res) => {
      if (cancelled) return;
      setLoaded(res.error === null ? { key, queue: res, error: null } : { key, queue: null, error: res.error });
    });
    return () => {
      cancelled = true;
    };
  }, [key, page, filter, region]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const loading = loaded?.key !== key;
  const queue = loaded?.queue ?? null; // the previous page stays visible while the next one loads
  const error = loading ? null : (loaded?.error ?? null);
  const unflagged = queue?.unflaggedUnreviewed ?? 0;

  async function markAllUnflagged() {
    if (unflagged === 0) return;
    const trails = `${unflagged} trail${unflagged === 1 ? "" : "s"}`;
    if (!confirm(`Mark ${trails} as reviewed?\n\nThese are all unreviewed trails without flags, in every region. Flagged trails are not changed.`)) return;
    setMarking(true);
    const res = await call(markUnflaggedReviewed());
    setMarking(false);
    if (res.error !== null) alert(`Could not mark the trails: ${res.error}`);
    else alert(`${res.marked} trail${res.marked === 1 ? "" : "s"} marked as reviewed. Trail pages in the app show it within 10 minutes.`);
    reload();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Trail review{queue ? ` (${queue.total})` : ""}</h2>
        <Button variant="outline" size="sm" disabled={marking || loading || unflagged === 0} onClick={markAllUnflagged}>
          <CheckCheck className="h-4 w-4 mr-1" />
          Mark all unflagged trails as reviewed{queue ? ` (${unflagged})` : ""}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {REVIEW_FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => { setFilter(f); setPage(1); }}
          >
            {FILTER_LABELS[f]}{queue ? ` (${queue.counts[f]})` : ""}
          </Button>
        ))}
        <select
          aria-label="Region"
          value={region}
          onChange={(e) => { setRegion(e.target.value); setPage(1); }}
          className="ml-auto h-8 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All regions</option>
          {(queue?.regions ?? []).map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <ListFrame error={error} loading={loading} ready={queue !== null} onRetry={reload}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trail</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead>Distance · ascent · time</TableHead>
              <TableHead>Photos</TableHead>
              <TableHead>Reviewed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(queue?.data ?? []).map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link href={`/trails/${t.id}/review`} className="font-medium hover:underline">{t.name_en}</Link>
                  {!t.is_published && <Badge variant="secondary" className="ml-2">Draft</Badge>}
                  {t.name_ka && <div className="text-xs text-muted-foreground">{t.name_ka}</div>}
                </TableCell>
                <TableCell className="text-sm">{t.region}</TableCell>
                <TableCell>
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {t.review_flags.length === 0
                      ? <span className="text-sm text-muted-foreground">–</span>
                      : t.review_flags.map((flag) => (
                          <Badge key={flag} variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">{flagLabel(flag)}</Badge>
                        ))}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{measurements(t)}</TableCell>
                <TableCell className="text-sm">{t.photos}</TableCell>
                <TableCell className="text-sm">
                  {t.reviewed_at ? new Date(t.reviewed_at).toLocaleDateString() : <Badge variant="secondary">Not reviewed</Badge>}
                </TableCell>
              </TableRow>
            ))}
            {queue !== null && queue.data.length === 0 && <EmptyRow colSpan={6}>{EMPTY_MESSAGES[filter]}</EmptyRow>}
          </TableBody>
        </Table>
      </ListFrame>
      <AdminPagination page={page} total={queue?.total ?? 0} loading={loading} onPageChange={setPage} />
    </div>
  );
}
