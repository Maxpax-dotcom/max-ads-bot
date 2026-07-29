import { Telegraf, Scenes, session, Markup } from 'telegraf';
import { config } from './config';
import { startCommand } from './bot/commands/start';
import { createCampaignScene } from './bot/scenes/createCampaign';
import { getUserByTelegramId } from './models/user';
import {
  getActiveFacebookAccount,
  listFacebookAccounts,
  setActiveFacebookAccount,
} from './models/facebookAccount';
import { MetaService } from './services/metaService';
import { createCampaignRecord } from './models/campaign';

const stage = new Scenes.Stage<any>([createCampaignScene]);

const bot = new Telegraf(config.telegramToken);

bot.use(session());
bot.use(stage.middleware());

bot.use((ctx, next) => {
  console.log('📩 Update received:', ctx.updateType, 'from', ctx.from?.id);
  if (ctx.message && 'text' in ctx.message) {
    console.log('   Message text:', ctx.message.text);
  }
  return next();
});

// ---------- /start ----------
bot.start(startCommand);

// ---------- /create (wizard) ----------
bot.command('create', (ctx) => {
  console.log('/create triggered');
  (ctx as any).scene.enter('CREATE_CAMPAIGN');
});

// ---------- /addaccount ----------
bot.command('addaccount', (ctx) => {
  const oauthUrl = `${config.baseUrl}/api/auth/telegram?telegramId=${ctx.from.id}`;
  ctx.reply(
    `🔗 *Add New Facebook Account*\n\n` +
    `Click the link below to link a new Facebook account:\n\n` +
    `${oauthUrl}\n\n` +
    `After linking, use /listaccounts to see all your accounts.`,
    { parse_mode: 'Markdown' }
  );
});

// ---------- /cancel ----------
bot.command('cancel', (ctx) => {
  try {
    (ctx as any).scene.leave();
  } catch (e) {}
  ctx.reply('✅ Wizard cancelled. You can now use other commands.');
});

// ---------- /listaccounts ----------
bot.command('listaccounts', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return ctx.reply('User ID not found.');

bot.command('reset', (ctx) => {
  (ctx as any).session = null;
  try {
    (ctx as any).scene.leave();
  } catch (e) {}
  ctx.reply('✅ Session reset. You can now use other commands.');
});

  const user = await getUserByTelegramId(telegramId);
  if (!user) return ctx.reply('User not found. Please /start first.');

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

// ---------- /switchaccount ----------
bot.command('switchaccount', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return ctx.reply('User ID not found.');

  const user = await getUserByTelegramId(telegramId);
  if (!user) return ctx.reply('User not found. Please /start first.');

  const accounts = await listFacebookAccounts(user.id);
  if (accounts.length === 0) {
    return ctx.reply('No linked Facebook accounts. Use /addaccount.');
  }

  const buttons = accounts.map((acc: any) => [
    Markup.button.callback(`${acc.name} (${acc.email})`, `switch_to_${acc.id}`)
  ]);

  await ctx.reply('🔄 *Switch Active Account*\n\nSelect the account to activate:', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
});

// ---------- অ্যাকাউন্ট সুইচ অ্যাকশন ----------
bot.action(/^switch_to_(.+)$/, async (ctx) => {
  const accountId = ctx.match[1];
  const telegramId = ctx.from?.id;
  if (!telegramId) return ctx.answerCbQuery('User ID not found.');

  const user = await getUserByTelegramId(telegramId);
  if (!user) return ctx.answerCbQuery('User not found.');

  await setActiveFacebookAccount(user.id, accountId);
  await ctx.answerCbQuery('Account switched successfully!');

  const active = await getActiveFacebookAccount(user.id);
  ctx.reply(`✅ Active account is now: *${active?.name}* (${active?.email})`, {
    parse_mode: 'Markdown'
  });
});

// ---------- /webapp (Telegram Mini App বাটন) ----------
bot.command('webapp', (ctx) => {
  ctx.reply('Open campaign creator:', {
    reply_markup: {
      inline_keyboard: [[
        { text: '📝 Open Form', web_app: { url: `${config.baseUrl}/dashboard` } }
      ]]
    }
  });
});

// ---------- /boost (কমান্ড লাইন) ----------
bot.command('boost', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return ctx.reply('User ID not found.');

  const user = await getUserByTelegramId(telegramId);
  if (!user) return ctx.reply('User not found. Please /start first.');

  const fb = await getActiveFacebookAccount(user.id);
  if (!fb) return ctx.reply('No linked Facebook account. Use /addaccount first.');

  const text = ctx.message?.text?.trim() || '';
  const parts = text.split(' ').slice(1);
  if (parts.length < 4) {
    return ctx.reply(
      '❌ Format:\n/boost <ad_account_id> <page_id> <post_id> <target_url> <budget> <duration>\n\n' +
      'Example:\n/boost act_123 456 789_post https://example.com 5 continuous',
      { parse_mode: 'Markdown' }
    );
  }

  const [adAccountId, pageId, postId, targetUrl, budgetStr, duration] = parts;
  const budget = parseFloat(budgetStr);
  if (isNaN(budget) || budget < 1) return ctx.reply('Invalid budget.');

  const meta = new MetaService(fb.access_token);

  try {
    const campaignParams = {
      name: `Boosted post ${postId}`,
      objective: 'LINK_CLICKS',
      status: 'PAUSED',
    };
    const campaign = await meta.createCampaign(adAccountId, campaignParams);

    await createCampaignRecord({
      userId: user.id,
      facebookAccountId: fb.id,
      adAccountId: adAccountId,
      metaCampaignId: campaign.id,
      pageId: pageId,
      postId: postId,
      objective: 'LINK_CLICKS',
      status: 'PAUSED',
      dailyBudget: duration === 'continuous' ? budget : null,
      lifetimeBudget: duration !== 'continuous' ? budget : null,
      startTime: new Date(),
      endTime: duration !== 'continuous' ? new Date(Date.now() + parseInt(duration) * 86400000) : null,
      targeting: { countries: ['BD'], age_min: 18, age_max: 65, gender: 'all' },
      creative: { target_url: targetUrl },
    });

    ctx.reply(`✅ Campaign created! ID: ${campaign.id}`);
  } catch (error: any) {
    console.error('Boost error:', error);
    ctx.reply('❌ Failed: ' + (error.message || 'Unknown error'));
  }
});

// ---------- Mini App থেকে ডাটা (ফর্ম সাবমিট) ----------
bot.on('web_app_data', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await getUserByTelegramId(telegramId);
  if (!user) return ctx.reply('User not found.');

  const fb = await getActiveFacebookAccount(user.id);
  if (!fb) return ctx.reply('No linked Facebook account.');

  try {
    const data = JSON.parse(ctx.message?.web_app_data?.data || '{}');
    const meta = new MetaService(fb.access_token);

    const campaignParams = {
      name: data.postId ? `Boosted post ${data.postId}` : `Traffic ad ${data.targetUrl}`,
      objective: data.objective || 'LINK_CLICKS',
      status: 'PAUSED',
    };
    const campaign = await meta.createCampaign(data.adAccountId, campaignParams);

    await createCampaignRecord({
      userId: user.id,
      facebookAccountId: fb.id,
      adAccountId: data.adAccountId,
      metaCampaignId: campaign.id,
      pageId: data.pageId,
      postId: data.postId,
      objective: campaignParams.objective,
      status: 'PAUSED',
      dailyBudget: data.durationType === 'continuous' ? data.budget : null,
      lifetimeBudget: data.durationType !== 'continuous' ? data.budget : null,
      startTime: new Date(),
      endTime: data.durationType !== 'continuous' ? new Date(Date.now() + data.days * 86400000) : null,
      targeting: {
        countries: data.countries,
        age_min: data.ageMin,
        age_max: data.ageMax,
        gender: data.gender,
      },
      creative: { target_url: data.targetUrl },
    });

    ctx.reply(`✅ Campaign created! ID: ${campaign.id}`);
  } catch (error: any) {
    console.error('WebApp boost error:', error);
    ctx.reply('❌ Failed: ' + (error.message || 'Unknown error'));
  }
});

// ---------- ত্রুটি ধরা ----------
bot.catch((err: any, ctx) => {
  console.error('❌ Bot error for update', ctx.updateType, ':', err);
});

// ---------- ওয়েবহুক সেটআপ ----------
const WEBHOOK_URL = `${config.baseUrl}/telegram/webhook`;
bot.telegram.setWebhook(WEBHOOK_URL);
console.log(`✅ Webhook set to ${WEBHOOK_URL}`);

export { bot };