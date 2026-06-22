// Database Backup Script - exports all data via Supabase REST API
// Usage: SUPABASE_URL=<url> SUPABASE_KEY=<service_role_key> node scripts/backup.js

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || ''; // service_role key

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY environment variables.');
  process.exit(1);
}

const tables = ['clients','projects','employees','vendors','items','sectors','transactions','procurements','employee_transactions','employee_salary_history','custody_records','custody_expenses','attendance_records','payroll_records','work_sections','work_items','profiles','audit_logs','user_permissions','project_tasks','app_settings'];

async function fetchAll(table) {
  const pageSize = 1000;
  let offset = 0;
  let all = [];
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${pageSize}&offset=${offset}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Unexpected response');
    all = all.concat(data);
    if (data.length < pageSize) break;
    offset += pageSize;
    // Safety cap
    if (offset > 1000000) break;
  }
  return all;
}

async function backup() {
  const fs = require('fs');
  const dir = `backups/${new Date().toISOString().slice(0,10)}`;
  fs.mkdirSync(dir, { recursive: true });

  for (const table of tables) {
    try {
      const data = await fetchAll(table);
      fs.writeFileSync(`${dir}/${table}.json`, JSON.stringify(data, null, 2));
      console.log(`✅ ${table}: ${data.length} rows`);
    } catch (e) {
      console.error(`❌ ${table}: ${e.message}`);
    }
  }
  console.log(`\n📁 Backup saved to: ${dir}/`);
}

backup();
