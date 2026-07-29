import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './routes/auth';
import businessRoutes from './routes/businesses';
import { bot } from './bot';

const app = express();

// মিডলওয়্যার
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ওয়েবহুক রুট
app.use(bot.webhookCallback('/telegram/webhook'));

// API রাউট
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/', (req, res) => {
  res.send('Max Ads Bot Server Running!');
});

// অটোমেটিক মাইগ্রেশন
async function autoMigrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const migrationFiles = [
    '001_users.sql',
    '002_facebook_accounts.sql',
    '003_ad_accounts.sql',
    '004_pages.sql',
    '005_campaigns.sql',
    '006_reports_logs.sql',
  ];
  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations', file), 'utf8');
    try {
      await pool.query(sql);
      console.log(`✅ Migration ${file} executed.`);
    } catch (err: any) {
      if (err.message.includes('already exists')) {
        console.log(`⚠️ Table in ${file} already exists.`);
      } else {
        console.error(`❌ Migration ${file} failed:`, err.message);
      }
    }
  }
  await pool.end();
}

// সার্ভার চালুর আগে মাইগ্রেশন চালাই
autoMigrate().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});