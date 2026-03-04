#!/usr/bin/env node
/**
 * check-migrations.js
 * Compares local migration files against the schema_migrations table in Supabase.
 * Shows which migrations are pending (not yet applied to the database).
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/check-migrations.js
 *
 * Or add to package.json scripts:
 *   "check-migrations": "node scripts/check-migrations.js"
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

async function fetchApplied() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/schema_migrations?select=version,applied_at,description&order=version`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    },
  );
  if (!res.ok) {
    const text = await res.text();
    // Table might not exist yet (migration 028 not yet applied)
    if (text.includes('schema_migrations') && text.includes('does not exist')) {
      return null;
    }
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }
  return res.json();
}

function getLocalVersions() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => {
      const version = f.replace(/^0+/, '').split('_')[0]; // "007_..." → "7" → normalize
      const paddedVersion = f.split('_')[0].replace(/^0+/, ''); // strip leading zeros
      return {
        file: f,
        version: paddedVersion || '0',
        description: f.replace(/^\d+_/, '').replace(/\.sql$/, ''),
      };
    });
}

async function main() {
  const local = getLocalVersions();

  let applied;
  try {
    applied = await fetchApplied();
  } catch (e) {
    console.error('Failed to query schema_migrations:', e.message);
    process.exit(1);
  }

  if (applied === null) {
    console.log('\n⚠️  schema_migrations table does not exist yet.');
    console.log('   Run migration 028_schema_migrations.sql first.\n');
    console.log('All local migrations:');
    local.forEach((m) => console.log(`  ${m.file}`));
    return;
  }

  const appliedVersions = new Set(applied.map((r) => r.version));

  const pending = local.filter((m) => !appliedVersions.has(m.version));
  const applied_local = local.filter((m) => appliedVersions.has(m.version));

  console.log(`\n✅ Applied (${applied_local.length}):`);
  applied_local.forEach((m) => {
    const rec = applied.find((r) => r.version === m.version);
    const date = rec ? new Date(rec.applied_at).toLocaleDateString() : '?';
    console.log(`   ${m.file}  [${date}]`);
  });

  if (pending.length === 0) {
    console.log('\n🎉 All migrations applied. Database is up to date.\n');
  } else {
    console.log(`\n⏳ Pending (${pending.length}) — run these in Supabase SQL editor:`);
    pending.forEach((m) => console.log(`   ➜  ${m.file}`));
    console.log();
    process.exit(1); // non-zero so CI can catch it
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
