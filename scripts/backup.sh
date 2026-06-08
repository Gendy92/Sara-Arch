#!/bin/bash
# Database Backup Script - exports all data via Supabase REST API

SUPABASE_URL="https://tvjkctttcijymqvaetsv.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2amtjdHR0Y2lqeW1xdmFldHN2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg0MTM3NiwiZXhwIjoyMDk2NDE3Mzc2fQ.zH-yB4Ip_y7Ojsu541MMRD_P9FWO9E2dacALbRKBlmQ"

TABLES="clients projects employees vendors items sectors transactions procurements employee_transactions employee_salary_history custody_records custody_expenses attendance_records payroll_records work_sections work_items profiles audit_logs user_permissions"
DATE=$(date +%Y-%m-%d)
DIR="backups/$DATE"

mkdir -p "$DIR"

for table in $TABLES; do
  echo "Backing up $table..."
  curl -s "$SUPABASE_URL/rest/v1/$table?select=*" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    > "$DIR/$table.json"
  count=$(cat "$DIR/$table.json" | grep -c '"id"' || echo "0")
  echo "  ✅ $count rows"
done

echo ""
echo "📁 Backup saved to: $DIR/"
