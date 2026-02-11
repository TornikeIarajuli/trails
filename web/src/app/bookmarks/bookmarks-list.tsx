"use client";

import { useEffect, useState } from "react";
import { createAdminClient } from "@/lib/supabase";
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
    async function fetch() {
      const supabase = createAdminClient();
      const { data: rows } = await supabase
        .from("trail_bookmarks")
        .select("id, created_at, profiles(username), trails(name_en)")
        .order("created_at", { ascending: false })
        .limit(200);
      setData((rows ?? []) as unknown as BookmarkRow[]);
      setLoading(false);
    }
    fetch();
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this bookmark?")) return;
    const supabase = createAdminClient();
    await supabase.from("trail_bookmarks").delete().eq("id", id);
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
