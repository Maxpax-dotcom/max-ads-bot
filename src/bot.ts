// টেলিগ্রাম বট ফ্রেমওয়ার্ক থেকে প্রয়োজনীয় ফাংশন
import { Telegraf, Scenes, session, Markup } from 'telegraf';
// .env থেকে কনফিগারেশন
import { config } from './config';
// /start কমান্ড হ্যান্ডলার
import { startCommand } from './bot/commands/start';
// ক্যাম্পেইন তৈরির উইজার্ড সিন
import { createCampaignScene } from './bot/scenes/createCampaign';
// ইউজারের UUID বের করার ফাংশন
import { getUserByTelegramId } from './models/user';
// ফেসবুক অ্যাকাউন্ট ম্যানেজমেন্ট ফাংশন
import {
  getActiveFacebookAccount,
  listFacebookAccounts,
  setActiveFacebookAccount,
} from './models/facebookAccount';

// ---------- স্টেজ তৈরি (সিন ব্যবস্থাপনার জন্য) ----------
const stage = new Scenes.Stage<any>([createCampaignScene]);

// ---------- বট ইনস্ট্যান্স তৈরি ----------
const bot = new Telegraf(config.telegramToken);

// ---------- গ্লোবাল মিডলওয়্যার ----------
bot.use(session());
bot.use(stage.middleware());

// ---------- ডিবাগিং মিডলওয়্যার ----------
bot.use((ctx, next) => {
  console.log('📩 Update received:', ctx.updateType, 'from', ctx.from?.id);
  if (ctx.message && 'text' in ctx.message) {
    console.log('   Message text:', ctx.message.text);
  }
  return next();
});

// ---------- /start কমান্ড ----------
bot.start(startCommand);

// ---------- /create → ক্যাম্পেইন উইজার্ড ----------
bot.command('create', (ctx) => {
  console.log('🔧 /create command triggered');
  (ctx as any).scene.enter('CREATE_CAMPAIGN');
});

// ---------- /addaccount ----------
bot.command('addaccount', (ctx) => {
  const oauthUrl = `http://localhost:${config.port}/api/auth/login?telegramId=${ctx.from.id}`;
  ctx.reply(
    `🔗 *Add New Facebook Account*\n\n` +
    `Click the link below to link a new Facebook account:\n\n` +
    `${oauthUrl}\n\n` +
    `After linking, use /listaccounts to see all your accounts.`,
    { parse_mode: 'Markdown' }
  );
});

// ---------- /listaccounts (সম্পূর্ণ কার্যকরী) ----------
bot.command('listaccounts', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return ctx.reply('User ID not found.');

  // টেলিগ্রাম আইডি থেকে ইউজার UUID বের করো
  const user = await getUserByTelegramId(telegramId);
  if (!user) return ctx.reply('User not found. Please /start first.');

  // ইউজারের সব ফেসবুক অ্যাকাউন্ট আনো
  const accounts = await listFacebookAccounts(user.id);
  if (accounts.length === 0) {
    return ctx.reply('No linked Facebook accounts. Use /addaccount.');
  }

  let msg = '📋 *Your Linked Accounts:*\n\n';
  accounts.forEach((acc: any, index: number) => {
    const status = acc.is_active ? '✅ Active' : '⬜ Inactive';
    msg += `${index + 1}. ${acc.name} (${acc.email})\n   ${status}\n\n`;
  });

  ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ---------- /switchaccount (ইনলাইন বাটন সহ) ----------
bot.command('switchaccount', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return ctx.reply('User ID not found.');

  const user = await getUserByTelegramId(telegramId);
  if (!user) return ctx.reply('User not found. Please /start first.');

  const accounts = await listFacebookAccounts(user.id);
  if (accounts.length === 0) {
    return ctx.reply('No linked Facebook accounts. Use /addaccount.');
  }

  // প্রতিটি অ্যাকাউন্টের জন্য একটি বাটন তৈরি
  const buttons = accounts.map((acc: any) => [
    Markup.button.callback(`${acc.name} (${acc.email})`, `switch_to_${acc.id}`)
  ]);

  await ctx.reply('🔄 *Switch Active Account*\n\nSelect the account to activate:', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
});

// ---------- অ্যাকশন হ্যান্ডলার: অ্যাকাউন্ট সুইচ ----------
bot.action(/^switch_to_(.+)$/, async (ctx) => {
  const accountId = ctx.match[1];
  const telegramId = ctx.from?.id;
  if (!telegramId) return ctx.answerCbQuery('User ID not found.');

  const user = await getUserByTelegramId(telegramId);
  if (!user) return ctx.answerCbQuery('User not found.');

  // নির্দিষ্ট অ্যাকাউন্টটিকে অ্যাক্টিভ করে দাও
  await setActiveFacebookAccount(user.id, accountId);
  await ctx.answerCbQuery('Account switched successfully!');

  // পুরানো মেসেজ আপডেট না করে নতুন করে জানিয়ে দাও
  const active = await getActiveFacebookAccount(user.id);
  ctx.reply(`✅ Active account is now: *${active?.name}* (${active?.email})`, {
    parse_mode: 'Markdown'
  });
});

// ---------- /test কমান্ড ----------
bot.command('test', (ctx) => ctx.reply('Bot is working!'));

// ---------- ত্রুটি ধরা ----------
bot.catch((err: any) => console.error('Bot error:', err));

// ---------- বট চালু ----------
bot.launch(() => {
  console.log('✅ Bot is now polling Telegram...');
});