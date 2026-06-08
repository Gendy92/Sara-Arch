// Database Backup Script - exports all data via Supabase REST API
const SUPABASE_URL = 'https://tvjkctttcijymqvaetsv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2amtjdHR0Y2lqeW1xdmFldHN2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg0MTM3NiwiZXhwIjoyMDk2NDE3Mzc2fQ.zH-yB4Ip_y7Ojsu541MMRD_P9FWO9E2dacALbRKBlmQ';

const tables = ['clients','projects','employees','vendors','items','sectors','transactions','procurements','employee_transactions','employee_salary_history','custody_records','custody_expenses','attendance_records','payroll_records','profiles'];

async function backup() {
  const fs = require('fs');
  const dir = `backups/${new Date().toISOString().slice(0,10)}`;
  fs.mkdirSync(dir, { recursive: true });

  for (const table of tables) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const data = await res.json();
      fs.writeFileSync(`${dir}/${table}.json`, JSON.stringify(data, null, 2));
      console.log(`✅ ${table}: ${data.length} rows`);
    } catch (e) {
      console.error(`❌ ${table}: ${e.message}`);
    }
  }
  console.log(`\n📁 Backup saved to: ${dir}/`);
}

backup();
