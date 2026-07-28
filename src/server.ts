import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import authRoutes from './routes/auth';
import businessRoutes from './routes/businesses';
import './bot'; // টেলিগ্রাম বট চালু করবে
const app = express();

// মিডলওয়্যার
app.use(cors());
app.use(express.json());

// static ফাইল (CSS, JS, ইমেজ) সার্ভ করার জন্য public ফোল্ডার
app.use(express.static(path.join(__dirname, '../public')));

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