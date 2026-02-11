"use client";

import { useEffect, useState } from "react";
import { createAdminClient } from "@/lib/supabase";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface Condition {
  id: string;
  condition_type: string;
  severity: string;
  description: string | null;
  is_active: boolean;
  reported_at: string;
  profiles: { username: string } | null;
  trails: { name_en: string } | null;
}

const severityColors: Record<string, string> = {
  info: "bg-blue-100 text-blue-800",
  warning: "bg-yellow-100 text-yellow-800",
  danger: "bg-red-100 text-red-800",
};

export function ConditionsList() {
  const [data, setData] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const supabase = createAdminClient();
      const { data: rows } = await supabase
        .from("trail_conditions")
        .select("id, condition_type, severity, description, is_active, reported_at, profiles(username), trails(name_en)")
        .order("reported_at", { ascending: false })
        .limit(200);
      setData((rows ?? []) as unknown as Condition[]);
      setLoading(false);
    }
    fetch();
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this condition report?")) return;
    const supabase = createAdminClient();
    await supabase.from("trail_conditions").delete().eq("id", id);
    setData((prev) => prev.filter((c) => c.id !== id));
  }

  async function toggleActive(id: string, current: boolean) {
    const supabase = createAdminClient();
    await supabase.from("trail_conditions").update({ is_active: !current }).eq("id", id);
    setData((prev) => prev.map((c) => c.id === id ? { ...c, is_active: !current } : c));
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Trail Conditions ({data.length})</h2>
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trail</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.trails?.name_en ?? "-"}</TableCell>
                  <TableCell className="text-sm">{c.condition_type.replace(/_/g, " ")}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[c.severity] ?? ""}`}>
                      {c.severity}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs text-sm truncate">{c.description ?? "-"}</TableCell>
                  <TableCell className="text-sm">{c.profiles?.username ?? "-"}</TableCell>
                  <TableCell>
                    <button onClick={() => toggleActive(c.id, c.is_active)}>
                      <Badge variant={c.is_active ? "default" : "secondary"}>
                        {c.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-sm">{new Date(c.reported_at).toLocaleDateString()}</TableCell>
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
