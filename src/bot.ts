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

bot.start(startCommand);

bot.command('create', (ctx) => {
  console.log('/create triggered');
  (ctx as any).scene.enter('CREATE_CAMPAIGN');
});

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

bot.command('cancel', (ctx) => {
  try {
    (ctx as any).scene.leave();
  } catch (e) {}
  ctx.reply('✅ Wizard cancelled. You can now use other commands.');
});

bot.command('listaccounts', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return ctx.reply('User ID not found.');

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

bot.catch((err: any, ctx) => {
  console.error('❌ Bot error for update', ctx.updateType, ':', err);
});

const WEBHOOK_URL = `${config.baseUrl}/telegram/webhook`;
bot.telegram.setWebhook(WEBHOOK_URL);
console.log(`✅ Webhook set to ${WEBHOOK_URL}`);

export { bot };