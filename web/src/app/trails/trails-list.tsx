"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Search, Plus } from "lucide-react";

interface Trail {
  id: string;
  name_en: string;
  name_ka: string | null;
  region: string;
  difficulty: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  is_published: boolean;
}

const difficultyColors: Record<string, string> = {
  easy: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  hard: "bg-orange-100 text-orange-800",
  ultra: "bg-red-100 text-red-800",
};

export function TrailsList() {
  const [trails, setTrails] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchTrails();
  }, []);

  async function fetchTrails() {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("trails")
      .select("id, name_en, name_ka, region, difficulty, distance_km, elevation_gain_m, is_published")
      .order("name_en");
    setTrails(data ?? []);
    setLoading(false);
  }

  async function deleteTrail(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const supabase = createAdminClient();
    await supabase.from("trails").delete().eq("id", id);
    setTrails((prev) => prev.filter((t) => t.id !== id));
  }

  const filtered = trails.filter(
    (t) =>
      t.name_en.toLowerCase().includes(search.toLowerCase()) ||
      t.region.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Trails ({trails.length})</h2>
        <Link href="/trails/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Trail
          </Button>
        </Link>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or region..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead>Elevation</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((trail) => (
                <TableRow key={trail.id}>
                  <TableCell>
                    <Link
                      href={`/trails/${trail.id}`}
                      className="font-medium hover:underline"
                    >
                      {trail.name_en}
                    </Link>
                    {trail.name_ka && (
                      <div className="text-xs text-muted-foreground">{trail.name_ka}</div>
                    )}
                  </TableCell>
                  <TableCell>{trail.region}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${difficultyColors[trail.difficulty] ?? ""}`}>
                      {trail.difficulty}
                    </span>
                  </TableCell>
                  <TableCell>{trail.distance_km ? `${trail.distance_km} km` : "-"}</TableCell>
                  <TableCell>{trail.elevation_gain_m ? `${trail.elevation_gain_m}m` : "-"}</TableCell>
                  <TableCell>
                    <Badge variant={trail.is_published ? "default" : "secondary"}>
                      {trail.is_published ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link href={`/trails/${trail.id}`}>
                        <Button variant="ghost" size="icon">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTrail(trail.id, trail.name_en)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
