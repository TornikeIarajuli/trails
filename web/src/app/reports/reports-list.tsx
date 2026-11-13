"use client";

import { useState } from "react";
import Link from "next/link";
import { getReports, setReportStatus } from "@/lib/actions";
import { call } from "@/lib/call";
import { REPORTS_UNAVAILABLE } from "@/lib/types";
import { usePagedList } from "@/hooks/use-paged-list";
import { AdminPagination } from "@/components/admin-pagination";
import { EmptyRow, ListFrame } from "@/components/admin-list";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "dismissed", label: "Dismissed" },
  { value: "actioned", label: "Resolved" },
  { value: "", label: "All" },
];

// Where the reported item can be found in the panel.
function targetHref(type: string, id: string): string | null {
  switch (type) {
    case "user": return `/users/${encodeURIComponent(id)}`;
    case "photo": return "/photos";
    case "comment": return "/comments";
    case "event": return "/events";
    case "review": return "/reviews";
    case "condition": return "/conditions";
    case "completion": return "/completions";
    default: return null;
  }
}

export function ReportsList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("open");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { rows, total, ready, error, loading, reload } = usePagedList(getReports, { page, status });

  async function close(id: string, next: "dismissed" | "actioned") {
    setBusyId(id);
    const res = await call(setReportStatus(id, next));
    setBusyId(null);
    if (res.error !== null) alert(`Could not update: ${res.error}`);
    if (res.error === null && rows.length === 1 && page > 1) setPage(page - 1);
    else reload();
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Reports{ready ? ` (${total})` : ""}</h2>

      {error === REPORTS_UNAVAILABLE ? (
        <p className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">{REPORTS_UNAVAILABLE}</p>
      ) : (
        <>
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
                  <TableHead>Reported item</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-48"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const href = targetHref(r.target_type, r.target_id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant="outline">{r.target_type}</Badge>
                        <div className="font-mono text-xs text-muted-foreground mt-1 break-all">
                          {href ? <Link href={href} className="hover:underline">{r.target_id}</Link> : r.target_id}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{r.reason}</TableCell>
                      <TableCell className="max-w-xs text-sm whitespace-normal break-words">{r.details ?? "-"}</TableCell>
                      <TableCell className="text-sm">{r.reporter?.username ?? "-"}</TableCell>
                      <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "open" ? "default" : "secondary"}>
                          {r.status === "actioned" ? "resolved" : r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.status === "open" && (
                          <div className="flex justify-end gap-1">
                            <Button variant="outline" size="sm" disabled={busyId !== null} onClick={() => close(r.id, "dismissed")}>
                              Dismiss
                            </Button>
                            <Button variant="outline" size="sm" disabled={busyId !== null} onClick={() => close(r.id, "actioned")}>
                              Resolved
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <EmptyRow colSpan={7}>{status === "open" ? "No open reports." : "No reports."}</EmptyRow>
                )}
              </TableBody>
            </Table>
          </ListFrame>
          <AdminPagination page={page} total={total} loading={loading} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
