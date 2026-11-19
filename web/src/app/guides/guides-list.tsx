"use client";

import { useState } from "react";
import { getGuides, setGuideStatus } from "@/lib/actions";
import { call } from "@/lib/call";
import { usePagedList } from "@/hooks/use-paged-list";
import { AdminPagination } from "@/components/admin-pagination";
import { EmptyRow, ListFrame } from "@/components/admin-list";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const FILTERS = [
  { value: "pending", label: "Waiting" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "paused", label: "Paused" },
  { value: "", label: "All" },
];

/** Guide applications: check who they are, then verify (listed in the app) or reject with a note. */
export function GuidesList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const { rows, total, ready, error, loading, reload } = usePagedList(getGuides, { page, status });

  async function change(userId: string, next: "verified" | "rejected" | "paused") {
    let note: string | undefined;
    if (next === "rejected") {
      const answer = prompt("Why? The guide sees this note.") ?? undefined;
      if (answer === undefined) return;
      note = answer;
    } else if (!confirm(next === "verified" ? "List this guide in the app?" : "Hide this guide for now?")) {
      return;
    }
    setBusy(userId);
    const res = await call(setGuideStatus(userId, next, note));
    setBusy(null);
    if (res.error !== null) alert(`Could not update: ${res.error}`);
    if (res.error === null && rows.length === 1 && page > 1) setPage(page - 1);
    else reload();
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Guides{ready ? ` (${total})` : ""}</h2>
      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <Button
            key={f.value || "all"}
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
              <TableHead>Guide</TableHead>
              <TableHead>About</TableHead>
              <TableHead>Regions / languages</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-56"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((g) => (
              <TableRow key={g.user_id}>
                <TableCell className="font-medium">
                  {g.profiles?.username ?? "-"}
                  <div className="text-xs text-muted-foreground">applied {new Date(g.created_at).toLocaleDateString()}</div>
                </TableCell>
                <TableCell className="max-w-md text-sm whitespace-normal">
                  <div className="font-medium">{g.headline}</div>
                  <div className="text-muted-foreground line-clamp-4" title={g.bio}>{g.bio}</div>
                  {g.certifications && <div className="mt-1 text-xs">Certified: {g.certifications}</div>}
                  {g.admin_note && <div className="mt-1 text-xs text-destructive">Note: {g.admin_note}</div>}
                </TableCell>
                <TableCell className="text-sm whitespace-normal">
                  <div>{g.regions.join(", ") || "-"}</div>
                  <div className="text-muted-foreground">{g.languages.join(", ")}</div>
                </TableCell>
                <TableCell className="text-sm whitespace-normal">
                  {g.price_gel != null ? `${g.price_gel} GEL` : "-"}
                  {g.price_note && <div className="text-xs text-muted-foreground">{g.price_note}</div>}
                </TableCell>
                <TableCell className="text-sm whitespace-normal">
                  <div>{g.contact_phone ?? "-"}{g.contact_whatsapp ? " (WhatsApp)" : ""}</div>
                  {g.contact_telegram && <div className="text-muted-foreground">@{g.contact_telegram}</div>}
                </TableCell>
                <TableCell>
                  <Badge variant={g.status === "verified" ? "default" : "secondary"}>{g.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {g.status !== "verified" && (
                      <Button size="sm" disabled={busy !== null} onClick={() => change(g.user_id, "verified")}>Verify</Button>
                    )}
                    {g.status !== "rejected" && (
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => change(g.user_id, "rejected")}>Reject</Button>
                    )}
                    {g.status === "verified" && (
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => change(g.user_id, "paused")}>Pause</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={7}>{status === "pending" ? "No applications waiting." : "No guides."}</EmptyRow>}
          </TableBody>
        </Table>
      </ListFrame>
      <AdminPagination page={page} total={total} loading={loading} onPageChange={setPage} />
    </div>
  );
}
