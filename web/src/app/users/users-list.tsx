"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUsers, deleteUser as deleteUserAction } from "@/lib/actions";
import { call } from "@/lib/call";
import { usePagedList } from "@/hooks/use-paged-list";
import { AdminPagination } from "@/components/admin-pagination";
import { EmptyRow, ListFrame } from "@/components/admin-list";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, Pencil, Trash2 } from "lucide-react";

export function UsersList() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const { rows, total, ready, error, loading, reload } = usePagedList(getUsers, { page, search });

  // The search runs on the server, so wait until typing pauses before asking.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  async function handleDelete(id: string, username: string) {
    if (!confirm(`Delete user "${username}"? This will delete all their data.`)) return;
    const res = await call(deleteUserAction(id));
    if (res.error !== null) alert(`Could not delete: ${res.error}`);
    else if (res.warning) alert(res.warning);
    if (res.error === null && rows.length === 1 && page > 1) setPage(page - 1);
    else reload();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Users{ready ? ` (${total})` : ""}</h2>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by username or name..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
        />
      </div>

      <ListFrame error={error} loading={loading} ready={ready} onRetry={reload}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Bio</TableHead>
              <TableHead>Trails Completed</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      {user.avatar_url && <AvatarImage src={user.avatar_url} />}
                      <AvatarFallback>{(user.username[0] ?? "?").toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <Link href={`/users/${user.id}`} className="font-medium hover:underline">
                        {user.username}
                      </Link>
                      {user.full_name && (
                        <div className="text-xs text-muted-foreground">{user.full_name}</div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                  {user.bio ?? "-"}
                </TableCell>
                <TableCell>{user.total_trails_completed}</TableCell>
                <TableCell className="text-sm">
                  {new Date(user.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Link href={`/users/${user.id}`}>
                      <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(user.id, user.username)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <EmptyRow colSpan={5}>{search ? `No users match "${search}".` : "No users yet."}</EmptyRow>
            )}
          </TableBody>
        </Table>
      </ListFrame>
      <AdminPagination page={page} total={total} loading={loading} onPageChange={setPage} />
    </div>
  );
}
