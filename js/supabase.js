import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://tvjkctttcijymqvaetsv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2amtjdHR0Y2lqeW1xdmFldHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NDEzNzYsImV4cCI6MjA5NjQxNzM3Nn0.olCeWxIJuAUTTQdXBuy6ftKHEDE4t3SXa3kXeEDtvs4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

window.sb = supabase;
