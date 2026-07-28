import { pool } from '../config/database';

/**
 * একটি ফেসবুক অ্যাকাউন্টের অধীনে একটি অ্যাড অ্যাকাউন্ট সংরক্ষণ করে।
 * যদি account_id আগে থেকেই থাকে, তাহলে কিছুই করে না (ডুপ্লিকেট হবে না)।
 */
export async function saveAdAccount(
  facebookAccountId: string,
  accountId: string,
  name: string,
  currency: string,
  timezone: string
) {
  await pool.query(
    `INSERT INTO ad_accounts (facebook_account_id, account_id, name, currency, timezone_name)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (account_id) DO NOTHING`,
    [facebookAccountId, accountId, name, currency, timezone]
  );
}