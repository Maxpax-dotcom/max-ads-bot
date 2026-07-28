import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import authRoutes from './routes/auth';
import businessRoutes from './routes/businesses';
// টেলিগ্রাম বট ওয়েবহুক
import { bot } from './bot';

const app = express();

// মিডলওয়্যার
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ওয়েবহুক রুট (সবচেয়ে আগে, যাতে body parser কাজ করে)
app.use(bot.webhookCallback('/telegram/webhook'));

// API রাউট
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);

// ড্যাশবোর্ড (ফ্রন্টএন্ড)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// হোম পেজ (সার্ভার টেস্ট)
app.get('/', (req, res) => {
  res.send('Max Ads Bot Server Running!');
});

// সার্ভার চালু
app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});