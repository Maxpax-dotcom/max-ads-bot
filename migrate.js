const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  const migrationFiles = [
    'migrations/001_users.sql',
    'migrations/002_facebook_accounts.sql',
    'migrations/003_ad_accounts.sql',
    'migrations/004_pages.sql',
    'migrations/005_campaigns.sql',
    'migrations/006_reports_logs.sql',
  ];

  for (const file of migrationFiles) {
    const filePath = path.join(__dirname, file);
    console.log(`Running ${file}...`);
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      await pool.query(sql);
      console.log(`✅ ${file} done.`);
    } catch (err) {
      console.error(`❌ Error in ${file}:`, err.message);
      process.exit(1);
    }
  }
  console.log('All migrations completed successfully!');
  pool.end();
}

runMigrations();