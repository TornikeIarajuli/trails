/**
 * Discover ALL hiking route relations in Georgia from OpenStreetMap.
 * Queries Overpass API for route=hiking relations within Georgia's borders.
 * Filters out unnamed, planned, and already-seeded trails.
 * Outputs: discovered_trails.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Existing relation IDs already in our database (from fetch-all-routes.js and fetch-new-routes.js)
const EXISTING_RELATION_IDS = new Set([
  // Original 12 trails
  3817920, 13703284, 13703285, 10543218, 3740297, 15354522, 15354656,
  // New trails from fetch-new-routes.js
  3684676, 3671427, 2418279, 2418280, 2418278, 3720225, 10507483, 10507503,
  13078189, 15351445, 15352304, 15352496, 15378089, 15394285, 10507501,
  10544195, 11115965, 15650596, 14639513, 15398157, 15913814, 15913873,
  3817760, 12211128, 12211175, 13316316, 10485517, 10506208,
  14205880, 14224776,
  10543211, 10543228,
  3740332, 3740333, 3740346, 3740348, 3740353, 5576945,
  15081599, 14077975, 15658326, 15656924, 15656937, 15656966, 15407539,
  13712566, 15095553, 16098291, 15656895, 15656918,
  14078802, 15663075, 14884461, 14384533, 14384534,
  16050511, 6535360, 6535373, 6535480, 18231305, 18611857, 18611858,
  15670216, 19282454, 19282624, 19305836, 19307461,
  15412627, 15412745, 15413515, 17571018, 19024909,
  12411378,
  14195682,
  13703281, 13703282, 13703283, 14995924,
  18187273, 18193774, 18234609, 15429964, 15413585, 15656855, 19253361,
  18160416, 12354329,
]);

function fetchOverpass(query) {
  return new Promise((resolve, reject) => {
    const postData = `data=${encodeURIComponent(query)}`;
    const url = new URL(OVERPASS_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          if (data.includes('rate_limited') || data.includes('Too Many Requests') || data.includes('runtime error') || data.includes('Gateway')) {
            reject(new Error('RATE_LIMITED'));
          } else {
            reject(new Error(`Parse error: ${data.substring(0, 500)}`));
          }
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(query, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchOverpass(query);
    } catch (e) {
      if (i < maxRetries - 1) {
        const waitSec = (i + 1) * 20;
        console.log(`  Retrying in ${waitSec}s... (attempt ${i + 1}/${maxRetries})`);
        await sleep(waitSec * 1000);
      } else {
        throw e;
      }
    }
  }
}

async function main() {
  console.log('Discovering ALL hiking routes in Georgia from OSM...\n');

  // Query 1: Get all hiking route relations in Georgia (tags only, no geometry)
  const query = `
    [out:json][timeout:180];
    area["ISO3166-1"="GE"]->.georgia;
    (
      relation["route"="hiking"](area.georgia);
      relation["route"="foot"](area.georgia);
    );
    out tags;
  `;

  console.log('Querying Overpass API for hiking/foot routes in Georgia...');
  const result = await fetchWithRetry(query);

  if (!result.elements) {
    console.error('No elements returned from Overpass API');
    process.exit(1);
  }

  console.log(`\nTotal relations found: ${result.elements.length}\n`);

  // Filter and categorize
  const newTrails = [];
  const skipped = { unnamed: 0, existing: 0, planned: 0, duplicate: 0 };
  const seenNames = new Set();

  for (const el of result.elements) {
    const tags = el.tags || {};
    const relationId = el.id;

    // Skip existing
    if (EXISTING_RELATION_IDS.has(relationId)) {
      skipped.existing++;
      continue;
    }

    // Skip planned/proposed
    if (tags.state === 'proposed' || tags.state === 'planned' || tags['proposed:route']) {
      skipped.planned++;
      continue;
    }

    // Skip if name starts with "Planned"
    const rawName = tags['name:en'] || tags.name || '';
    if (rawName.toLowerCase().startsWith('planned')) {
      skipped.planned++;
      continue;
    }

    // Skip Abkhazia/Russian-only trails (Cyrillic names without Latin names, likely Abkhazia)
    const hasLatinName = /[a-zA-Z]/.test(rawName);
    const hasOnlyCyrillic = /^[\u0400-\u04FF\s\d.\-()]+$/.test(rawName);
    if (hasOnlyCyrillic && !tags['name:en']) {
      skipped.planned++;
      continue;
    }

    // Get name
    const nameEn = tags['name:en'] || tags.name || '';
    const nameKa = tags['name:ka'] || '';

    // Skip unnamed
    if (!nameEn && !nameKa) {
      skipped.unnamed++;
      continue;
    }

    // Skip duplicates by name
    const key = (nameEn || nameKa).toLowerCase().trim();
    if (seenNames.has(key)) {
      skipped.duplicate++;
      continue;
    }
    seenNames.add(key);

    newTrails.push({
      relationId,
      name_en: nameEn,
      name_ka: nameKa,
      network: tags.network || '',
      operator: tags.operator || '',
      distance: tags.distance || '',
      ascent: tags.ascent || '',
      descent: tags.descent || '',
      description: tags.description || tags['description:en'] || '',
    });
  }

  console.log('=== DISCOVERY RESULTS ===');
  console.log(`New trails to fetch: ${newTrails.length}`);
  console.log(`Skipped - already seeded: ${skipped.existing}`);
  console.log(`Skipped - unnamed: ${skipped.unnamed}`);
  console.log(`Skipped - planned/proposed: ${skipped.planned}`);
  console.log(`Skipped - duplicate names: ${skipped.duplicate}`);
  console.log('');

  // Sort by name
  newTrails.sort((a, b) => (a.name_en || a.name_ka).localeCompare(b.name_en || b.name_ka));

  // Print discovered trails
  newTrails.forEach((t, i) => {
    const name = t.name_en || t.name_ka;
    const dist = t.distance ? ` (${t.distance})` : '';
    console.log(`  ${(i + 1).toString().padStart(3)}. [${t.relationId}] ${name}${dist}`);
  });

  // Save
  const outputPath = path.join(__dirname, 'discovered_trails.json');
  fs.writeFileSync(outputPath, JSON.stringify(newTrails, null, 2));
  console.log(`\nSaved ${newTrails.length} trails to ${outputPath}`);
  console.log(`\nTotal trails after fetch: ${newTrails.length} new + ${EXISTING_RELATION_IDS.size} existing = ${newTrails.length + EXISTING_RELATION_IDS.size}`);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
