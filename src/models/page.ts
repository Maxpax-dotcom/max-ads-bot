import { pool } from '../config/database';
import { encrypt } from '../middleware/encrypt';

/**
 * একটি ফেসবুক অ্যাকাউন্টের অধীনে একটি পেজ সংরক্ষণ বা আপডেট করে।
 * পেজের অ্যাক্সেস টোকেন এনক্রিপ্ট করে রাখা হয়।
 */
export async function savePage(
  facebookAccountId: string,
  pageId: string,
  name: string,
  instagramId: string | null,
  accessToken: string
) {
  // পেজের টোকেন এনক্রিপ্ট করো, যাতে সুরক্ষিত থাকে
  const encrypted = encrypt(accessToken);

  await pool.query(
    `INSERT INTO pages (facebook_account_id, page_id, name, instagram_business_account_id, access_token)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (page_id) DO UPDATE SET name=$3, access_token=$5`,
    [facebookAccountId, pageId, name, instagramId, encrypted]
  );
}