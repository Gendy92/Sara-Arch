import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, unlinkSync, renameSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

export default async function globalTeardown() {
  const projectRoot = join(__dirname, '..', '..', '..');
  const statePath = join(__dirname, '..', '.state', 'setup.json');
  const configLocalPath = join(projectRoot, 'js', 'config.local.js');

  if (!existsSync(statePath)) {
    // eslint-disable-next-line no-console
    console.warn('[E2E teardown] No setup state file found; skipping teardown.');
    return;
  }

  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  const { tenantId, userId, configBackup } = state;

  const supabaseUrl = process.env.E2E_SUPABASE_URL;
  const supabaseServiceKey = process.env.E2E_SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    // eslint-disable-next-line no-console
    console.warn('[E2E teardown] Missing Supabase env vars; skipping remote cleanup.');
  } else {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    try {
      const { error } = await supabase.rpc('e2e_cleanup_tenant', { p_tenant_id: tenantId });
      if (error) {
        // eslint-disable-next-line no-console
        console.warn(`[E2E teardown] e2e_cleanup_tenant failed: ${error.message}`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[E2E teardown] e2e_cleanup_tenant error: ${e.message}`);
    }

    try {
      await supabase.from('user_tenants').delete().eq('user_id', userId).eq('tenant_id', tenantId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[E2E teardown] user_tenants delete error: ${e.message}`);
    }

    try {
      await supabase.from('profiles').delete().eq('id', userId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[E2E teardown] profiles delete error: ${e.message}`);
    }

    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) {
        // eslint-disable-next-line no-console
        console.warn(`[E2E teardown] auth user delete failed: ${error.message}`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[E2E teardown] auth user delete error: ${e.message}`);
    }

    try {
      await supabase.from('tenants').delete().eq('id', tenantId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[E2E teardown] tenant delete error: ${e.message}`);
    }
  }

  if (configBackup && existsSync(configBackup)) {
    renameSync(configBackup, configLocalPath);
  } else if (existsSync(configLocalPath)) {
    unlinkSync(configLocalPath);
  }

  // eslint-disable-next-line no-console
  console.log(`[E2E teardown] cleaned tenant ${tenantId}`);
}
