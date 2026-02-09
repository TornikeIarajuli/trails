/**
 * Creates test auth users in Supabase with matching UUIDs for seed data.
 * The seed.sql inserts profiles referencing these UUIDs.
 *
 * Usage: npx ts-node scripts/create-test-users.ts
 */

const SUPABASE_URL = 'https://neoqkksermbixgeflwjd.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lb3Fra3Nlcm1iaXhnZWZsd2pkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDU2MDg2OSwiZXhwIjoyMDg2MTM2ODY5fQ.XkSfkxwImnuS_khlxdh2xmtZgowHnt-S4B-wVAOkMvQ';

const TEST_USERS = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    email: 'nika@test.georgiatrails.app',
    password: 'testpass123',
    username: 'mountain_nika',
    full_name: 'Nika Gelashvili',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    email: 'mari@test.georgiatrails.app',
    password: 'testpass123',
    username: 'hiking_mari',
    full_name: 'Mariam Kvaratskhelia',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000003',
    email: 'giorgi@test.georgiatrails.app',
    password: 'testpass123',
    username: 'george_adventures',
    full_name: 'Giorgi Beridze',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000004',
    email: 'teona@test.georgiatrails.app',
    password: 'testpass123',
    username: 'tea_on_trail',
    full_name: 'Teona Mikadze',
  },
];

async function createUser(user: typeof TEST_USERS[0]) {
  // First try to delete existing user with this ID
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
  });

  // Create with specific UUID
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: user.id,
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        username: user.username,
        full_name: user.full_name,
      },
    }),
  });

  const data: any = await res.json();

  if (!res.ok) {
    console.error(`  ✗ ${user.username}: ${data.msg || data.message || JSON.stringify(data)}`);
    return false;
  }

  console.log(`  ✓ ${user.username} (${user.email}) — ID: ${data.id}`);
  return true;
}

async function main() {
  console.log('Creating test users in Supabase...\n');

  let success = 0;
  for (const user of TEST_USERS) {
    const ok = await createUser(user);
    if (ok) success++;
  }

  console.log(`\nDone: ${success}/${TEST_USERS.length} users created.`);
  console.log('\nTest credentials (all use password: testpass123):');
  for (const u of TEST_USERS) {
    console.log(`  ${u.email} — ${u.full_name}`);
  }
  console.log('\nNow run the seed SQL to populate profiles and completions.');
}

main().catch(console.error);
