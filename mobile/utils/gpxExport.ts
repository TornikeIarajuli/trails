import { GpsPoint } from '../store/hikeStore';

export function buildGpxString(trailName: string, points: GpsPoint[]): string {
  const trkpts = points
    .map((p) => {
      const time = new Date(p.timestamp).toISOString();
      return `    <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">
      <time>${time}</time>
    </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Georgia Trails App"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <trk>
    <name>${escapeXml(trailName)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
