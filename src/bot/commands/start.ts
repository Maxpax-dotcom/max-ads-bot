import { Context } from 'telegraf';

export async function startCommand(ctx: Context) {
  console.log('start command triggered');
  await ctx.reply('✅ Bot is online! We are fixing the database connection. Please wait.');
}