import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { existsSync, copyFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REQUIRED_ENVS = ['E2E_SUPABASE_URL', 'E2E_SUPABASE_ANON_KEY', 'E2E_SUPABASE_SERVICE_KEY'];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function maskKey(key) {
  if (!key || key.length < 12) return '***';
  return key.slice(0, 6) + '...' + key.slice(-6);
}

export default async function globalSetup() {
  for (const name of REQUIRED_ENVS) {
    requireEnv(name);
  }

  const supabaseUrl = process.env.E2E_SUPABASE_URL;
  const supabaseAnonKey = process.env.E2E_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.E2E_SUPABASE_SERVICE_KEY;

  const projectRoot = join(__dirname, '..', '..', '..');
  const configLocalPath = join(projectRoot, 'js', 'config.local.js');
  const configBackupPath = `${configLocalPath}.e2e-backup`;

  let configBackup = null;
  if (existsSync(configLocalPath)) {
    copyFileSync(configLocalPath, configBackupPath);
    configBackup = configBackupPath;
  }

  writeFileSync(
    configLocalPath,
    `window.SARA_LOCAL_CONFIG = {
  SUPABASE_URL: ${JSON.stringify(supabaseUrl)},
  SUPABASE_ANON_KEY: ${JSON.stringify(supabaseAnonKey)}
};
`,
    'utf8'
  );

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const runId = Date.now();
  const tenantId = randomUUID();
  const tenantName = `e2e-tests-${runId}`;
  const tenantSlug = `e2e-tests-${runId}`;

  const { error: tenantError } = await supabase
    .from('tenants')
    .insert({ id: tenantId, name: tenantName, slug: tenantSlug });

  if (tenantError) {
    throw new Error(`Failed to create E2E tenant: ${tenantError.message}`);
  }

  const username = 'e2e-admin';
  const email = `${username}@gendy92.github.io`;
  const password = process.env.E2E_ADMIN_PASSWORD || `E2E-${runId}-pass`;

  let userId = null;

  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (listError) {
    throw new Error(`Failed to list auth users: ${listError.message}`);
  }

  const existing = (listData?.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    userId = existing.id;
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password });
    if (updateError) {
      throw new Error(`Failed to update existing E2E admin password: ${updateError.message}`);
    }
  } else {
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: 'E2E Admin', username, role: 'admin' }
    });

    if (createError) {
      throw new Error(`Failed to create E2E admin user: ${createError.message}`);
    }

    userId = createData.user.id;
  }

  if (!userId) {
    throw new Error('Could not determine E2E admin user id');
  }

  const { error: profileError } = await supabase.from('profiles').upsert(
    { id: userId, name: 'E2E Admin', role: 'admin', username, email: email.toLowerCase() },
    { onConflict: 'id' }
  );

  if (profileError) {
    throw new Error(`Failed to upsert E2E admin profile: ${profileError.message}`);
  }

  const { error: linkError } = await supabase.from('user_tenants').upsert(
    { user_id: userId, tenant_id: tenantId, role: 'admin', is_default: true },
    { onConflict: 'user_id,tenant_id' }
  );

  if (linkError) {
    throw new Error(`Failed to link E2E admin to tenant: ${linkError.message}`);
  }

  const { error: seedError } = await supabase.rpc('e2e_seed_tenant', {
    p_tenant_id: tenantId
  });

  if (seedError) {
    throw new Error(`Failed to seed E2E tenant: ${seedError.message}`);
  }

  const stateDir = join(__dirname, '..', '.state');
  mkdirSync(stateDir, { recursive: true });

  const state = {
    tenantId,
    tenantSlug,
    userId,
    username,
    password,
    email,
    configBackup,
    supabaseUrl,
    serviceKey: supabaseServiceKey
  };

  writeFileSync(join(stateDir, 'setup.json'), JSON.stringify(state, null, 2), 'utf8');

  // eslint-disable-next-line no-console
  console.log(`[E2E setup] tenant=${tenantName} (${tenantId}) user=${email} key=${maskKey(supabaseServiceKey)}`);
}
