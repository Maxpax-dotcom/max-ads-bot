import { pool } from '../config/database';

/**
 * নতুন ক্যাম্পেইনের তথ্য ডাটাবেসে সংরক্ষণ করে।
 * targeting ও creative সম্পূর্ণ JSON অবজেক্ট হিসেবে জমা থাকে (JSONB কলামে)।
 */
export async function createCampaignRecord(data: {
  userId: string;
  facebookAccountId: string;
  adAccountId: string;
  metaCampaignId: string;
  pageId: string;
  postId: string;
  objective: string;
  status: string;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  startTime: Date | null;
  endTime: Date | null;
  targeting: any;
  creative: any;
}) {
  const result = await pool.query(
    `INSERT INTO campaigns 
     (user_id, facebook_account_id, ad_account_id, meta_campaign_id, page_id, post_id, objective, status, daily_budget, lifetime_budget, start_time, end_time, targeting, creative)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) 
     RETURNING id`,
    [
      data.userId,
      data.facebookAccountId,
      data.adAccountId,
      data.metaCampaignId,
      data.pageId,
      data.postId,
      data.objective,
      data.status,
      data.dailyBudget,
      data.lifetimeBudget,
      data.startTime,
      data.endTime,
      JSON.stringify(data.targeting),   // অবজেক্টকে JSON স্ট্রিং-এ রূপান্তর
      JSON.stringify(data.creative),
    ]
  );
  return result.rows[0].id;
}