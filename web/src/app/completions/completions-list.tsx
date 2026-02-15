"use client";

import { useEffect, useState } from "react";
import { getCompletions, deleteCompletion } from "@/lib/actions";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface Completion {
  id: string;
  user_id: string;
  trail_id: string;
  status: string;
  elapsed_seconds: number | null;
  completed_at: string;
  profiles: { username: string } | null;
  trails: { name_en: string } | null;
}

export function CompletionsList() {
  const [data, setData] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCompletions().then((d) => setData(d as unknown as Completion[])).finally(() => setLoading(false));
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this completion?")) return;
    await deleteCompletion(id);
    setData((prev) => prev.filter((c) => c.id !== id));
  }

  function formatDuration(s: number | null) {
    if (!s) return "-";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Completions ({data.length})</h2>
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Trail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.profiles?.username ?? "-"}</TableCell>
                  <TableCell>{c.trails?.name_en ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "approved" ? "default" : "secondary"}>{c.status}</Badge>
                  </TableCell>
                  <TableCell>{formatDuration(c.elapsed_seconds)}</TableCell>
                  <TableCell className="text-sm">{new Date(c.completed_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
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
