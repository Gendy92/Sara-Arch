// Supabase Config
// IMPORTANT: Do not commit the service-role key to source control.
// The project URL is public and safe to hardcode.
// The anon key is injected at deploy time via js/config.local.js (gitignored).
// For local development, create js/config.local.js with your anon key:
//
//   window.SARA_LOCAL_CONFIG = {
//     SUPABASE_ANON_KEY: 'your-anon-key'
//   };

const localCfg = (typeof window !== 'undefined' && window.SARA_LOCAL_CONFIG) ? window.SARA_LOCAL_CONFIG : {};

// Public project URL — safe to commit, but can be overridden by config.local.js.
const SUPABASE_URL = localCfg.SUPABASE_URL || 'https://tvjkctttcijymqvaetsv.supabase.co';

// Anon key is provided by config.local.js so it can be rotated without editing source.
// Fallback uses the project's publishable anon key (safe for public client apps).
const SUPABASE_ANON_KEY = localCfg.SUPABASE_ANON_KEY || 'sb_publishable_WMCxuBjVG8G_UpW5B6x-3A_0AbytzmU';

// Debug / performance logging toggle.
const PERF_LOG = localCfg.PERF_LOG || false;

// Admin operations (user creation) are handled server-side by the
// admin_create_auth_user() Postgres function (SECURITY DEFINER).
// The service-role key MUST NOT be stored in the browser or in source control.
// This constant is intentionally left empty.
const SUPABASE_SERVICE_KEY = '';

// Convenience check so the app fails fast if the anon key is not configured.
if (SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY')) {
  console.warn('[Config] SUPABASE_ANON_KEY is a placeholder. Create js/config.local.js with the real anon key.');
}
