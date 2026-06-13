import pg from "pg";
const { Pool } = pg;

const PROJECT_REF = "bobqiyhljubfrzmhqnqq";
const DB_PASSWORD = "Extreme9623023477";

const pool = new Pool({
  connectionString: `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

try {
  // 1. Seed default ticket categories
  console.log("Seeding default categories...");
  await pool.query(`
    insert into public.support_ticket_categories (name, slug, description, is_system, sort_order) values
      ('Membership Issues', 'membership', 'Membership plans, renewals, cancellations', true, 1),
      ('Billing Issues', 'billing', 'Invoices, charges, payment methods', true, 2),
      ('Payment Failure', 'payment_failure', 'Failed transactions, declined payments', true, 3),
      ('Refund Request', 'refund', 'Refund and reversal requests', true, 4),
      ('Trainer Complaint', 'trainer', 'Issues with personal trainers', true, 5),
      ('Equipment Complaint', 'equipment', 'Broken or malfunctioning equipment', true, 6),
      ('Branch Complaint', 'facility', 'Facility cleanliness, maintenance', true, 7),
      ('Access Control', 'access', 'Entry, QR code, biometric issues', true, 8),
      ('Mobile App Issues', 'mobile_app', 'App crashes, login issues, bugs', true, 9),
      ('Technical Support', 'technical', 'General technical issues', true, 10),
      ('General Inquiry', 'general_inquiry', 'General questions and inquiries', true, 11)
    on conflict (organization_id, slug) do nothing
  `);

  // 2. Seed default SLA policies
  console.log("Seeding default SLA policies...");
  await pool.query(`
    insert into public.support_sla_policies (name, priority, first_response_minutes, resolution_minutes, escalation_minutes, is_default, is_active) values
      ('Critical SLA', 'critical', 15, 240, 60, false, true),
      ('High SLA', 'high', 60, 480, 120, false, true),
      ('Medium SLA', 'medium', 240, 1440, 360, true, true),
      ('Low SLA', 'low', 1440, 4320, 720, false, true)
    on conflict do nothing
  `);

  // 3. Create storage bucket for attachments
  console.log("Creating storage bucket...");
  try {
    await pool.query(`
      insert into storage.buckets (id, name, public) values ('attachments', 'attachments', true)
      on conflict (id) do nothing
    `);
    console.log("  - 'attachments' bucket created");
  } catch (e) {
    console.log("  - Storage bucket already exists or requires supabase API");
  }

  console.log("\nSeeding complete!");
} catch (err) {
  console.error("Seed failed:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
