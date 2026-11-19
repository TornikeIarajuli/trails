"use client";

import { useState } from "react";
import { getPosts, deletePost } from "@/lib/actions";
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

/** Free-form posts from the app, newest first, for moderation: reported ones are deleted here. */
export function PostsList() {
  const [page, setPage] = useState(1);
  const { rows, total, ready, error, loading, reload } = usePagedList(getPosts, { page });

  async function remove(id: string) {
    if (!confirm("Delete this post? Its likes, comments and photos go with it.")) return;
    const res = await call(deletePost(id));
    if (res.error !== null) alert(`Could not delete: ${res.error}`);
    else if (res.warning) alert(res.warning);
    if (res.error === null && rows.length === 1 && page > 1) setPage(page - 1);
    else reload();
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Posts{ready ? ` (${total})` : ""}</h2>
      <ListFrame error={error} loading={loading} ready={ready} onRetry={reload}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Photo</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Post</TableHead>
              <TableHead>Trail / place</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => {
              const photos = p.photo_urls ?? [];
              const first = photos.length ? httpUrl(photos[0]) : null;
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    {first ? (
                      <a href={first} target="_blank" rel="noopener noreferrer" className="relative block w-16">
                        <img src={first} alt="Post photo" loading="lazy" className="h-16 w-16 rounded object-cover" />
                        {photos.length > 1 && (
                          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-xs text-white">
                            +{photos.length - 1}
                          </span>
                        )}
                      </a>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="font-medium">{p.profiles?.username ?? "-"}</TableCell>
                  <TableCell className="max-w-md text-sm whitespace-pre-wrap line-clamp-4" title={p.body || undefined}>
                    {p.body || "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {[p.trails?.name_en, p.place_name].filter(Boolean).join(" · ") || "-"}
                  </TableCell>
                  <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => remove(p.id)} aria-label="Delete post">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <EmptyRow colSpan={6}>No posts yet.</EmptyRow>}
          </TableBody>
        </Table>
      </ListFrame>
      <AdminPagination page={page} total={total} loading={loading} onPageChange={setPage} />
    </div>
  );
}
