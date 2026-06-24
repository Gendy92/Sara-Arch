#!/usr/bin/env node
/**
 * Automated migration runner.
 *
 * Reads migration_*.sql files from the repo root, sorts them by version,
 * and applies any that are not yet recorded in the schema_migrations table.
 *
 * Required environment variables:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/run-migrations.js
 */

import { createClient } from '@supabase/supabase-js';
import { readdirSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { enabled: false }
});

function extractVersion(filename) {
  const match = filename.match(/^migration_v(\d+)_.+\.sql$/);
  return match ? parseInt(match[1], 10) : null;
}

async function main() {
  const files = readdirSync(ROOT)
    .filter(f => f.startsWith('migration_') && f.endsWith('.sql'))
    .map(f => ({ name: f, version: extractVersion(f) }))
    .filter(f => f.version !== null)
    .sort((a, b) => a.version - b.version);

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  console.log(`Found ${files.length} migration file(s).`);

  for (const { name, version } of files) {
    const sql = readFileSync(join(ROOT, name), 'utf8');
    process.stdout.write(`Applying ${name} ... `);

    const { error } = await supabase.rpc('apply_migration', {
      p_version: String(version),
      p_sql: sql
    });

    if (error) {
      console.error('FAILED');
      console.error(error.message);
      process.exit(1);
    }

    console.log('OK');
  }

  console.log('All migrations applied.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
