/**
 * Supabase Database Audit Script v2
 * - Uses standard Supabase REST API for record counts and null checks
 * - Parses migration SQL files for schema details (columns, FKs)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// --- Parse .env.local ---
const envPath = path.resolve(projectRoot, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

function parseEnv(content) {
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const env = parseEnv(envContent);
const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: Could not find Supabase credentials in .env.local');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'apikey': serviceRoleKey,
  'Authorization': `Bearer ${serviceRoleKey}`,
};

console.log('=== Supabase Database Audit ===\n');
console.log(`URL: ${supabaseUrl}\n`);

// =========================================================================
// PART A: Parse migration SQL files to extract schema information
// =========================================================================

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║  PART A: SCHEMA ANALYSIS FROM MIGRATION FILES               ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

const migrationsDir = path.resolve(projectRoot, 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

// Collect all CREATE TABLE statements
const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["']?(\w+)["']?\s*\(([\s\S]*?)\);/gi;
const columnDefRegex = /^\s+["']?(\w+)["']?\s+(\w+(?:\s*\([^)]*\))?(?:\s+[\w\s]+(?!\())*?)(?:\s*,)?\s*$/gm;
const fkRegex = /FOREIGN\s+KEY\s*\(["']?(\w+)["']?\)\s*REFERENCES\s+["']?(\w+)["']?\s*\(["']?(\w+)["']?\)/gi;
const columnRegex = /^\s+["']?(\w+)["']?\s+(\w+(?:\s*\([^)]*\))?)/;

const tables = {}; // tableName -> { columns: [], foreignKeys: [] }

for (const file of migrationFiles) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
  
  // Find CREATE TABLE statements
  let match;
  const regex = new RegExp(createTableRegex.source, 'gi');
  while ((match = regex.exec(sql)) !== null) {
    const tableName = match[1].toLowerCase();
    const body = match[2];
    
    if (!tables[tableName]) {
      tables[tableName] = { columns: [], foreignKeys: [] };
    }
    
    // Parse columns from body
    // Split by commas but handle nested parentheses
    const lines = body.split('\n');
    for (const line of lines) {
      const colMatch = line.match(columnRegex);
      if (colMatch) {
        const colName = colMatch[1].toLowerCase();
        // Skip if it's a constraint definition
        if (colName === 'primary' || colName === 'foreign' || colName === 'constraint' || colName === 'unique' || colName === 'check') continue;
        const colType = colMatch[2].trim();
        if (!tables[tableName].columns.find(c => c.name === colName)) {
          tables[tableName].columns.push({ name: colName, type: colType });
        }
      }
      
      // Check for FK inline: REFERENCES other_table(id)
      const inlineFk = line.match(/REFERENCES\s+["']?(\w+)["']?\s*\(["']?(\w+)["']?\)/i);
      if (inlineFk && !line.match(/^\s*(?:FOREIGN\s+KEY|CONSTRAINT)/i)) {
        // Inline FK like: gym_id UUID REFERENCES gyms(id)
        // The column is on the same line
        const fkColMatch = line.match(/^\s*["']?(\w+)["']?/);
        if (fkColMatch) {
          const fkCol = fkColMatch[1].toLowerCase();
          if (!tables[tableName].foreignKeys.find(fk => fk.column === fkCol)) {
            tables[tableName].foreignKeys.push({
              column: fkCol,
              references: inlineFk[1].toLowerCase(),
              referencesColumn: inlineFk[2].toLowerCase(),
            });
          }
        }
      }
    }
    
    // Parse explicit FOREIGN KEY definitions
    const fkRegex2 = /FOREIGN\s+KEY\s*\(["']?(\w+)["']?\)\s*REFERENCES\s+["']?(\w+)["']?\s*\(["']?(\w+)["']?\)/gi;
    let fkMatch;
    while ((fkMatch = fkRegex2.exec(body)) !== null) {
      const fkCol = fkMatch[1].toLowerCase();
      if (!tables[tableName].foreignKeys.find(fk => fk.column === fkCol)) {
        tables[tableName].foreignKeys.push({
          column: fkCol,
          references: fkMatch[2].toLowerCase(),
          referencesColumn: fkMatch[3].toLowerCase(),
        });
      }
    }
    
    // Also parse ALTER TABLE ADD FOREIGN KEY
    const alterFkRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?["']?(\w+)["']?\s+ADD(?:\s+CONSTRAINT\s+["']?\w+["']?)?\s+FOREIGN\s+KEY\s*\(["']?(\w+)["']?\)\s*REFERENCES\s+["']?(\w+)["']?\s*\(["']?(\w+)["']?\)/gi;
    while ((fkMatch = alterFkRegex.exec(sql)) !== null) {
      const tableName2 = fkMatch[1].toLowerCase();
      if (!tables[tableName2]) {
        tables[tableName2] = { columns: [], foreignKeys: [] };
      }
      const fkCol = fkMatch[2].toLowerCase();
      if (!tables[tableName2].foreignKeys.find(fk => fk.column === fkCol)) {
        tables[tableName2].foreignKeys.push({
          column: fkCol,
          references: fkMatch[3].toLowerCase(),
          referencesColumn: fkMatch[4].toLowerCase(),
        });
      }
    }
  }
}

// Also parse ALTER TABLE ... ADD COLUMN statements
for (const file of migrationFiles) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
  const alterAddRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?["']?(\w+)["']?\s+ADD\s+(?:COLUMN\s+)?["']?(\w+)["']?\s+(\w+(?:\s*\([^)]*\))?)/gi;
  let match;
  while ((match = alterAddRegex.exec(sql)) !== null) {
    const tableName = match[1].toLowerCase();
    const colName = match[2].toLowerCase();
    const colType = match[3].trim();
    if (!tables[tableName]) {
      tables[tableName] = { columns: [], foreignKeys: [] };
    }
    if (!tables[tableName].columns.find(c => c.name === colName)) {
      tables[tableName].columns.push({ name: colName, type: colType });
    }
  }
}

const tableNames = Object.keys(tables).sort();

// 1. Tables with gym_id column
console.log('=== 1. TABLES WITH gym_id COLUMN ===');
const tablesWithGymId = tableNames.filter(t => tables[t].columns.some(c => c.name === 'gym_id'));
console.log(`  Found ${tablesWithGymId.length} table(s):`);
for (const t of tablesWithGymId) {
  console.log(`    - ${t}`);
}

// 2. Tables with branch_id column
console.log('\n=== 2. TABLES WITH branch_id COLUMN ===');
const tablesWithBranchId = tableNames.filter(t => tables[t].columns.some(c => c.name === 'branch_id'));
console.log(`  Found ${tablesWithBranchId.length} table(s):`);
for (const t of tablesWithBranchId) {
  console.log(`    - ${t}`);
}

// 3. Tables with organization_id column
console.log('\n=== 3. TABLES WITH organization_id COLUMN ===');
const tablesWithOrgId = tableNames.filter(t => tables[t].columns.some(c => c.name === 'organization_id'));
console.log(`  Found ${tablesWithOrgId.length} table(s):`);
for (const t of tablesWithOrgId) {
  console.log(`    - ${t}`);
}

// 4. Foreign keys referencing gyms(id)
console.log('\n=== 4. FOREIGN KEY CONSTRAINTS REFERENCING gyms(id) ===');
const fksToGyms = [];
for (const t of tableNames) {
  for (const fk of tables[t].foreignKeys) {
    if (fk.references === 'gyms' && fk.referencesColumn === 'id') {
      fksToGyms.push({ table: t, column: fk.column, references: `${fk.references}(${fk.referencesColumn})` });
    }
  }
}
console.log(`  Found ${fksToGyms.length} FK constraint(s):`);
for (const fk of fksToGyms) {
  console.log(`    - ${fk.table}(${fk.column}) -> ${fk.references}`);
}

// =========================================================================
// PART B: Query live database via REST API for record counts
// =========================================================================

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║  PART B: LIVE DATABASE QUERIES (via Supabase REST API)      ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

async function countRecords(table) {
  try {
    const url = `${supabaseUrl}/rest/v1/${table}?select=count&limit=0`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { ...headers, 'Prefer': 'count=exact' },
    });
    if (!res.ok) {
      const text = await res.text();
      return { error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const count = parseInt(res.headers.get('content-range')?.split('/')[1] || '0', 10);
    return { data: isNaN(count) ? 0 : count, error: null };
  } catch (err) {
    return { error: err.message };
  }
}

async function countWhere(table, condition) {
  try {
    const url = `${supabaseUrl}/rest/v1/${table}?${condition}&select=count&limit=0`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { ...headers, 'Prefer': 'count=exact' },
    });
    if (!res.ok) {
      const text = await res.text();
      return { error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const count = parseInt(res.headers.get('content-range')?.split('/')[1] || '0', 10);
    return { data: isNaN(count) ? 0 : count, error: null };
  } catch (err) {
    return { error: err.message };
  }
}

// 5. Count records in key tables
console.log('=== 5. RECORD COUNTS IN KEY TABLES ===');
const tablesToCount = [
  'organizations', 'gyms', 'branches', 'members', 'trainers',
  'organization_subscriptions', 'packages', 'invoices', 'payments',
  'attendance_sessions', 'leads',
];
for (const table of tablesToCount) {
  const result = await countRecords(table);
  if (result.error) {
    console.log(`  ${table}: ERROR - ${result.error}`);
  } else {
    console.log(`  ${table}: ${result.data} records`);
  }
}

// 6. Branches null checks
console.log('\n=== 6. BRANCHES NULL CHECKS ===');
{
  const r1 = await countWhere('branches', 'organization_id=is.null');
  if (r1.error) console.log(`  branches WHERE organization_id IS NULL: ERROR - ${r1.error}`);
  else console.log(`  branches WHERE organization_id IS NULL: ${r1.data}`);
}
{
  const r2 = await countWhere('branches', 'gym_id=is.null');
  if (r2.error) console.log(`  branches WHERE gym_id IS NULL: ERROR - ${r2.error}`);
  else console.log(`  branches WHERE gym_id IS NULL: ${r2.data}`);
}

// 7. Members null checks
console.log('\n=== 7. MEMBERS NULL CHECKS ===');
{
  const r1 = await countWhere('members', 'gym_id=is.null');
  if (r1.error) console.log(`  members WHERE gym_id IS NULL: ERROR - ${r1.error}`);
  else console.log(`  members WHERE gym_id IS NULL: ${r1.data}`);
}
{
  const r2 = await countWhere('members', 'branch_id=is.null');
  if (r2.error) console.log(`  members WHERE branch_id IS NULL: ERROR - ${r2.error}`);
  else console.log(`  members WHERE branch_id IS NULL: ${r2.data}`);
}

console.log('\n=== AUDIT COMPLETE ===');
