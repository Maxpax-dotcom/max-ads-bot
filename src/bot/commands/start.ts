import { Context } from 'telegraf';
import { createUser, getUserByTelegramId } from '../../models/user';
import { getActiveFacebookAccount } from '../../models/facebookAccount';
import { config } from '../../config';

/**
 * /start কমান্ড — ইউজার বটে প্রথম প্রবেশ করলে এটি চালু হয়।
 * ইউজারকে ডাটাবেসে সংরক্ষণ করে এবং অ্যাক্টিভ ফেসবুক অ্যাকাউন্ট চেক করে।
 */
export async function startCommand(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    return ctx.reply('User ID not found.');
  }

  // ইউজারকে ডাটাবেসে সংরক্ষণ করো (না থাকলে তৈরি হবে, থাকলে UUID রিটার্ন করবে)
  const userId = await createUser(telegramId);

  // UUID দিয়ে অ্যাক্টিভ ফেসবুক অ্যাকাউন্ট চেক করো (আগে telegramId.toString() দিচ্ছিলে, সেটা ভুল ছিল)
  const fb = await getActiveFacebookAccount(userId);

  if (!fb) {
    const oauthUrl = `http://localhost:${config.port}/api/auth/login?telegramId=${telegramId}`;
    await ctx.reply(
      `👋 *Welcome to Max Ads Bot!*\n\n` +
      `Please link your Facebook account first. Click the link below to grant permission:\n\n` +
      `${oauthUrl}\n\n` +
      `After linking, send /start again.`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply(
      `Hello *${fb.name}*! 👋\n\n` +
      `Your Facebook account is active.\n\n` +
      `• /create - Start a new campaign\n` +
      `• /dashboard - View your campaigns\n` +
      `• /addaccount - Add another Facebook account\n` +
      `• /listaccounts - Show all linked accounts\n` +
      `• /switchaccount - Switch active account`,
      { parse_mode: 'Markdown' }
    );
  }
}