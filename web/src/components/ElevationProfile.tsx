"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// points: [distance_m, elevation_m]
export function ElevationProfile({ points }: { points: [number, number][] }) {
  const data = points.map(([distance, elevation]) => ({ km: Math.round(distance / 10) / 100, m: elevation }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="km" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 12 }} unit=" km" />
        <YAxis dataKey="m" domain={["auto", "auto"]} tick={{ fontSize: 12 }} unit=" m" width={64} />
        <Tooltip formatter={(value) => [`${value} m`, "Elevation"]} labelFormatter={(km) => `${km} km`} />
        <Area type="monotone" dataKey="m" stroke="#546E7A" fill="#546E7A" fillOpacity={0.2} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
