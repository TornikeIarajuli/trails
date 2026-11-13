"use client";

import { useState } from "react";
import { getEvents, deleteEvent } from "@/lib/actions";
import { call } from "@/lib/call";
import { usePagedList } from "@/hooks/use-paged-list";
import { AdminPagination } from "@/components/admin-pagination";
import { EmptyRow, ListFrame } from "@/components/admin-list";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function EventsList() {
  const [page, setPage] = useState(1);
  const { rows, total, ready, error, loading, reload } = usePagedList(getEvents, { page });

  async function remove(id: string, title: string) {
    if (!confirm(`Delete the group hike "${title}"? Participants are not notified.`)) return;
    const res = await call(deleteEvent(id));
    if (res.error !== null) alert(`Could not delete: ${res.error}`);
    if (res.error === null && rows.length === 1 && page > 1) setPage(page - 1);
    else reload();
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Group Hikes{ready ? ` (${total})` : ""}</h2>
      <ListFrame error={error} loading={loading} ready={ready} onRetry={reload}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Trail</TableHead>
              <TableHead>Organizer</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <div className="font-medium">{e.title}</div>
                  {e.description && (
                    <div className="max-w-xs text-xs text-muted-foreground truncate" title={e.description}>
                      {e.description}
                    </div>
                  )}
                </TableCell>
                <TableCell>{e.trails?.name_en ?? "-"}</TableCell>
                <TableCell className="text-sm">{e.organizer?.username ?? "-"}</TableCell>
                <TableCell className="text-sm">{new Date(e.scheduled_at).toLocaleString()}</TableCell>
                <TableCell>{e.participants?.[0]?.count ?? 0}</TableCell>
                <TableCell className="text-sm">{new Date(e.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => remove(e.id, e.title)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={7}>No group hikes yet.</EmptyRow>}
          </TableBody>
        </Table>
      </ListFrame>
      <AdminPagination page={page} total={total} loading={loading} onPageChange={setPage} />
    </div>
  );
}
