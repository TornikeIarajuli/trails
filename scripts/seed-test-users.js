/**
 * Seed 50 test users with varied data:
 * - Profiles with bios and avatars
 * - Trail completions (varied counts)
 * - User follows (social graph)
 * - Trail reviews
 * - Trail bookmarks
 * - Trail conditions
 * - Badges (awarded based on completions)
 */

const https = require('https');

const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
if (!TOKEN) { console.error('Set SUPABASE_MGMT_TOKEN env var'); process.exit(1); }
const PROJECT = 'neoqkksermbixgeflwjd';

function dbQuery(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 201) resolve(JSON.parse(data));
        else reject(new Error(`DB ${res.statusCode}: ${data.substring(0, 500)}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Test user data ──
const TEST_USERS = [
  { username: 'nika_mountain', full_name: 'Nika Gelashvili', bio: 'Mountain lover from Tbilisi. Exploring every trail in Georgia.' },
  { username: 'mari_hiker', full_name: 'Mariam Kvaratskhelia', bio: 'Weekend warrior. Svaneti is my happy place.' },
  { username: 'giorgi_trek', full_name: 'Giorgi Beridze', bio: 'Trail runner & photographer. Ultra distances.' },
  { username: 'nino_adventure', full_name: 'Nino Tsitlidze', bio: 'Nature guide based in Mestia. Ask me about Svaneti!' },
  { username: 'dato_peaks', full_name: 'Davit Lomidze', bio: 'Summit collector. 40+ peaks and counting.' },
  { username: 'elene_trails', full_name: 'Elene Janelidze', bio: 'Slow hiking enthusiast. Its about the journey.' },
  { username: 'luka_wild', full_name: 'Luka Khmaladze', bio: 'Wildcamping & backpacking across the Caucasus.' },
  { username: 'ana_wander', full_name: 'Ana Dolidze', bio: 'Tusheti lover. Born in Omalo.' },
  { username: 'sandro_camp', full_name: 'Sandro Kiknadze', bio: 'Campfire stories and mountain views.' },
  { username: 'tamta_ridge', full_name: 'Tamta Meladze', bio: 'Ridge walking is my therapy. Kazbegi local.' },
  { username: 'irakli_snow', full_name: 'Irakli Chkonia', bio: 'Winter hiking specialist. Snow or shine.' },
  { username: 'salome_sun', full_name: 'Salome Goglidze', bio: 'Sunrise hiker. Early mornings, best views.' },
  { username: 'levan_climb', full_name: 'Levan Tsereteli', bio: 'Rock climber turned hiker. Vertical to horizontal.' },
  { username: 'keti_green', full_name: 'Ketevan Papashvili', bio: 'Botanist hiking through Georgian forests.' },
  { username: 'giga_summit', full_name: 'Giga Kvitsiani', bio: 'If theres a summit, Im going up.' },
  { username: 'maia_photo', full_name: 'Maia Shanidze', bio: 'Landscape photographer. Trails are my studio.' },
  { username: 'tornike_long', full_name: 'Tornike Gabashvili', bio: 'Long-distance trekker. TCT section hiker.' },
  { username: 'tamar_valley', full_name: 'Tamar Chakvetadze', bio: 'Valley walks and canyon lover.' },
  { username: 'zurab_rock', full_name: 'Zurab Nadiradze', bio: 'Geologist by day, hiker by weekend.' },
  { username: 'natia_star', full_name: 'Natia Khutsishvili', bio: 'Night hiker & stargazer. Dark sky seeker.' },
  { username: 'beka_fast', full_name: 'Beka Chikvaidze', bio: 'Trail running FKTs. Speed is freedom.' },
  { username: 'sopho_calm', full_name: 'Sopho Gorgadze', bio: 'Mindful hiking. One step at a time.' },
  { username: 'archil_map', full_name: 'Archil Avaliani', bio: 'Cartography nerd. I map trails for fun.' },
  { username: 'nana_bird', full_name: 'Nana Mchedlishvili', bio: 'Birdwatcher on trails. 200+ species spotted.' },
  { username: 'vakho_steep', full_name: 'Vakhtang Imerlishvili', bio: 'The steeper the better. Khevsureti fanatic.' },
  { username: 'medea_flow', full_name: 'Medea Mikeladze', bio: 'Following rivers and waterfalls through Georgia.' },
  { username: 'kakha_old', full_name: 'Kakha Tavadze', bio: 'Old school hiker. Paper maps only.' },
  { username: 'tinatin_sky', full_name: 'Tinatin Liluashvili', bio: 'Paraglider & hike-and-fly adventurer.' },
  { username: 'rezo_bear', full_name: 'Rezo Kvirkvelia', bio: 'Wildlife tracker. Seen bears twice!' },
  { username: 'lika_rain', full_name: 'Lika Chanturia', bio: 'Rain or shine, Im on the trail.' },
  { username: 'shota_tent', full_name: 'Shota Bakradze', bio: 'Tent life > hotel life. Multi-day treks.' },
  { username: 'nini_joy', full_name: 'Nini Darchiashvili', bio: 'Hiking with kids. Family adventures.' },
  { username: 'besik_pass', full_name: 'Besik Gagua', bio: 'Mountain pass collector. 30+ passes crossed.' },
  { username: 'maka_herbs', full_name: 'Maka Topuria', bio: 'Herbalist. I know every plant on the trail.' },
  { username: 'paata_drone', full_name: 'Paata Gvalia', bio: 'Drone pilot documenting Georgian trails.' },
  { username: 'ia_quiet', full_name: 'Ia Basilashvili', bio: 'Solo hiker. Silence is golden.' },
  { username: 'gela_dog', full_name: 'Gela Nonikashvili', bio: 'Hiking with my dog Max. He leads.' },
  { username: 'rusudan_art', full_name: 'Rusudan Kvachadze', bio: 'Plein air painter on mountain trails.' },
  { username: 'temur_ice', full_name: 'Temur Abashidze', bio: 'Ice climbing & winter mountaineering.' },
  { username: 'eka_flower', full_name: 'Eka Zhvania', bio: 'Spring hiking for wildflowers. Bloom chaser.' },
  { username: 'lado_bridge', full_name: 'Lado Iashvili', bio: 'Civil engineer who loves old bridges on trails.' },
  { username: 'dali_lake', full_name: 'Dali Surmanidze', bio: 'Lake bagging across Georgia. 15 alpine lakes done.' },
  { username: 'otari_wind', full_name: 'Otari Gureshidze', bio: 'Windy ridges and exposed scrambles.' },
  { username: 'maya_yoga', full_name: 'Maya Kankava', bio: 'Yoga at summits. Namaste at altitude.' },
  { username: 'nodar_cook', full_name: 'Nodar Chincharauli', bio: 'Camp chef. Best khinkali made at 3000m.' },
  { username: 'lia_sunrise', full_name: 'Lia Gachechiladze', bio: 'Chasing sunrises from Georgian summits.' },
  { username: 'david_expat', full_name: 'David Miller', bio: 'American expat exploring Georgian mountains.' },
  { username: 'emma_travel', full_name: 'Emma Schmidt', bio: 'German travel blogger. Georgia stole my heart.' },
  { username: 'alex_uk', full_name: 'Alex Thompson', bio: 'UK hiker comparing Lake District to Caucasus.' },
  { username: 'yuki_jp', full_name: 'Yuki Tanaka', bio: 'Japanese mountaineer. Georgia is incredible.' },
];

const CONDITION_TYPES = ['trail_clear', 'muddy', 'snow', 'fallen_tree', 'overgrown'];
const SEVERITIES = ['info', 'warning', 'danger'];

const REVIEW_COMMENTS = [
  'Amazing trail! The views were breathtaking.',
  'Well-marked and easy to follow. Highly recommend.',
  'Challenging but rewarding. Bring plenty of water.',
  'Beautiful wildflowers along the way in spring.',
  'The last section was tough but worth every step.',
  'Great for beginners. Family-friendly trail.',
  'Stunning views of the Caucasus mountains.',
  'A bit overgrown in places but still manageable.',
  'One of the best trails in Georgia!',
  'Perfect for a weekend getaway from Tbilisi.',
  'The river crossings were fun. Waterproof boots recommended.',
  'Saw wildlife on this trail - eagles and deer.',
  'Trail was in great condition. Recently maintained.',
  'Camped overnight at the lake. Magical experience.',
  'Tough elevation gain but the panorama at the top is unreal.',
  'Could use better signage in a few spots.',
  'Best fall colors I have seen in Georgia.',
  'The local guesthouse at the end was a nice bonus.',
  'Did this as a trail run. Fast and fun!',
  'Peaceful and quiet. Hardly saw anyone else.',
];

const CONDITION_DESCRIPTIONS = [
  'Trail is in great shape, recently cleared.',
  'Some muddy sections after recent rain.',
  'Snow patches above 2800m, crampons helpful.',
  'Fallen tree blocking the path near the bridge.',
  'Overgrown section about 2km from the start.',
  'All clear, beautiful conditions today.',
  'Wet and slippery in the forest section.',
  'Trail markers freshly painted.',
  'Small landslide near the pass, passable with care.',
  'River crossing higher than usual due to snowmelt.',
];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { return arr.slice().sort(() => Math.random() - 0.5); }
function uuid() {
  return 'b' + '0000000-0000-0000-0000-' + Math.random().toString(16).slice(2, 14).padEnd(12, '0');
}
function randomDate(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - rand(1, daysBack));
  d.setHours(rand(6, 18), rand(0, 59), rand(0, 59));
  return d.toISOString();
}

function escSql(s) { return s.replace(/'/g, "''"); }

(async () => {
  console.log('=== Seeding 50 Test Users ===\n');

  // Step 1: Get existing trail IDs
  console.log('Fetching trails...');
  const trails = await dbQuery("SELECT id, name_en, difficulty, region FROM trails WHERE is_published = true ORDER BY id");
  console.log(`  ${trails.length} trails available\n`);

  if (trails.length === 0) {
    console.log('ERROR: No trails found. Run seed.sql first.');
    return;
  }

  // Step 2: Get badge IDs
  console.log('Fetching badges...');
  let badges = [];
  try {
    badges = await dbQuery("SELECT id, key, category, threshold, region, difficulty FROM badges ORDER BY sort_order");
    console.log(`  ${badges.length} badges available\n`);
  } catch {
    console.log('  No badges table or no badges found\n');
  }

  // Step 3: Generate user IDs
  const userIds = TEST_USERS.map((_, i) => {
    const idx = (i + 1).toString().padStart(3, '0');
    return `b0000000-0000-0000-0000-000000000${idx}`;
  });

  // Step 4: Insert auth.users (50 users)
  console.log('Creating auth.users...');
  const authSql = TEST_USERS.map((u, i) => {
    const id = userIds[i];
    const email = `${u.username}@test.mikiritrails.com`;
    const created = randomDate(365);
    return `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('${id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${email}',
  '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012', '${created}', '${created}', '${created}',
  '{"provider":"email","providers":["email"]}',
  '{"username":"${u.username}","full_name":"${escSql(u.full_name)}"}')
ON CONFLICT (id) DO NOTHING`;
  }).join(';\n') + ';';

  try {
    await dbQuery(authSql);
    console.log('  auth.users created\n');
  } catch (e) {
    console.log(`  auth.users error: ${e.message.substring(0, 200)}\n`);
  }

  await sleep(1000);

  // Step 5: Update profiles with bio and avatar
  console.log('Updating profiles...');
  const profileSql = TEST_USERS.map((u, i) => {
    const id = userIds[i];
    const avatarSeed = u.username;
    const avatar = `https://api.dicebear.com/7.x/adventurer/png?seed=${avatarSeed}&size=128`;
    return `UPDATE profiles SET
      full_name = '${escSql(u.full_name)}',
      bio = '${escSql(u.bio)}',
      avatar_url = '${avatar}'
    WHERE id = '${id}'`;
  }).join(';\n') + ';';

  try {
    await dbQuery(profileSql);
    console.log('  Profiles updated\n');
  } catch (e) {
    console.log(`  Profile error: ${e.message.substring(0, 200)}\n`);
  }

  await sleep(1000);

  // Step 6: Trail completions (varied per user)
  console.log('Creating trail completions...');
  const completions = [];
  const userCompletionMap = new Map(); // userId -> [trailId, ...]

  for (let i = 0; i < TEST_USERS.length; i++) {
    const userId = userIds[i];
    // Some users are very active (10-15), some moderate (4-8), some new (1-3)
    let numCompletions;
    if (i < 5) numCompletions = rand(10, 15);       // power users
    else if (i < 20) numCompletions = rand(5, 9);    // active
    else if (i < 35) numCompletions = rand(2, 5);    // moderate
    else numCompletions = rand(1, 3);                  // newbies

    const userTrails = shuffle(trails).slice(0, Math.min(numCompletions, trails.length));
    const trailIds = userTrails.map(t => t.id);
    userCompletionMap.set(userId, trailIds);

    for (const trail of userTrails) {
      const elapsed = rand(1800, 28800); // 30 min to 8 hours
      const completedAt = randomDate(300);
      completions.push(
        `INSERT INTO trail_completions (user_id, trail_id, status, elapsed_seconds, completed_at)
         VALUES ('${userId}', '${trail.id}', 'approved', ${elapsed}, '${completedAt}')
         ON CONFLICT (user_id, trail_id) DO NOTHING`
      );
    }
  }

  // Batch completions in chunks
  const CHUNK = 25;
  for (let c = 0; c < completions.length; c += CHUNK) {
    const chunk = completions.slice(c, c + CHUNK).join(';\n') + ';';
    try {
      await dbQuery(chunk);
    } catch (e) {
      console.log(`  Completion chunk error: ${e.message.substring(0, 150)}`);
    }
  }
  console.log(`  ${completions.length} completions created\n`);

  await sleep(1000);

  // Step 7: Update total_trails_completed counts
  console.log('Updating completion counts...');
  try {
    await dbQuery(`
      UPDATE profiles p SET total_trails_completed = (
        SELECT COUNT(*) FROM trail_completions tc
        WHERE tc.user_id = p.id AND tc.status = 'approved'
      ) WHERE p.id = ANY(ARRAY[${userIds.map(id => `'${id}'`).join(',')}]::uuid[])
    `);
    console.log('  Counts updated\n');
  } catch (e) {
    console.log(`  Count error: ${e.message.substring(0, 150)}\n`);
  }

  await sleep(1000);

  // Step 8: User follows (social graph)
  console.log('Creating follow relationships...');
  const follows = [];
  for (let i = 0; i < TEST_USERS.length; i++) {
    const numFollows = rand(3, 10);
    const targets = shuffle(userIds.filter((_, j) => j !== i)).slice(0, numFollows);
    for (const targetId of targets) {
      follows.push(
        `INSERT INTO user_follows (follower_id, following_id) VALUES ('${userIds[i]}', '${targetId}') ON CONFLICT DO NOTHING`
      );
    }
  }

  for (let c = 0; c < follows.length; c += CHUNK) {
    const chunk = follows.slice(c, c + CHUNK).join(';\n') + ';';
    try {
      await dbQuery(chunk);
    } catch (e) {
      console.log(`  Follow chunk error: ${e.message.substring(0, 150)}`);
    }
  }
  console.log(`  ${follows.length} follow relationships created\n`);

  await sleep(1000);

  // Step 9: Trail reviews
  console.log('Creating trail reviews...');
  const reviews = [];
  for (let i = 0; i < TEST_USERS.length; i++) {
    const userId = userIds[i];
    const completedTrails = userCompletionMap.get(userId) || [];
    const numReviews = Math.min(rand(1, 4), completedTrails.length);
    const reviewTrails = shuffle(completedTrails).slice(0, numReviews);

    for (const trailId of reviewTrails) {
      const rating = rand(3, 5);
      const comment = escSql(pick(REVIEW_COMMENTS));
      const createdAt = randomDate(200);
      reviews.push(
        `INSERT INTO trail_reviews (user_id, trail_id, rating, comment, created_at)
         VALUES ('${userId}', '${trailId}', ${rating}, '${comment}', '${createdAt}')
         ON CONFLICT (user_id, trail_id) DO NOTHING`
      );
    }
  }

  for (let c = 0; c < reviews.length; c += CHUNK) {
    const chunk = reviews.slice(c, c + CHUNK).join(';\n') + ';';
    try {
      await dbQuery(chunk);
    } catch (e) {
      console.log(`  Review chunk error: ${e.message.substring(0, 150)}`);
    }
  }
  console.log(`  ${reviews.length} reviews created\n`);

  await sleep(1000);

  // Step 10: Trail bookmarks
  console.log('Creating bookmarks...');
  const bookmarks = [];
  for (let i = 0; i < TEST_USERS.length; i++) {
    const numBookmarks = rand(3, 12);
    const bookmarkTrails = shuffle(trails).slice(0, numBookmarks);
    for (const trail of bookmarkTrails) {
      bookmarks.push(
        `INSERT INTO trail_bookmarks (user_id, trail_id) VALUES ('${userIds[i]}', '${trail.id}') ON CONFLICT DO NOTHING`
      );
    }
  }

  for (let c = 0; c < bookmarks.length; c += CHUNK) {
    const chunk = bookmarks.slice(c, c + CHUNK).join(';\n') + ';';
    try {
      await dbQuery(chunk);
    } catch (e) {
      console.log(`  Bookmark chunk error: ${e.message.substring(0, 150)}`);
    }
  }
  console.log(`  ${bookmarks.length} bookmarks created\n`);

  await sleep(1000);

  // Step 11: Trail conditions (some users report conditions)
  console.log('Creating trail conditions...');
  const conditions = [];
  for (let i = 0; i < 20; i++) { // Only 20 users report conditions
    const userId = userIds[i];
    const completedTrails = userCompletionMap.get(userId) || [];
    if (completedTrails.length === 0) continue;
    const numReports = rand(1, 3);
    const reportTrails = shuffle(completedTrails).slice(0, numReports);

    for (const trailId of reportTrails) {
      const condType = pick(CONDITION_TYPES);
      const severity = condType === 'trail_clear' ? 'info' : pick(SEVERITIES);
      const desc = escSql(pick(CONDITION_DESCRIPTIONS));
      const reportedAt = randomDate(60);
      conditions.push(
        `INSERT INTO trail_conditions (trail_id, user_id, condition_type, severity, description, reported_at)
         VALUES ('${trailId}', '${userId}', '${condType}', '${severity}', '${desc}', '${reportedAt}')`
      );
    }
  }

  if (conditions.length > 0) {
    for (let c = 0; c < conditions.length; c += CHUNK) {
      const chunk = conditions.slice(c, c + CHUNK).join(';\n') + ';';
      try {
        await dbQuery(chunk);
      } catch (e) {
        console.log(`  Condition chunk error: ${e.message.substring(0, 150)}`);
      }
    }
  }
  console.log(`  ${conditions.length} condition reports created\n`);

  await sleep(1000);

  // Step 12: Award badges based on completions
  if (badges.length > 0) {
    console.log('Awarding badges...');
    const badgeInserts = [];

    for (let i = 0; i < TEST_USERS.length; i++) {
      const userId = userIds[i];
      const completedTrails = userCompletionMap.get(userId) || [];
      const numCompleted = completedTrails.length;

      // Get trail details for region/difficulty badges
      const completedTrailDetails = completedTrails.map(tid => trails.find(t => t.id === tid)).filter(Boolean);
      const regionCounts = {};
      const difficultyCounts = {};
      for (const t of completedTrailDetails) {
        regionCounts[t.region] = (regionCounts[t.region] || 0) + 1;
        difficultyCounts[t.difficulty] = (difficultyCounts[t.difficulty] || 0) + 1;
      }

      for (const badge of badges) {
        let earned = false;

        if (badge.category === 'completions' && badge.threshold) {
          earned = numCompleted >= badge.threshold;
        } else if (badge.category === 'region' && badge.region && badge.threshold) {
          earned = (regionCounts[badge.region] || 0) >= badge.threshold;
        } else if (badge.category === 'difficulty' && badge.difficulty && badge.threshold) {
          earned = (difficultyCounts[badge.difficulty] || 0) >= badge.threshold;
        }

        if (earned) {
          const earnedAt = randomDate(200);
          badgeInserts.push(
            `INSERT INTO user_badges (user_id, badge_id, earned_at)
             VALUES ('${userId}', '${badge.id}', '${earnedAt}')
             ON CONFLICT (user_id, badge_id) DO NOTHING`
          );
        }
      }
    }

    for (let c = 0; c < badgeInserts.length; c += CHUNK) {
      const chunk = badgeInserts.slice(c, c + CHUNK).join(';\n') + ';';
      try {
        await dbQuery(chunk);
      } catch (e) {
        console.log(`  Badge chunk error: ${e.message.substring(0, 150)}`);
      }
    }
    console.log(`  ${badgeInserts.length} badges awarded\n`);
  }

  // ── Final verification ──
  console.log('=== Verification ===');
  await sleep(500);

  const profileCount = await dbQuery("SELECT COUNT(*) as cnt FROM profiles WHERE id LIKE 'b0000000%'");
  console.log(`Profiles: ${profileCount[0]?.cnt ?? 0}`);

  const compCount = await dbQuery("SELECT COUNT(*) as cnt FROM trail_completions WHERE user_id LIKE 'b0000000%'");
  console.log(`Completions: ${compCount[0]?.cnt ?? 0}`);

  const followCount = await dbQuery("SELECT COUNT(*) as cnt FROM user_follows WHERE follower_id LIKE 'b0000000%'");
  console.log(`Follows: ${followCount[0]?.cnt ?? 0}`);

  const reviewCount = await dbQuery("SELECT COUNT(*) as cnt FROM trail_reviews WHERE user_id LIKE 'b0000000%'");
  console.log(`Reviews: ${reviewCount[0]?.cnt ?? 0}`);

  const bookmarkCount = await dbQuery("SELECT COUNT(*) as cnt FROM trail_bookmarks WHERE user_id LIKE 'b0000000%'");
  console.log(`Bookmarks: ${bookmarkCount[0]?.cnt ?? 0}`);

  const condCount = await dbQuery("SELECT COUNT(*) as cnt FROM trail_conditions WHERE user_id LIKE 'b0000000%'");
  console.log(`Conditions: ${condCount[0]?.cnt ?? 0}`);

  let badgeCount = { cnt: 0 };
  try {
    const bc = await dbQuery("SELECT COUNT(*) as cnt FROM user_badges WHERE user_id LIKE 'b0000000%'");
    badgeCount = bc[0] || { cnt: 0 };
  } catch {}
  console.log(`Badges: ${badgeCount.cnt}`);

  console.log('\nDone!');
})();
