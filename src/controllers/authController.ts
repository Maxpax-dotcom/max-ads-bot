import { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { createUser } from '../models/user';
import { addFacebookAccount, setActiveFacebookAccount } from '../models/facebookAccount';

/**
 * লগইন রুট: ইউজারকে ফেসবুকের OAuth ডায়ালগে রিডাইরেক্ট করে।
 * টেলিগ্রাম থেকে আসলে state প্যারামিটারে telegramId রেখে দেওয়া হয়, যাতে পরে চেনা যায়।
 */
export async function login(req: Request, res: Response) {
  const telegramId = req.query.telegramId as string;
  const state = telegramId ? `telegram_${telegramId}` : 'web';
  const url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${config.metaAppId}&redirect_uri=${encodeURIComponent(config.metaRedirectUri)}&scope=ads_management,ads_read,business_management,pages_show_list,pages_read_engagement&state=${state}`;
  res.redirect(url);
}

/**
 * OAuth কলব্যাক: ফেসবুক থেকে কোড আসে, সেটা এক্সচেঞ্জ করে টোকেন আনা হয় এবং ডাটাবেসে জমা হয়।
 */
export async function callback(req: Request, res: Response) {
  try {
    const { code, state } = req.query;

    // ধাপ ১: অথোরাইজেশন কোডের বদলে স্বল্পমেয়াদী টোকেন নেওয়া
    const tokenRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: config.metaAppId,
        client_secret: config.metaAppSecret,
        redirect_uri: config.metaRedirectUri,
        code: code
      }
    });
    const shortLivedToken = tokenRes.data.access_token;

    // ধাপ ২: স্বল্পমেয়াদী টোকেনকে দীর্ঘমেয়াদী (60 দিন) টোকেনে রূপান্তর
    const longRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: config.metaAppId,
        client_secret: config.metaAppSecret,
        fb_exchange_token: shortLivedToken
      }
    });
    const accessToken = longRes.data.access_token;
    const expiresIn = longRes.data.expires_in; // সেকেন্ডে
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // ধাপ ৩: টোকেন ব্যবহার করে ইউজারের প্রোফাইল তথ্য নেওয়া
    const meRes = await axios.get('https://graph.facebook.com/v18.0/me?fields=id,name,email,picture', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const { id: metaUserId, name, email, picture } = meRes.data;

    let userId: string;
    let telegramId: number | null = null;

    // state থেকে বোঝার চেষ্টা করি এটি টেলিগ্রাম থেকে এসেছে কি না
    if (state && (state as string).startsWith('telegram_')) {
      telegramId = parseInt((state as string).replace('telegram_', ''));
      userId = await createUser(telegramId);
    } else {
      // ওয়েব থেকে এলে telegramId শূন্য (0) ধরা হয়; এটি পরবর্তীতে ঠিক করা যাবে
      userId = await createUser(0);
    }

    // ধাপ ৪: ফেসবুক অ্যাকাউন্ট ডাটাবেসে সংরক্ষণ (টোকেন এনক্রিপ্টেড থাকবে)
    const fbAccountId = await addFacebookAccount(
      userId,
      metaUserId,
      name,
      email,
      picture?.data?.url || '',
      accessToken,
      null,
      expiresAt
    );
    await setActiveFacebookAccount(userId, fbAccountId);

    // ধাপ ৫: JWT তৈরি (ওয়েব বা টেলিগ্রামের জন্য)
    const payload = { userId, telegramId: telegramId || 0 };
    const token = jwt.sign(payload, config.jwtSecret, {
  expiresIn: config.jwtExpiration as any, // TypeScript strict mode এর জন্য casting
});

    if (telegramId) {
      // টেলিগ্রাম থেকে এলে সহজ একটি সফলতার বার্তা দেখাই
      res.send('✅ Account successfully linked! Return to the Telegram bot.');
    } else {
      // ওয়েব থেকে এলে ড্যাশবোর্ডে রিডাইরেক্ট, সাথে টোকেন কুয়েরি প্যারামিটার
      res.redirect(`/dashboard?token=${token}`);
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
}