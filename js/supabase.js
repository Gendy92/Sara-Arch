// Supabase Client Configuration
// Replace these with your own Supabase project credentials
// Get them from: Project Settings > API in your Supabase dashboard

const SUPABASE_URL = 'https://tvjkctttcijymqvaetsv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2amtjdHR0Y2lqeW1xdmFldHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NDEzNzYsImV4cCI6MjA5NjQxNzM3Nn0.olCeWxIJuAUTTQdXBuy6ftKHEDE4t3SXa3kXeEDtvs4';

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
