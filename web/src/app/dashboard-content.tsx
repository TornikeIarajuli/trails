"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mountain, Users, Trophy, Star } from "lucide-react";
import { getStats } from "@/lib/actions";

interface Stats {
  trails: number;
  users: number;
  completions: number;
  reviews: number;
}

export function DashboardContent() {
  const [stats, setStats] = useState<Stats>({ trails: 0, users: 0, completions: 0, reviews: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats().then(setStats).finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Trails", value: stats.trails, icon: Mountain },
    { label: "Users", value: stats.users, icon: Users },
    { label: "Completions", value: stats.completions, icon: Trophy },
    { label: "Reviews", value: stats.reviews, icon: Star },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? "..." : c.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
