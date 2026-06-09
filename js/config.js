// Supabase Config
const SUPABASE_URL = 'https://tvjkctttcijymqvaetsv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2amtjdHR0Y2lqeW1xdmFldHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NDEzNzYsImV4cCI6MjA5NjQxNzM3Nn0.olCeWxIJuAUTTQdXBuy6ftKHEDE4t3SXa3kXeEDtvs4';
// ⚠️ SECURITY WARNING: This service_role key grants FULL admin access.
// It is exposed in client-side code which means ANYONE can extract it.
// IMMEDIATE ACTION REQUIRED:
// 1. Rotate this key in Supabase Dashboard → Project Settings → API
// 2. Move admin operations (authListUsers, authCreateUser) to a Supabase Edge Function
// 3. Or load the key from localStorage via Settings → Admin Key
// Until then, the app remains vulnerable.
const SUPABASE_SERVICE_KEY_HARDCODED = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2amtjdHR0Y2lqeW1xdmFldHN2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg0MTM3NiwiZXhwIjoyMDk2NDE3Mzc2fQ.zH-yB4Ip_y7Ojsu541MMRD_P9FWO9E2dacALbRKBlmQ';
const SUPABASE_SERVICE_KEY = localStorage.getItem('sara_service_key') || SUPABASE_SERVICE_KEY_HARDCODED;
