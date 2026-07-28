import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './routes/auth';
// পরবর্তীতে import businessRoutes ইত্যাদি যোগ করবো
// import './bot'; // বট পরে যোগ করবো

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/auth', authRoutes);

// Dashboard (frontend)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Home route
app.get('/', (req, res) => {
  res.send('Max Ads Bot Server Running!');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});