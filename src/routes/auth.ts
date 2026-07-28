import { Router, Request, Response } from 'express';
import { login, callback } from '../controllers/authController';

const router = Router();

// সরাসরি Facebook OAuth-এ রিডাইরেক্ট (কোনো ল্যান্ডিং পেজ নয়)
router.get('/telegram', (req: Request, res: Response) => {
  const telegramId = req.query.telegramId || '';
  res.redirect(`/api/auth/login?telegramId=${telegramId}`);
});

router.get('/login', login);
router.get('/callback', callback);

export default router;