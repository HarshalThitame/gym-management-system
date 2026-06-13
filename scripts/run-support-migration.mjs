import { readFileSync } from "fs";
import pg from "pg";

const { Pool } = pg;

const PROJECT_REF = "bobqiyhljubfrzmhqnqq";
const DB_PASSWORD = "Extreme9623023477";

const pool = new Pool({
  connectionString: `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

try {
  const sql = readFileSync(
    "/home/rutik-thitame/Projects/gym-management-discovery/supabase/migrations/20260614000000_create_support_center.sql",
    "utf8"
  );

  console.log("Applying migration...");
  await pool.query(sql);
  console.log("Migration applied successfully!");

  const { rows } = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE 'support_%'
    ORDER BY table_name
  `);
  console.log(`\nCreated ${rows.length} tables:`);
  rows.forEach((r) => console.log(`  - ${r.table_name}`));

} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
