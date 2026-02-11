const https = require('https');

function query(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      path: '/v1/projects/neoqkksermbixgeflwjd/database/query',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer sbp_d7fb4d25309b19b810d54f35ae582452ee68c7fc',
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  const trails = await query('SELECT id, name_en, ST_NPoints(route) as pts, ST_AsText(route) as wkt FROM trails ORDER BY id');
  let bad = 0;
  let good = 0;

  for (const t of trails) {
    const wkt = t.wkt;
    if (!wkt) { console.log(t.id.slice(-3), 'NO ROUTE'); continue; }

    const coords = wkt.replace('LINESTRING(', '').replace(')', '').split(',').map(p => {
      const [lon, lat] = p.trim().split(' ');
      return [parseFloat(lon), parseFloat(lat)];
    });

    let jumps = 0;
    for (let i = 1; i < coords.length; i++) {
      const dx = coords[i][0] - coords[i - 1][0];
      const dy = coords[i][1] - coords[i - 1][1];
      if (Math.sqrt(dx * dx + dy * dy) > 0.005) jumps++;
    }

    if (jumps > 5) {
      bad++;
      console.log(t.id.slice(-3), t.name_en.substring(0, 40).padEnd(41), jumps, 'jumps', '(' + t.pts + 'pts)');
    } else {
      good++;
    }
  }

  console.log('\nGood routes:', good);
  console.log('Bad routes (>5 jumps):', bad);
})();
