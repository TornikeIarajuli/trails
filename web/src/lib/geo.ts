import type { Checkpoint } from "./types";

// trail_checkpoints.coordinates arrives as a GeoJSON Point ([lng, lat])
export function checkpointPosition(cp: Pick<Checkpoint, "coordinates">): { lat: number; lng: number } | null {
  const point: unknown = cp.coordinates?.coordinates;
  if (!Array.isArray(point)) return null;
  const [lng, lat] = point;
  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
}
