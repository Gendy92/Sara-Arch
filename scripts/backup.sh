#!/bin/bash
# Database Backup Script - exports all data via Supabase REST API
# Usage: SUPABASE_URL=<url> SUPABASE_KEY=<service_role_key> ./scripts/backup.sh
# This delegates to scripts/backup.js for chunked pagination.

set -e

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "❌ Missing SUPABASE_URL or SUPABASE_KEY environment variables."
  exit 1
fi

node scripts/backup.js
