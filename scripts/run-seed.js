/**
 * Runs the seed data against Supabase using the JS client (PostgREST).
 * No need for a direct DB connection or psql.
 *
 * Usage: node scripts/run-seed.js
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://neoqkksermbixgeflwjd.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lb3Fra3Nlcm1iaXhnZWZsd2pkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDU2MDg2OSwiZXhwIjoyMDg2MTM2ODY5fQ.XkSfkxwImnuS_khlxdh2xmtZgowHnt-S4B-wVAOkMvQ';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ─── Trail Data ───
const trails = [
  { id: 'a0000000-0000-0000-0000-000000000001', name_en: 'Gergeti Trinity Church', name_ka: 'გერგეტის სამება', description_en: 'Iconic hike to the 14th-century Gergeti Trinity Church perched at 2,170m with stunning views of Mount Kazbek.', description_ka: 'საგზაო ბილიკი გერგეტის სამების ეკლესიამდე.', difficulty: 'easy', region: 'Kazbegi', distance_km: 6, elevation_gain_m: 500, estimated_hours: 2.5, cover_image_url: 'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=800', is_published: true },
  { id: 'a0000000-0000-0000-0000-000000000002', name_en: 'Mestia to Ushguli Trek', name_ka: 'მესტიიდან უშგულამდე', description_en: 'Multi-day trek through Upper Svaneti, passing medieval Svan towers and glacier-fed rivers.', description_ka: 'მრავალდღიანი ლაშქრობა ზემო სვანეთში.', difficulty: 'hard', region: 'Svaneti', distance_km: 58, elevation_gain_m: 3200, estimated_hours: 28, cover_image_url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', is_published: true },
  { id: 'a0000000-0000-0000-0000-000000000003', name_en: 'Juta to Roshka (Abudelauri Lakes)', name_ka: 'ჯუთადან როშკამდე', description_en: 'High-alpine crossing via colorful Abudelauri Lakes at 3,000m. Crosses Chaukhi Pass at 3,338m.', description_ka: 'მაღალმთიანი გადასასვლელი აბუდელაურის ტბებით.', difficulty: 'hard', region: 'Kazbegi', distance_km: 26, elevation_gain_m: 1800, estimated_hours: 10, cover_image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', is_published: true },
  { id: 'a0000000-0000-0000-0000-000000000004', name_en: 'Omalo to Dartlo', name_ka: 'ომალოდან დართლომდე', description_en: 'Beautiful day hike through remote Tusheti connecting two medieval fortress villages.', description_ka: 'ლაშქრობა თუშეთის რეგიონში.', difficulty: 'medium', region: 'Tusheti', distance_km: 14, elevation_gain_m: 650, estimated_hours: 5, cover_image_url: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', is_published: true },
  { id: 'a0000000-0000-0000-0000-000000000005', name_en: 'Truso Valley', name_ka: 'თრუსოს ხეობა', description_en: 'Scenic valley walk along the Terek River past travertine pools and abandoned villages.', description_ka: 'ხეობის გასეირნება თერგის მდინარის გასწვრივ.', difficulty: 'easy', region: 'Kazbegi', distance_km: 24, elevation_gain_m: 400, estimated_hours: 6, cover_image_url: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800', is_published: true },
  { id: 'a0000000-0000-0000-0000-000000000006', name_en: 'Lagodekhi Waterfall Trail', name_ka: 'ლაგოდეხის ჩანჩქერი', description_en: 'Easy nature walk through old-growth forest to a beautiful waterfall in Lagodekhi Protected Areas.', description_ka: 'ბუნების გასეირნება ლაგოდეხში.', difficulty: 'easy', region: 'Kakheti', distance_km: 14, elevation_gain_m: 300, estimated_hours: 4, cover_image_url: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800', is_published: true },
  { id: 'a0000000-0000-0000-0000-000000000007', name_en: 'Borjomi-Kharagauli: Likani Trail', name_ka: 'ბორჯომ-ხარაგაული: ლიკანი', description_en: "Day hike in one of Europe's largest national parks through mixed forests to alpine meadows.", description_ka: 'ლაშქრობა ეროვნულ პარკში.', difficulty: 'medium', region: 'Borjomi-Kharagauli', distance_km: 18, elevation_gain_m: 1100, estimated_hours: 7, cover_image_url: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800', is_published: true },
  { id: 'a0000000-0000-0000-0000-000000000008', name_en: 'Chaukhi Pass', name_ka: 'ჩაუხის უღელტეხილი', description_en: 'Challenging high-altitude pass crossing at 3,338m with dramatic rock spires.', description_ka: 'მაღალმთიანი უღელტეხილი 3,338 მ-ზე.', difficulty: 'ultra', region: 'Kazbegi', distance_km: 16, elevation_gain_m: 1500, estimated_hours: 9, cover_image_url: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800', is_published: true },
  { id: 'a0000000-0000-0000-0000-000000000009', name_en: 'Martvili Canyon Trail', name_ka: 'მარტვილის კანიონი', description_en: 'Short but stunning walk along the turquoise Abasha River canyon with cliff walkways.', description_ka: 'აბაშის მდინარის კანიონის გასეირნება.', difficulty: 'easy', region: 'Samegrelo', distance_km: 3, elevation_gain_m: 50, estimated_hours: 1, cover_image_url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800', is_published: true },
  { id: 'a0000000-0000-0000-0000-000000000010', name_en: 'Okatse Canyon Trail', name_ka: 'ოკაცეს კანიონი', description_en: 'Thrilling walk on a metal walkway suspended over the 100m deep Okatse Canyon.', description_ka: 'ოკაცეს კანიონზე გაკიდებული ლითონის ბილიკი.', difficulty: 'easy', region: 'Imereti', distance_km: 7, elevation_gain_m: 200, estimated_hours: 2.5, cover_image_url: 'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800', is_published: true },
  { id: 'a0000000-0000-0000-0000-000000000011', name_en: 'Shatili to Mutso', name_ka: 'შატილიდან მუწომდე', description_en: 'Remote trek in Khevsureti connecting two medieval fortress villages through the Argun Gorge.', description_ka: 'ლაშქრობა ხევსურეთში.', difficulty: 'hard', region: 'Khevsureti', distance_km: 12, elevation_gain_m: 800, estimated_hours: 5, cover_image_url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', is_published: true },
  { id: 'a0000000-0000-0000-0000-000000000012', name_en: 'Tobavarchkhili (Silver Lake)', name_ka: 'ტობავარჩხილი', description_en: 'Multi-day expedition to the legendary Silver Lake hidden in remote forests west of Kutaisi.', description_ka: 'ექსპედიცია ვერცხლის ტბამდე.', difficulty: 'ultra', region: 'Samegrelo', distance_km: 44, elevation_gain_m: 2800, estimated_hours: 24, cover_image_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', is_published: true },
];

// ─── Media Data ───
const imgUrls = [
  'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=600',
  'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
  'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600',
  'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=600',
  'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=600',
  'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
  'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=600',
  'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600',
  'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=600',
];

function buildMedia() {
  const media = [];
  let mediaNum = 1;
  trails.forEach((t, i) => {
    for (let j = 0; j < 3; j++) {
      media.push({
        id: `c0000000-0000-0000-0000-${String(mediaNum).padStart(12, '0')}`,
        trail_id: t.id,
        type: 'photo',
        url: imgUrls[(i * 3 + j) % imgUrls.length],
        caption: `${t.name_en} - Photo ${j + 1}`,
        sort_order: j,
      });
      mediaNum++;
    }
  });
  return media;
}

// ─── Checkpoint Data ───
const cpTypes = ['viewpoint', 'landmark', 'water_source', 'church', 'lake', 'waterfall', 'summit', 'bridge', 'ruins', 'pass'];

function buildCheckpoints() {
  const checkpoints = [];
  let cpNum = 1;
  const trailCpNames = {
    'a0000000-0000-0000-0000-000000000001': [{ name: 'Mountain Viewpoint', type: 'viewpoint' }, { name: 'Trinity Church', type: 'church' }],
    'a0000000-0000-0000-0000-000000000002': [{ name: 'Zhabeshi Village', type: 'landmark' }, { name: 'Adishi Glacier', type: 'landmark' }, { name: 'Iprali Bridge', type: 'bridge' }],
    'a0000000-0000-0000-0000-000000000003': [{ name: 'Blue Lake', type: 'lake' }, { name: 'Green Lake', type: 'lake' }, { name: 'Chaukhi Pass Top', type: 'pass' }],
    'a0000000-0000-0000-0000-000000000004': [{ name: 'Kvavlo Tower', type: 'ruins' }, { name: 'Dartlo Fortress', type: 'ruins' }],
    'a0000000-0000-0000-0000-000000000005': [{ name: 'Travertine Pools', type: 'water_source' }, { name: 'Abandoned Village', type: 'ruins' }],
    'a0000000-0000-0000-0000-000000000006': [{ name: 'Forest Viewpoint', type: 'viewpoint' }, { name: 'Lagodekhi Waterfall', type: 'waterfall' }],
    'a0000000-0000-0000-0000-000000000007': [{ name: 'Likani Ridge View', type: 'viewpoint' }, { name: 'Alpine Meadow Camp', type: 'landmark' }],
    'a0000000-0000-0000-0000-000000000008': [{ name: 'Chaukhi Rock Spires', type: 'landmark' }, { name: 'Summit Pass', type: 'summit' }],
    'a0000000-0000-0000-0000-000000000009': [{ name: 'Canyon Entrance', type: 'landmark' }, { name: 'Turquoise Pool', type: 'water_source' }],
    'a0000000-0000-0000-0000-000000000010': [{ name: 'Suspended Walkway Start', type: 'landmark' }, { name: 'Canyon Overlook', type: 'viewpoint' }],
    'a0000000-0000-0000-0000-000000000011': [{ name: 'Shatili Towers', type: 'ruins' }, { name: 'Argun Gorge View', type: 'viewpoint' }, { name: 'Mutso Fortress', type: 'ruins' }],
    'a0000000-0000-0000-0000-000000000012': [{ name: 'Forest Camp', type: 'landmark' }, { name: 'Alpine Lake View', type: 'viewpoint' }, { name: 'Silver Lake', type: 'lake' }],
  };

  for (const trail of trails) {
    const cps = trailCpNames[trail.id] || [];
    cps.forEach((cp, j) => {
      checkpoints.push({
        id: `d0000000-0000-0000-0000-${String(cpNum).padStart(12, '0')}`,
        trail_id: trail.id,
        name_en: cp.name,
        name_ka: null,
        description_en: `${cp.name} on ${trail.name_en}`,
        description_ka: null,
        type: cp.type,
        elevation_m: 1500 + Math.floor(Math.random() * 1500),
        photo_url: imgUrls[cpNum % imgUrls.length],
        sort_order: j,
        is_checkable: true,
      });
      cpNum++;
    });
  }
  return checkpoints;
}

// ─── User Profiles ───
const testUsers = [
  { id: 'b0000000-0000-0000-0000-000000000001', username: 'mountain_nika', full_name: 'Nika Gelashvili', bio: 'Mountain enthusiast from Tbilisi. Conquered 50+ peaks across the Caucasus.', total_trails_completed: 6 },
  { id: 'b0000000-0000-0000-0000-000000000002', username: 'hiking_mari', full_name: 'Mariam Kvaratskhelia', bio: 'Nature photographer and trail runner. Svaneti is my second home.', total_trails_completed: 5 },
  { id: 'b0000000-0000-0000-0000-000000000003', username: 'george_adventures', full_name: 'Giorgi Beridze', bio: 'Weekend warrior. Exploring every corner of Georgia one trail at a time.', total_trails_completed: 4 },
  { id: 'b0000000-0000-0000-0000-000000000004', username: 'tea_on_trail', full_name: 'Teona Mikadze', bio: 'Slow hiker, fast photographer. Always carry tea to the summit.', total_trails_completed: 3 },
];

// ─── Completions ───
function buildCompletions() {
  const completions = [];
  const userTrails = {
    'b0000000-0000-0000-0000-000000000001': [0, 1, 2, 4, 7, 10],   // 6 trails
    'b0000000-0000-0000-0000-000000000002': [0, 1, 3, 5, 8],        // 5 trails
    'b0000000-0000-0000-0000-000000000003': [0, 4, 9, 10],          // 4 trails
    'b0000000-0000-0000-0000-000000000004': [0, 5, 6],              // 3 trails
  };

  for (const [userId, trailIdxs] of Object.entries(userTrails)) {
    for (const idx of trailIdxs) {
      const daysAgo = Math.floor(Math.random() * 180) + 1;
      completions.push({
        user_id: userId,
        trail_id: trails[idx].id,
        proof_photo_url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400',
        photo_lat: 42.0 + Math.random() * 1.0,
        photo_lng: 43.0 + Math.random() * 3.0,
        status: 'approved',
        completed_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
      });
    }
  }
  return completions;
}

// ─── Reviews ───
function buildReviews() {
  const reviews = [];
  const comments = [
    'Amazing trail! Views are breathtaking.',
    'Well-maintained path, highly recommend.',
    'Challenging but rewarding. Bring water.',
    'One of the best hikes in Georgia!',
    'Beautiful scenery, moderate difficulty.',
    'Perfect weekend hike.',
  ];
  const userTrails = {
    'b0000000-0000-0000-0000-000000000001': [0, 1, 2],
    'b0000000-0000-0000-0000-000000000002': [0, 3, 5],
    'b0000000-0000-0000-0000-000000000003': [0, 4, 9],
    'b0000000-0000-0000-0000-000000000004': [0, 5, 6],
  };

  for (const [userId, trailIdxs] of Object.entries(userTrails)) {
    for (const idx of trailIdxs) {
      reviews.push({
        user_id: userId,
        trail_id: trails[idx].id,
        rating: 3 + Math.floor(Math.random() * 3),
        comment: comments[Math.floor(Math.random() * comments.length)],
      });
    }
  }
  return reviews;
}

// ─── Main ───
async function main() {
  console.log('Seeding Georgia Trails database...\n');

  // 1. Delete existing data (order matters for FK constraints)
  console.log('Clearing existing data...');
  for (const table of ['trail_reviews', 'trail_completions', 'checkpoint_completions', 'trail_checkpoints', 'trail_media']) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.error(`  Warning deleting ${table}:`, error.message);
    else console.log(`  Cleared ${table}`);
  }
  // Delete trails last
  const { error: trailDelErr } = await supabase.from('trails').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (trailDelErr) console.error('  Warning deleting trails:', trailDelErr.message);
  else console.log('  Cleared trails');

  // 2. Insert trails (without geometry — PostgREST can't handle PostGIS functions)
  console.log('\nInserting 12 trails...');
  const { error: trailErr } = await supabase.from('trails').insert(trails);
  if (trailErr) {
    console.error('  ERROR inserting trails:', trailErr.message);
    return;
  }
  console.log('  Done — 12 trails inserted');

  // 3. Insert media
  const media = buildMedia();
  console.log(`\nInserting ${media.length} trail media entries...`);
  const { error: mediaErr } = await supabase.from('trail_media').insert(media);
  if (mediaErr) console.error('  ERROR:', mediaErr.message);
  else console.log('  Done');

  // 4. Insert checkpoints
  const checkpoints = buildCheckpoints();
  console.log(`\nInserting ${checkpoints.length} checkpoints...`);
  const { error: cpErr } = await supabase.from('trail_checkpoints').insert(checkpoints);
  if (cpErr) console.error('  ERROR:', cpErr.message);
  else console.log('  Done');

  // 5. Upsert user profiles
  console.log('\nUpserting 4 test user profiles...');
  const { error: profileErr } = await supabase.from('profiles').upsert(testUsers, { onConflict: 'id' });
  if (profileErr) console.error('  ERROR:', profileErr.message);
  else console.log('  Done');

  // 6. Insert completions
  const completions = buildCompletions();
  console.log(`\nInserting ${completions.length} trail completions...`);
  const { error: compErr } = await supabase.from('trail_completions').insert(completions);
  if (compErr) console.error('  ERROR:', compErr.message);
  else console.log('  Done');

  // 7. Insert reviews
  const reviews = buildReviews();
  console.log(`\nInserting ${reviews.length} trail reviews...`);
  const { error: revErr } = await supabase.from('trail_reviews').insert(reviews);
  if (revErr) console.error('  ERROR:', revErr.message);
  else console.log('  Done');

  // 8. Verify
  console.log('\n--- Verification ---');
  const { count: trailCount } = await supabase.from('trails').select('*', { count: 'exact', head: true });
  const { count: mediaCount } = await supabase.from('trail_media').select('*', { count: 'exact', head: true });
  const { count: cpCount } = await supabase.from('trail_checkpoints').select('*', { count: 'exact', head: true });
  const { count: compCount } = await supabase.from('trail_completions').select('*', { count: 'exact', head: true });
  const { count: revCount } = await supabase.from('trail_reviews').select('*', { count: 'exact', head: true });
  const { count: profileCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  console.log(`  Trails: ${trailCount}`);
  console.log(`  Media: ${mediaCount}`);
  console.log(`  Checkpoints: ${cpCount}`);
  console.log(`  Completions: ${compCount}`);
  console.log(`  Reviews: ${revCount}`);
  console.log(`  Profiles: ${profileCount}`);
  console.log('\nSeed complete!');
}

main().catch(console.error);
