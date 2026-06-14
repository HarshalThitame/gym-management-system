const supabaseUrl = 'https://bobqiyhljubfrzmhqnqq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvYnFpeWhsanViZnJ6bWhxbnFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAzOTQwMywiZXhwIjoyMDk2NjE1NDAzfQ.cjtxb5TGa_ioRWysbYtnOFnuWMeWGKVCJVPutWBrhyA';

async function main() {
  // Get all users via GoTrue Admin API
  const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
  });
  if (!listRes.ok) { console.error('Failed to list users:', await listRes.text()); return; }
  const { users } = await listRes.json();
  console.log(`Found ${users.length} users`);

  let s = 0, f = 0;
  for (const u of users) {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${u.id}`, {
      method: 'PUT',
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'Extreme$00' })
    });
    if (!res.ok) { const t = await res.text(); console.error(`FAIL ${u.email||u.id}: ${t}`); f++; }
    else { s++; }
  }
  console.log(`Done: ${s} updated, ${f} failed`);
}
main().catch(console.error);
