"use client";

import { useState } from "react";
import { getCompletions, deleteCompletion, reviewCompletion, reviewPendingHike } from "@/lib/actions";
import { call } from "@/lib/call";
import { httpUrl } from "@/lib/url";
import { usePagedList } from "@/hooks/use-paged-list";
import { AdminPagination } from "@/components/admin-pagination";
import { EmptyRow, ListFrame } from "@/components/admin-list";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Trash2, X } from "lucide-react";

const FILTERS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const statusColors: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
};

const SOURCE_LABELS: Record<string, string> = {
  hike: "Recorded",
  photo: "Photo",
  past: "Past hike",
};

export function CompletionsList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { rows, total, ready, error, loading, reload } = usePagedList(getCompletions, { page, status });

  async function review(id: string, next: "approved" | "rejected") {
    if (next === "rejected" && !confirm("Reject this completion? It will not count for the user.")) return;
    setBusyId(id);
    const res = await call(reviewCompletion(id, next));
    setBusyId(null);
    if (res.error !== null) alert(res.error);
    else if (res.warning) alert(res.warning);
    reload();
  }

  async function reviewHike(id: string, next: "approved" | "rejected") {
    if (next === "rejected" && !confirm("Reject this recorded hike? The trail stays marked as a past hike.")) return;
    setBusyId(id);
    const res = await call(reviewPendingHike(id, next));
    setBusyId(null);
    if (res.error !== null) alert(res.error);
    else if (res.warning) alert(res.warning);
    reload();
  }

  async function remove(id: string) {
    if (!confirm("Delete this completion?")) return;
    setBusyId(id);
    const res = await call(deleteCompletion(id));
    setBusyId(null);
    if (res.error !== null) alert(`Could not delete: ${res.error}`);
    else if (res.warning) alert(res.warning);
    if (res.error === null && rows.length === 1 && page > 1) setPage(page - 1);
    else reload();
  }

  function formatDuration(s: number | null) {
    if (!s) return "-";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Completions{ready ? ` (${total})` : ""}</h2>

      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={status === f.value ? "default" : "outline"}
            onClick={() => { setStatus(f.value); setPage(1); }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <ListFrame error={error} loading={loading} ready={ready} onRetry={reload}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Trail</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Verification</TableHead>
              <TableHead>Proof</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-48"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => {
              const proofUrl = httpUrl(c.proof_photo_url);
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.profiles?.username ?? "-"}</TableCell>
                  <TableCell>{c.trails?.name_en ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[c.status] ?? ""}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm" title={c.source === "past" ? "Self-reported: hiked before the app. Not counted on the leaderboard." : undefined}>
                    {SOURCE_LABELS[c.source ?? "hike"] ?? c.source}
                  </TableCell>
                  <TableCell>{formatDuration(c.elapsed_seconds)}</TableCell>
                  {c.pending_hike_id ? (
                    <TableCell className="max-w-xs text-sm">
                      Recorded hike waiting: {formatDuration(c.pending_hike?.elapsed_seconds ?? null)}
                      {c.pending_hike?.coverage != null ? `, ${Math.round(c.pending_hike.coverage * 100)}% of the route` : ""}
                      {c.pending_hike?.reason ? ` (${c.pending_hike.reason})` : ""}
                    </TableCell>
                  ) : (
                    <TableCell className="max-w-xs text-sm truncate" title={c.reviewer_note ?? undefined}>
                      {c.reviewer_note ?? "-"}
                    </TableCell>
                  )}
                  <TableCell className="text-sm">
                    {proofUrl ? (
                      <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                        Photo
                      </a>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {/* A past hike only has a year */}
                    {c.source === "past" ? new Date(c.completed_at).getUTCFullYear() : new Date(c.completed_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {c.pending_hike_id && (
                        <>
                          <Button variant="outline" size="sm" disabled={busyId !== null} onClick={() => reviewHike(c.id, "approved")}>
                            <Check className="h-4 w-4" /> Approve hike
                          </Button>
                          <Button variant="outline" size="sm" disabled={busyId !== null} onClick={() => reviewHike(c.id, "rejected")}>
                            <X className="h-4 w-4" /> Reject
                          </Button>
                        </>
                      )}
                      {c.status === "pending" && (
                        <>
                          <Button variant="outline" size="sm" disabled={busyId !== null} onClick={() => review(c.id, "approved")}>
                            <Check className="h-4 w-4" /> Approve
                          </Button>
                          <Button variant="outline" size="sm" disabled={busyId !== null} onClick={() => review(c.id, "rejected")}>
                            <X className="h-4 w-4" /> Reject
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" disabled={busyId !== null} onClick={() => remove(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <EmptyRow colSpan={9}>
                {status ? `No ${status} completions.` : "No completions yet."}
              </EmptyRow>
            )}
          </TableBody>
        </Table>
      </ListFrame>

      <AdminPagination page={page} total={total} loading={loading} onPageChange={setPage} />
    </div>
  );
}
