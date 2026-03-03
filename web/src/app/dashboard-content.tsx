"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mountain, Users, Trophy, Star } from "lucide-react";
import { getStats, getAnalyticsData } from "@/lib/actions";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Stats {
  trails: number;
  users: number;
  completions: number;
  reviews: number;
}

interface AnalyticsData {
  completionsPerWeek: { week: string; count: number }[];
  topTrails: { name: string; count: number }[];
  signupsPerMonth: { month: string; count: number }[];
}

export function DashboardContent() {
  const [stats, setStats] = useState<Stats>({ trails: 0, users: 0, completions: 0, reviews: 0 });
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getAnalyticsData()]).then(([s, a]) => {
      setStats(s);
      setAnalytics(a);
    }).finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Trails", value: stats.trails, icon: Mountain },
    { label: "Users", value: stats.users, icon: Users },
    { label: "Completions", value: stats.completions, icon: Trophy },
    { label: "Reviews", value: stats.reviews, icon: Star },
  ];

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      {/* Summary cards */}
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

      {/* Charts */}
      {!loading && analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Completions per week */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Completions per Week (last 8 weeks)</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.completionsPerWeek.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics.completionsPerWeek}>
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#66BB6A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* User signups per month */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Signups per Month (last 6 months)</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.signupsPerMonth.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics.signupsPerMonth}>
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#37474F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top 5 trails */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Top 5 Trails by Completions</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.topTrails.length === 0 ? (
                <p className="text-sm text-muted-foreground">No completions yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics.topTrails} layout="vertical">
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#546E7A" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
