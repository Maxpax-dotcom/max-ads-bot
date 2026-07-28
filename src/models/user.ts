import { pool } from '../config/database';

export async function createUser(telegramId: number) {
  const result = await pool.query(
    'INSERT INTO users (telegram_id) VALUES ($1) ON CONFLICT (telegram_id) DO NOTHING RETURNING id',
    [telegramId]
  );
  if (result.rows.length === 0) {
    const existing = await pool.query('SELECT id FROM users WHERE telegram_id = $1', [telegramId]);
    return existing.rows[0].id;
  }
  return result.rows[0].id;
}

export async function getUserByTelegramId(telegramId: number) {
  const result = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  return result.rows[0] || null;
}