CREATE TABLE IF NOT EXISTS public.login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'locked', 'reset_requested', 'reset_completed', 'force_logout')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON public.login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON public.login_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_status ON public.login_history(status);

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_full_access_login_history" ON public.login_history;
CREATE POLICY "super_admin_full_access_login_history"
  ON public.login_history
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.branch_users bu
      WHERE bu.user_id = auth.uid() AND bu.role_name = 'super_admin' AND bu.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.branch_users bu
      WHERE bu.user_id = auth.uid() AND bu.role_name = 'super_admin' AND bu.status = 'active'
    )
  );

DROP POLICY IF EXISTS "user_read_own_login_history" ON public.login_history;
CREATE POLICY "user_read_own_login_history"
  ON public.login_history
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
