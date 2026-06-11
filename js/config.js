// Supabase Config
const SUPABASE_URL = 'https://tvjkctttcijymqvaetsv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2amtjdHR0Y2lqeW1xdmFldHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NDEzNzYsImV4cCI6MjA5NjQxNzM3Nn0.olCeWxIJuAUTTQdXBuy6ftKHEDE4t3SXa3kXeEDtvs4';
// Admin operations (authListUsers, authCreateUser) require a service_role key.
// The key is loaded from localStorage only — never hardcoded in the bundle.
// Store it via Settings → Admin Key, or move admin ops to Edge Functions.
const SUPABASE_SERVICE_KEY = localStorage.getItem('sara_service_key') || ''; // empty = admin features disabled
