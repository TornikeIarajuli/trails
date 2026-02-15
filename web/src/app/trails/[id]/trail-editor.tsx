"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { getTrailDetail, saveTrail, uploadTrailPhoto, deleteTrailMedia } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Trash2, Upload, Loader2 } from "lucide-react";
import Link from "next/link";

interface Trail {
  id: string;
  name_en: string;
  name_ka: string | null;
  description_en: string | null;
  description_ka: string | null;
  region: string;
  difficulty: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  estimated_hours: number | null;
  cover_image_url: string | null;
  is_published: boolean;
}

interface Checkpoint {
  id: string;
  name_en: string;
  name_ka: string | null;
  description_en: string | null;
  type: string;
  elevation_m: number | null;
  is_checkable: boolean;
  sort_order: number;
}

interface TrailMedia {
  id: string;
  url: string;
  caption: string | null;
  type: string;
}

const DIFFICULTIES = ["easy", "medium", "hard", "ultra"];

export function TrailEditor({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);
  const router = useRouter();
  const isNew = id === "new";

  const [trail, setTrail] = useState<Trail>({
    id: "",
    name_en: "",
    name_ka: null,
    description_en: null,
    description_ka: null,
    region: "",
    difficulty: "medium",
    distance_km: null,
    elevation_gain_m: null,
    estimated_hours: null,
    cover_image_url: null,
    is_published: true,
  });
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [media, setMedia] = useState<TrailMedia[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isNew) return;
    getTrailDetail(id).then(({ trail: t, checkpoints: cps, media: med }) => {
      if (t) setTrail(t as Trail);
      setCheckpoints(cps as Checkpoint[]);
      setMedia(med as TrailMedia[]);
    }).finally(() => setLoading(false));
  }, [id, isNew]);

  function update<K extends keyof Trail>(key: K, value: Trail[K]) {
    setTrail((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      name_en: trail.name_en,
      name_ka: trail.name_ka || null,
      description_en: trail.description_en || null,
      description_ka: trail.description_ka || null,
      region: trail.region,
      difficulty: trail.difficulty,
      distance_km: trail.distance_km,
      elevation_gain_m: trail.elevation_gain_m,
      estimated_hours: trail.estimated_hours,
      cover_image_url: trail.cover_image_url || null,
      is_published: trail.is_published,
    };

    const { data, error } = await saveTrail(isNew ? null : id, payload);
    if (error) {
      alert(`Error: ${error}`);
    } else if (isNew && data) {
      router.push(`/trails/${(data as { id: string }).id}`);
    } else {
      alert("Trail saved!");
    }
    setSaving(false);
  }

  async function handleUploadPhoto(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { error, record } = await uploadTrailPhoto(id, formData);
      if (error) {
        alert(`Upload failed: ${error}`);
        return;
      }
      if (record) setMedia((prev) => [...prev, record as TrailMedia]);
    } finally {
      setUploading(false);
    }
  }

  async function deleteMedia(mediaId: string) {
    if (!confirm("Delete this photo?")) return;
    await deleteTrailMedia(mediaId);
    setMedia((prev) => prev.filter((m) => m.id !== mediaId));
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/trails">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h2 className="text-2xl font-bold flex-1">
          {isNew ? "New Trail" : trail.name_en}
        </h2>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle>Basic Info</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name (English)</Label>
                <Input value={trail.name_en} onChange={(e) => update("name_en", e.target.value)} />
              </div>
              <div>
                <Label>Name (Georgian)</Label>
                <Input value={trail.name_ka ?? ""} onChange={(e) => update("name_ka", e.target.value || null)} />
              </div>
            </div>
            <div>
              <Label>Description (English)</Label>
              <Textarea
                rows={4}
                value={trail.description_en ?? ""}
                onChange={(e) => update("description_en", e.target.value || null)}
              />
            </div>
            <div>
              <Label>Description (Georgian)</Label>
              <Textarea
                rows={4}
                value={trail.description_ka ?? ""}
                onChange={(e) => update("description_ka", e.target.value || null)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Region</Label>
                <Input value={trail.region} onChange={(e) => update("region", e.target.value)} />
              </div>
              <div>
                <Label>Difficulty</Label>
                <div className="flex gap-2 mt-1">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d}
                      onClick={() => update("difficulty", d)}
                      className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
                        trail.difficulty === d
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted border-border hover:bg-muted/80"
                      }`}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Distance (km)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={trail.distance_km ?? ""}
                  onChange={(e) => update("distance_km", e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
              <div>
                <Label>Elevation Gain (m)</Label>
                <Input
                  type="number"
                  value={trail.elevation_gain_m ?? ""}
                  onChange={(e) => update("elevation_gain_m", e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
              <div>
                <Label>Estimated Hours</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={trail.estimated_hours ?? ""}
                  onChange={(e) => update("estimated_hours", e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Label>Published</Label>
              <button
                onClick={() => update("is_published", !trail.is_published)}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  trail.is_published ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    trail.is_published ? "translate-x-5.5 left-0.5" : "left-0.5"
                  }`}
                  style={{ transform: trail.is_published ? "translateX(22px)" : "translateX(2px)" }}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Cover Image */}
        <Card>
          <CardHeader><CardTitle>Cover Image</CardTitle></CardHeader>
          <CardContent>
            <Label>Cover Image URL</Label>
            <Input
              value={trail.cover_image_url ?? ""}
              onChange={(e) => update("cover_image_url", e.target.value || null)}
              placeholder="https://..."
            />
            {trail.cover_image_url && (
              <img
                src={trail.cover_image_url}
                alt="Cover"
                className="mt-3 rounded-lg max-h-48 object-cover"
              />
            )}
          </CardContent>
        </Card>

        {/* Media */}
        {!isNew && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Trail Photos ({media.length})</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => document.getElementById("photo-upload")?.click()}
                >
                  {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  {uploading ? "Uploading..." : "Upload Photo"}
                </Button>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadPhoto(file);
                    e.target.value = "";
                  }}
                />
              </div>
            </CardHeader>
            <CardContent>
              {media.length === 0 ? (
                <p className="text-sm text-muted-foreground">No photos uploaded.</p>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {media.map((m) => (
                    <div key={m.id} className="relative group">
                      <img src={m.url} alt={m.caption ?? ""} className="rounded-lg aspect-square object-cover w-full" />
                      <button
                        onClick={() => deleteMedia(m.id)}
                        className="absolute top-1 right-1 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      {m.caption && <p className="text-xs text-muted-foreground mt-1 truncate">{m.caption}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Checkpoints */}
        {!isNew && (
          <Card>
            <CardHeader><CardTitle>Checkpoints ({checkpoints.length})</CardTitle></CardHeader>
            <CardContent>
              {checkpoints.length === 0 ? (
                <p className="text-sm text-muted-foreground">No checkpoints.</p>
              ) : (
                <div className="space-y-2">
                  {checkpoints.map((cp, i) => (
                    <div key={cp.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <span className="text-sm text-muted-foreground w-6">{i + 1}</span>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{cp.name_en}</p>
                        {cp.name_ka && <p className="text-xs text-muted-foreground">{cp.name_ka}</p>}
                      </div>
                      <Badge variant="outline">{cp.type}</Badge>
                      {cp.elevation_m && (
                        <span className="text-xs text-muted-foreground">{cp.elevation_m}m</span>
                      )}
                      <Badge variant={cp.is_checkable ? "default" : "secondary"}>
                        {cp.is_checkable ? "Checkable" : "Info"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
