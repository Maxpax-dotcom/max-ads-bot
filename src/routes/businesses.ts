import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { MetaService } from '../services/metaService';
import { getActiveFacebookAccount } from '../models/facebookAccount';

const router = Router();

// সব রাউটের আগে authMiddleware চলবে — JWT টোকেন চেক করবে
router.use(authMiddleware);

/**
 * GET /api/businesses
 * ইউজারের অ্যাক্টিভ ফেসবুক অ্যাকাউন্টের অধীনে থাকা সব বিজনেস ম্যানেজার রিটার্ন করে।
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user; // authMiddleware থেকে userId পাওয়া যায়
    const fb = await getActiveFacebookAccount(userId);

    if (!fb) {
      return res.status(400).json({ error: 'No active Facebook account. Please link an account.' });
    }

    // ডিক্রিপ্টেড টোকেন দিয়ে MetaService তৈরি করা
    const meta = new MetaService(fb.access_token);
    const businesses = await meta.getBusinesses();

    res.json(businesses);
  } catch (error) {
    console.error('Businesses fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch business information' });
  }
});

export default router;