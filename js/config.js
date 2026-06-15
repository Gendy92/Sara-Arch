// Supabase Config
// IMPORTANT: Do not commit real keys to source control.
// Create js/config.local.js (gitignored) with your actual values:
//
//   window.SARA_LOCAL_CONFIG = {
//     SUPABASE_URL: 'https://your-project.supabase.co',
//     SUPABASE_ANON_KEY: 'your-anon-key'
//   };
//
// For local development without config.local.js, replace the placeholders below
// temporarily, but never commit them.

const localCfg = (typeof window !== 'undefined' && window.SARA_LOCAL_CONFIG) ? window.SARA_LOCAL_CONFIG : {};

const SUPABASE_URL = localCfg.SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = localCfg.SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

// Admin operations (authListUsers, authCreateUser) historically required a service_role key.
// The service-role key MUST NOT be stored in the browser or in source control.
// This constant is intentionally left empty; admin user creation falls back to public signup
// or must be implemented via a secure backend/Edge Function.
const SUPABASE_SERVICE_KEY = '';

// Convenience check so the app fails fast with a clear message if keys are not configured.
if (SUPABASE_URL.includes('YOUR_PROJECT') || SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY')) {
  console.warn('[Config] Supabase keys are placeholders. Create js/config.local.js with real values.');
}
