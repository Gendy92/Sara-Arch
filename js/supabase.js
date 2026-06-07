// Supabase Client Configuration
// Replace these with your own Supabase project credentials
// Get them from: Project Settings > API in your Supabase dashboard

const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Export for use in other modules
window.sb = supabase;
