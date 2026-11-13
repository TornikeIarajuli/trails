"use client";

import { useState } from "react";
import { getComments, deleteComment } from "@/lib/actions";
import { call } from "@/lib/call";
import { usePagedList } from "@/hooks/use-paged-list";
import { AdminPagination } from "@/components/admin-pagination";
import { EmptyRow, ListFrame } from "@/components/admin-list";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function CommentsList() {
  const [page, setPage] = useState(1);
  const { rows, total, ready, error, loading, reload } = usePagedList(getComments, { page });

  async function remove(id: string) {
    if (!confirm("Delete this comment?")) return;
    const res = await call(deleteComment(id));
    if (res.error !== null) alert(`Could not delete: ${res.error}`);
    if (res.error === null && rows.length === 1 && page > 1) setPage(page - 1);
    else reload();
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Comments{ready ? ` (${total})` : ""}</h2>
      <ListFrame error={error} loading={loading} ready={ready} onRetry={reload}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>On</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.profiles?.username ?? "-"}</TableCell>
                <TableCell className="max-w-md text-sm whitespace-normal break-words">{c.comment}</TableCell>
                <TableCell className="text-sm">
                  <Badge variant="outline">{c.activity_type}</Badge>
                  <div className="font-mono text-xs text-muted-foreground mt-1" title={c.activity_id}>
                    {c.activity_id.slice(0, 8)}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={5}>No comments yet.</EmptyRow>}
          </TableBody>
        </Table>
      </ListFrame>
      <AdminPagination page={page} total={total} loading={loading} onPageChange={setPage} />
    </div>
  );
}
