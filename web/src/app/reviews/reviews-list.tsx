"use client";

import { useEffect, useState } from "react";
import { createAdminClient } from "@/lib/supabase";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Star } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles: { username: string } | null;
  trails: { name_en: string } | null;
}

export function ReviewsList() {
  const [data, setData] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const supabase = createAdminClient();
      const { data: rows } = await supabase
        .from("trail_reviews")
        .select("id, rating, comment, created_at, profiles(username), trails(name_en)")
        .order("created_at", { ascending: false })
        .limit(200);
      setData((rows ?? []) as unknown as Review[]);
      setLoading(false);
    }
    fetch();
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this review?")) return;
    const supabase = createAdminClient();
    await supabase.from("trail_reviews").delete().eq("id", id);
    setData((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Reviews ({data.length})</h2>
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Trail</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.profiles?.username ?? "-"}</TableCell>
                  <TableCell>{r.trails?.name_en ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-sm text-sm truncate">{r.comment ?? "-"}</TableCell>
                  <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
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
