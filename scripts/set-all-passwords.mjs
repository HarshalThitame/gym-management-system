import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bobqiyhljubfrzmhqnqq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvYnFpeWhsanViZnJ6bWhxbnFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAzOTQwMywiZXhwIjoyMDk2NjE1NDAzfQ.cjtxb5TGa_ioRWysbYtnOFnuWMeWGKVCJVPutWBrhyA',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

try {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  console.log(`Found ${users.users.length} users`);
  let s = 0, f = 0;
  for (const u of users.users) {
    try {
      const { error: e } = await supabase.auth.admin.updateUserById(u.id, { password: 'Extreme$00' });
      if (e) { console.error(`FAIL ${u.email||u.id}: ${e.message}`); f++; } else { s++; }
    } catch(e2) { console.error(`ERR ${u.email||u.id}: ${e2.message}`); f++; }
  }
  console.log(`Done: ${s} updated, ${f} failed`);
} catch(err) { console.error(err.message); }
