"use client";

import { useState } from "react";
import { getCommunityPhotos, deleteCommunityPhoto } from "@/lib/actions";
import { call } from "@/lib/call";
import { httpUrl } from "@/lib/url";
import { usePagedList } from "@/hooks/use-paged-list";
import { AdminPagination } from "@/components/admin-pagination";
import { EmptyRow, ListFrame } from "@/components/admin-list";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function PhotosList() {
  const [page, setPage] = useState(1);
  const { rows, total, ready, error, loading, reload } = usePagedList(getCommunityPhotos, { page });

  async function remove(id: string) {
    if (!confirm("Delete this photo? The file is removed from storage as well.")) return;
    const res = await call(deleteCommunityPhoto(id));
    if (res.error !== null) alert(`Could not delete: ${res.error}`);
    else if (res.warning) alert(res.warning);
    if (res.error === null && rows.length === 1 && page > 1) setPage(page - 1);
    else reload();
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Community Photos{ready ? ` (${total})` : ""}</h2>
      <ListFrame error={error} loading={loading} ready={ready} onRetry={reload}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Photo</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Trail</TableHead>
              <TableHead>Caption</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => {
              const url = httpUrl(p.url);
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={p.caption ?? "Photo"} loading="lazy" className="h-16 w-16 rounded object-cover" />
                      </a>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="font-medium">{p.profiles?.username ?? "-"}</TableCell>
                  <TableCell>{p.trails?.name_en ?? "-"}</TableCell>
                  <TableCell className="max-w-xs text-sm truncate" title={p.caption ?? undefined}>{p.caption ?? "-"}</TableCell>
                  <TableCell className="text-sm">{new Date(p.taken_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <EmptyRow colSpan={6}>No community photos yet.</EmptyRow>}
          </TableBody>
        </Table>
      </ListFrame>
      <AdminPagination page={page} total={total} loading={loading} onPageChange={setPage} />
    </div>
  );
}
