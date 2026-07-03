#!/bin/bash
# Reception Module - Database Setup Script
# Applies new migrations and regenerates TypeScript types
# Usage: bash scripts/reception-db-setup.sh
set -euo pipefail

echo "=== Reception Module DB Setup ==="
echo ""

# Step 1: Check if supabase CLI is available
if command -v supabase &>/dev/null; then
  echo "[1/3] Applying new migrations..."
  supabase db push
  echo "      Migrations applied successfully."
  echo ""

  echo "[2/3] Regenerating TypeScript types..."
  supabase gen types typescript --linked > types/database.ts
  echo "      types/database.ts regenerated."
  echo ""

  echo "[3/3] Verifying tables..."
  supabase db diff --linked --schema public 2>/dev/null || true
  echo ""

  echo "=== Setup Complete ==="
  echo "New tables: appointments, tasks"
  echo "Storage bucket: member-documents (already exists)"
else
  echo "Supabase CLI not found."
  echo ""
  echo "Manual steps required:"
  echo ""
  echo "1. Apply these SQL migrations via Supabase Dashboard > SQL Editor:"
  echo "   - supabase/migrations/20260906000000_create_appointments.sql"
  echo "   - supabase/migrations/20260906010000_create_tasks.sql"
  echo ""
  echo "2. Regenerate types (install CLI first):"
  echo "   npx supabase login"
  echo "   npx supabase link --project-ref <your-project-ref>"
  echo "   npx supabase gen types typescript --linked > types/database.ts"
  echo ""
  echo "Or install Supabase CLI:"
  echo "   npm install -g supabase"
  echo "   Then run: bash scripts/reception-db-setup.sh"
  echo ""
  echo "Current pending migrations:"
  ls -la supabase/migrations/20260906*
fi
