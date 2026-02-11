"use client";

import { useEffect, useState, use } from "react";
import { createAdminClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  total_trails_completed: number;
  created_at: string;
}

interface Completion {
  id: string;
  trail_id: string;
  status: string;
  elapsed_seconds: number | null;
  completed_at: string;
  trails: { name_en: string; difficulty: string } | null;
}

interface UserBadge {
  id: string;
  earned_at: string;
  badges: { name_en: string; icon: string; category: string } | null;
}

export function UserDetail({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createAdminClient();
      const { data: p } = await supabase.from("profiles").select("*").eq("id", id).single();
      setProfile(p);

      const { data: c } = await supabase
        .from("trail_completions")
        .select("id, trail_id, status, elapsed_seconds, completed_at, trails(name_en, difficulty)")
        .eq("user_id", id)
        .order("completed_at", { ascending: false });
      setCompletions((c ?? []) as unknown as Completion[]);

      const { data: b } = await supabase
        .from("user_badges")
        .select("id, earned_at, badges(name_en, icon, category)")
        .eq("user_id", id);
      setBadges((b ?? []) as unknown as UserBadge[]);

      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    const supabase = createAdminClient();
    const { error } = await supabase.from("profiles").update({
      username: profile.username,
      full_name: profile.full_name || null,
      bio: profile.bio || null,
      avatar_url: profile.avatar_url || null,
    }).eq("id", id);

    if (error) alert(`Error: ${error.message}`);
    else alert("Profile saved!");
    setSaving(false);
  }

  function formatDuration(seconds: number | null) {
    if (!seconds) return "-";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!profile) return <p>User not found</p>;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/users">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <Avatar className="h-10 w-10">
          {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
          <AvatarFallback>{profile.username[0].toUpperCase()}</AvatarFallback>
        </Avatar>
        <h2 className="text-2xl font-bold flex-1">{profile.username}</h2>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Username</Label>
                <Input value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} />
              </div>
              <div>
                <Label>Full Name</Label>
                <Input value={profile.full_name ?? ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value || null })} />
              </div>
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea rows={3} value={profile.bio ?? ""} onChange={(e) => setProfile({ ...profile, bio: e.target.value || null })} />
            </div>
            <div>
              <Label>Avatar URL</Label>
              <Input value={profile.avatar_url ?? ""} onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value || null })} />
            </div>
            <div className="text-sm text-muted-foreground">
              Joined: {new Date(profile.created_at).toLocaleDateString()} &middot; Trails completed: {profile.total_trails_completed}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Badges ({badges.length})</CardTitle></CardHeader>
          <CardContent>
            {badges.length === 0 ? (
              <p className="text-sm text-muted-foreground">No badges earned.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {badges.map((b) => (
                  <Badge key={b.id} variant="outline" className="gap-1">
                    <span>{b.badges?.icon}</span>
                    {b.badges?.name_en ?? "Badge"}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Trail Completions ({completions.length})</CardTitle></CardHeader>
          <CardContent>
            {completions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completions.</p>
            ) : (
              <div className="space-y-2">
                {completions.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-2 border rounded">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{c.trails?.name_en ?? "Unknown trail"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.completed_at).toLocaleDateString()} &middot; {formatDuration(c.elapsed_seconds)}
                      </p>
                    </div>
                    <Badge variant={c.status === "approved" ? "default" : "secondary"}>
                      {c.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
