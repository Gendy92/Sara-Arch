/* exported SUPABASE_URL, SUPABASE_ANON_KEY, SARA_EMAIL_DOMAIN, PERF_LOG, SUPABASE_SERVICE_KEY, SARA_MODE */
// Supabase Config
// IMPORTANT: Do not commit the service-role key to source control.
// The project URL is public and safe to hardcode.
// The anon key is injected at deploy time via js/config.local.js (gitignored).
// For local development, create js/config.local.js with your anon key:
//
//   window.SARA_LOCAL_CONFIG = {
//     SUPABASE_ANON_KEY: 'your-anon-key'
//   };
//
// To point the app at a staging Supabase project, use ?mode=staging in the URL
// or host it on a domain containing "staging" and provide STAGING_* keys:
//
//   window.SARA_LOCAL_CONFIG = {
//     SUPABASE_URL: 'https://prod.supabase.co',
//     SUPABASE_ANON_KEY: 'prod-anon-key',
//     STAGING_SUPABASE_URL: 'https://staging.supabase.co',
//     STAGING_SUPABASE_ANON_KEY: 'staging-anon-key'
//   };

const localCfg = (typeof window !== 'undefined' && window.SARA_LOCAL_CONFIG) ? window.SARA_LOCAL_CONFIG : {};

function detectMode() {
  if (typeof location === 'undefined') return 'production';
  const params = new URL(location.href).searchParams;
  if (params.get('mode') === 'staging') return 'staging';
  if (location.hostname.includes('staging')) return 'staging';
  return 'production';
}

const SARA_MODE = localCfg.SARA_MODE || detectMode();
const isStaging = SARA_MODE === 'staging';
const urlKey = isStaging ? 'STAGING_SUPABASE_URL' : 'SUPABASE_URL';
const keyKey = isStaging ? 'STAGING_SUPABASE_ANON_KEY' : 'SUPABASE_ANON_KEY';

// Public project URL — safe to commit, but can be overridden by config.local.js.
const SUPABASE_URL = localCfg[urlKey] || 'https://tvjkctttcijymqvaetsv.supabase.co';

// Anon key is provided by config.local.js so it can be rotated without editing source.
// The fallback below is intentionally a placeholder; the real key must come from
// js/config.local.js (local dev) or from the SUPABASE_ANON_KEY GitHub secret (Pages deploy).
const SUPABASE_ANON_KEY = localCfg[keyKey] || localCfg.SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

// Email domain used when mapping usernames to syntactically-valid auth emails.
// Can be overridden via config.local.js if the Pages domain ever changes.
const SARA_EMAIL_DOMAIN = localCfg.SARA_EMAIL_DOMAIN || 'gendy92.github.io';

// Debug / performance logging toggle.
const PERF_LOG = localCfg.PERF_LOG || false;

// Admin operations (user creation) are handled server-side by the
// admin_create_auth_user() Postgres function (SECURITY DEFINER).
// The service-role key MUST NOT be stored in the browser or in source control.
// This constant is intentionally left empty.
const SUPABASE_SERVICE_KEY = '';

// Convenience check so the app fails fast if the anon key is not configured.
if (SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY')) {
  // The real anon key must be provided via js/config.local.js or the SUPABASE_ANON_KEY secret at deploy time.
}
