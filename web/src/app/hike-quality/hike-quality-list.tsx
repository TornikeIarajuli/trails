"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getHikeQuality } from "@/lib/actions";
import { call } from "@/lib/call";
import { HIKE_QUALITY_UNAVAILABLE } from "@/lib/types";
import {
  MIN_HIKES_FOR_CHECK,
  qualityConcerns,
  sortQualityRows,
  type HikeQualityRow,
  type QualitySortKey,
} from "@/lib/hike-quality";
import { AdminError } from "@/components/admin-error";
import { EmptyRow } from "@/components/admin-list";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp } from "lucide-react";

const COLUMNS: { key: QualitySortKey; label: string }[] = [
  { key: "name", label: "Trail" },
  { key: "hikes", label: "Hikes" },
  { key: "verified", label: "Verified" },
  { key: "coverage", label: "Route covered" },
  { key: "off_route", label: "Off route" },
  { key: "hours", label: "Time (median / estimate)" },
  { key: "distance", label: "Distance (median / catalogue)" },
  { key: "last_hike", label: "Last hike" },
  { key: "check", label: "Check" },
];

const percent = (share: number | null) => (share === null ? "–" : `${Math.round(share * 100)}%`);
const value = (n: number | null, unit: string) => (n === null ? "–" : `${n} ${unit}`);

export function HikeQualityList() {
  const [rows, setRows] = useState<HikeQualityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: QualitySortKey; direction: "asc" | "desc" }>({ key: "check", direction: "desc" });

  useEffect(() => {
    let cancelled = false;
    call(getHikeQuality()).then((res) => {
      if (cancelled) return;
      if (res.error !== null) setError(res.error);
      else setRows(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => sortQualityRows(rows, sort.key, sort.direction), [rows, sort]);

  function sortBy(key: QualitySortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "name" ? "asc" : "desc" },
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Hike quality</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-3xl">
        Recorded hikes compared with each trail&apos;s route and estimates. A trail with at least {MIN_HIKES_FOR_CHECK} hikes
        is marked for checking when fewer than half of them were verified, hikers are off the route for more than 30% of
        their track, or hikes take more than 1.5× or less than half the estimated time.
      </p>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : error === HIKE_QUALITY_UNAVAILABLE ? (
        <p className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">{error}</p>
      ) : error ? (
        <AdminError message={error} onRetry={() => window.location.reload()} />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((c) => (
                  <TableHead key={c.key}>
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => sortBy(c.key)}>
                      {c.label}
                      {sort.key === c.key && (sort.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => {
                const concerns = qualityConcerns(r);
                return (
                  <TableRow key={r.trail_id}>
                    <TableCell>
                      <Link href={`/trails/${r.trail_id}/review`} className="font-medium hover:underline">{r.name_en}</Link>
                    </TableCell>
                    <TableCell>{r.hikes}</TableCell>
                    <TableCell className="text-sm">{r.verified}/{r.hikes} ({percent(r.hikes > 0 ? r.verified / r.hikes : null)})</TableCell>
                    <TableCell className="text-sm">{percent(r.median_coverage)}</TableCell>
                    <TableCell className="text-sm">{percent(r.median_off_route)}</TableCell>
                    <TableCell className="text-sm">{value(r.median_hours, "h")} / {value(r.estimated_hours, "h")}</TableCell>
                    <TableCell className="text-sm">{value(r.median_distance_km, "km")} / {value(r.distance_km, "km")}</TableCell>
                    <TableCell className="text-sm">{r.last_hike ? new Date(r.last_hike).toLocaleDateString() : "–"}</TableCell>
                    <TableCell className="text-sm">
                      {concerns.length > 0 ? (
                        <div className="max-w-xs">
                          <Badge variant="destructive">Check this trail</Badge>
                          <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground whitespace-normal">
                            {concerns.map((c) => <li key={c}>{c}</li>)}
                          </ul>
                        </div>
                      ) : r.hikes < MIN_HIKES_FOR_CHECK ? (
                        <span className="text-xs text-muted-foreground">Too few hikes</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">OK</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {sorted.length === 0 && (
                <EmptyRow colSpan={COLUMNS.length}>
                  No hikes have been recorded yet. This report fills in as people record hikes in the app: every recorded
                  hike is compared with its trail&apos;s route and estimates.
                </EmptyRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
