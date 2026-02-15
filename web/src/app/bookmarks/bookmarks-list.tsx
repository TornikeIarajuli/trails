"use client";

import { useEffect, useState } from "react";
import { getBookmarks, deleteBookmark } from "@/lib/actions";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface BookmarkRow {
  id: string;
  created_at: string;
  profiles: { username: string } | null;
  trails: { name_en: string } | null;
}

export function BookmarksList() {
  const [data, setData] = useState<BookmarkRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBookmarks().then((d) => setData(d as unknown as BookmarkRow[])).finally(() => setLoading(false));
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this bookmark?")) return;
    await deleteBookmark(id);
    setData((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Bookmarks ({data.length})</h2>
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Trail</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.profiles?.username ?? "-"}</TableCell>
                  <TableCell>{b.trails?.name_en ?? "-"}</TableCell>
                  <TableCell className="text-sm">{new Date(b.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => remove(b.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
