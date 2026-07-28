import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000', // নতুন ফিল্ড
  dbUrl: process.env.DATABASE_URL || '',
  metaAppId: process.env.META_APP_ID || '',
  metaAppSecret: process.env.META_APP_SECRET || '',
  metaRedirectUri: process.env.META_REDIRECT_URI || '',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  jwtSecret: process.env.JWT_SECRET || 'fallback',
  jwtExpiration: process.env.JWT_EXPIRATION || '1h',
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
};