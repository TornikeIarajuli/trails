const fs = require('fs');

const data = JSON.parse(fs.readFileSync('all_routes.json', 'utf8'));

// Check Truso Valley
const truso = data.found.find(r => r.name === 'Truso Valley');
if (truso) {
  console.log('Truso Valley:');
  console.log('  Keys:', Object.keys(truso));
  console.log('  Coords:', truso.coordinates ? truso.coordinates.length : 'N/A');
  console.log('  First 3:', truso.coordinates ? truso.coordinates.slice(0, 3) : 'N/A');

  // Count jumps in source data
  const coords = truso.coordinates;
  if (coords) {
    let jumps = 0;
    for (let i = 1; i < coords.length; i++) {
      const dx = coords[i][0] - coords[i - 1][0];
      const dy = coords[i][1] - coords[i - 1][1];
      if (Math.sqrt(dx * dx + dy * dy) > 0.005) jumps++;
    }
    console.log('  Jumps in source:', jumps);
  }
}

// Check all bad trails
const badNames = ['Gergeti Trinity Church', 'Omalo to Dartlo', 'Truso Valley', 'Martvili Canyon Trail',
  'Okatse Canyon Trail', 'Shatili to Mutso', 'Tobavarchkhili (Silver Lake)'];

console.log('\n=== Source data quality for bad trails ===');
for (const name of badNames) {
  const trail = data.found.find(r => r.name === name);
  if (!trail) { console.log(name, '- NOT in all_routes.json'); continue; }

  const coords = trail.coordinates;
  let jumps = 0;
  for (let i = 1; i < coords.length; i++) {
    const dx = coords[i][0] - coords[i - 1][0];
    const dy = coords[i][1] - coords[i - 1][1];
    if (Math.sqrt(dx * dx + dy * dy) > 0.005) jumps++;
  }
  console.log(`${name}: ${coords.length} coords, ${jumps} jumps`);
}
