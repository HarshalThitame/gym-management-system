-- Phase 2.1: Bulk Operations
-- Creates tables for tracking bulk operations and their results

CREATE TABLE IF NOT EXISTS bulk_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('update', 'delete', 'assign', 'export', 'import')),
  entity_type TEXT NOT NULL, -- e.g., 'members', 'leads', 'equipment'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  total_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}', -- Operation-specific data
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bulk_operation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES bulk_operations(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bulk_operations_org ON bulk_operations(organization_id);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_gym ON bulk_operations(gym_id);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_status ON bulk_operations(status);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_created_by ON bulk_operations(created_by);
CREATE INDEX IF NOT EXISTS idx_bulk_operation_items_operation ON bulk_operation_items(operation_id);
CREATE INDEX IF NOT EXISTS idx_bulk_operation_items_status ON bulk_operation_items(status);

-- RLS Policies
ALTER TABLE bulk_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_operation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bulk operations"
  ON bulk_operations FOR SELECT
  USING (auth.uid() = created_by OR auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can create bulk operations"
  ON bulk_operations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own bulk operations"
  ON bulk_operations FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Service role can manage all bulk operations"
  ON bulk_operations FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can view own operation items"
  ON bulk_operation_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bulk_operations
      WHERE id = operation_id
      AND (created_by = auth.uid() OR auth.jwt()->>'role' = 'service_role')
    )
  );

CREATE POLICY "Service role can manage all operation items"
  ON bulk_operation_items FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Function to update operation counts
CREATE OR REPLACE FUNCTION update_bulk_operation_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    UPDATE bulk_operations
    SET 
      success_count = (SELECT COUNT(*) FROM bulk_operation_items WHERE operation_id = NEW.operation_id AND status = 'success'),
      failed_count = (SELECT COUNT(*) FROM bulk_operation_items WHERE operation_id = NEW.operation_id AND status = 'failed'),
      updated_at = NOW()
    WHERE id = NEW.operation_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_bulk_operation_counts_trigger
  AFTER UPDATE ON bulk_operation_items
  FOR EACH ROW
  EXECUTE FUNCTION update_bulk_operation_counts();

-- Trigger for updated_at
CREATE TRIGGER update_bulk_operations_updated_at
  BEFORE UPDATE ON bulk_operations
  FOR EACH ROW EXECUTE FUNCTION update_2fa_updated_at();
