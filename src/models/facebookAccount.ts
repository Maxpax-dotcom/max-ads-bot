import { pool } from '../config/database';
import { encrypt, decrypt } from '../middleware/encrypt';

/**
 * নতুন ফেসবুক অ্যাকাউন্ট যুক্ত করে, অথবা আগে থাকলে আপডেট করে।
 * টোকেন এনক্রিপ্ট করার পর ডাটাবেসে রাখা হয়।
 */
export async function addFacebookAccount(
  userId: string,
  metaUserId: string,
  name: string,
  email: string,
  profilePicUrl: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date
) {
  // টোকেন এনক্রিপ্ট করো, যাতে কেউ ডাটাবেস দেখলেও টোকেন চুরি করতে না পারে
  const encryptedToken = encrypt(accessToken);

  const result = await pool.query(
    `INSERT INTO facebook_accounts (user_id, meta_user_id, name, email, profile_pic_url, access_token, refresh_token, token_expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (user_id, meta_user_id) DO UPDATE SET access_token=$6, refresh_token=$7, token_expires_at=$8
     RETURNING id`,
    [userId, metaUserId, name, email, profilePicUrl, encryptedToken, refreshToken, expiresAt]
  );
  return result.rows[0].id;
}

/**
 * বর্তমানে অ্যাক্টিভ (is_active = true) ফেসবুক অ্যাকাউন্ট বের করে।
 * টোকেন ডিক্রিপ্ট করে রিটার্ন করে, যাতে API কল করা যায়।
 */
export async function getActiveFacebookAccount(userId: string) {
  const result = await pool.query(
    'SELECT * FROM facebook_accounts WHERE user_id = $1 AND is_active = true LIMIT 1',
    [userId]
  );
  const acc = result.rows[0];
  if (acc) {
    // টোকেন ডিক্রিপ্ট করো, কারণ ডাটাবেসে এনক্রিপ্টেড থাকে
    acc.access_token = decrypt(acc.access_token);
  }
  return acc || null;
}

/**
 * ইউজারের সব ফেসবুক অ্যাকাউন্টের মধ্যে একটি মাত্র অ্যাক্টিভ সেট করে।
 * আগের অ্যাক্টিভ অ্যাকাউন্ট নিষ্ক্রিয় করে, তারপর নতুনটি সক্রিয় করে।
 */
export async function setActiveFacebookAccount(userId: string, accountId: string) {
  // আগে সব অ্যাকাউন্টকে is_active = false করো
  await pool.query('UPDATE facebook_accounts SET is_active = false WHERE user_id = $1', [userId]);
  // তারপর নির্দিষ্ট অ্যাকাউন্টকে is_active = true করো
  await pool.query('UPDATE facebook_accounts SET is_active = true WHERE id = $2 AND user_id = $1', [userId, accountId]);
}

/**
 * ইউজারের সংযুক্ত সব ফেসবুক অ্যাকাউন্টের তালিকা (নাম, ইমেইল, ছবি) রিটার্ন করে।
 * টোকেন এখানে রিটার্ন করা হয় না, শুধু পরিচিতি তথ্য।
 */
export async function listFacebookAccounts(userId: string) {
  const result = await pool.query(
    'SELECT id, meta_user_id, name, email, profile_pic_url, is_active FROM facebook_accounts WHERE user_id = $1',
    [userId]
  );
  return result.rows;
}

/**
 * নির্দিষ্ট একটি ফেসবুক অ্যাকাউন্ট মুছে ফেলে (আনলিংক)।
 */
export async function removeFacebookAccount(accountId: string, userId: string) {
  await pool.query('DELETE FROM facebook_accounts WHERE id = $1 AND user_id = $2', [accountId, userId]);
}