#!/bin/bash
# Database Backup Script - exports all data via Supabase REST API
# Usage: SUPABASE_URL=<url> SUPABASE_KEY=<service_role_key> ./scripts/backup.sh

set -e

SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_KEY="${SUPABASE_KEY:-}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "❌ Missing SUPABASE_URL or SUPABASE_KEY environment variables."
  exit 1
fi

TABLES="clients projects employees vendors items sectors transactions procurements employee_transactions employee_salary_history custody_records custody_expenses attendance_records payroll_records work_sections work_items profiles audit_logs user_permissions project_tasks"
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
