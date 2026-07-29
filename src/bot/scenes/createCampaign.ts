import { Scenes, Markup } from 'telegraf';
import { getActiveFacebookAccount } from '../../models/facebookAccount';
import { getUserByTelegramId } from '../../models/user';
import { createCampaignRecord } from '../../models/campaign';
import { MetaService } from '../../services/metaService';

// সাহায্যকারী ফাংশন: এখন পর্যন্ত ক্যাম্পেইন ডেটার সারসংক্ষেপ তৈরি করে
function buildSummary(data: any): string {
  let summary = '*📋 Campaign Summary:*\n';
  if (data.adAccountId) summary += `• Ad Account: \`${data.adAccountId}\`\n`;
  if (data.pageId) summary += `• Page: \`${data.pageId}\`\n`;
  if (data.postId) summary += `• Post: \`${data.postId}\`\n`;
  if (data.cta) summary += `• CTA: \`${data.cta}\`\n`;
  if (data.creative?.targetUrl) summary += `• Target URL: \`${data.creative.targetUrl}\`\n`;
  if (data.targeting) {
    const t = data.targeting;
    summary += `• Countries: \`${t.countries?.join(', ') || 'All'}\`\n`;
    summary += `• Age: \`${t.age_min}-${t.age_max}\`\n`;
    summary += `• Gender: \`${t.gender}\`\n`;
  }
  if (data.dailyBudget) summary += `• Daily Budget: \`$${data.dailyBudget}\`\n`;
  if (data.lifetimeBudget) summary += `• Lifetime Budget: \`$${data.lifetimeBudget}\`\n`;
  if (data.startDate) summary += `• Start: \`${data.startDate}\`\n`;
  if (data.endDate) summary += `• End: \`${data.endDate}\`\n`;
  summary += '\n';
  return summary;
}

export const createCampaignScene = new Scenes.WizardScene(
  'CREATE_CAMPAIGN',

  // ========== ধাপ ১: অ্যাড অ্যাকাউন্ট নির্বাচন ==========
  async (ctx) => {
    (ctx as any).session.campaignData = {};

    const telegramId = ctx.from?.id;
    if (!telegramId) {
      await ctx.reply('User ID not found.');
      return ctx.scene.leave();
    }

    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply('User not found in database. Please /start first.');
      return ctx.scene.leave();
    }
    const fb = await getActiveFacebookAccount(user.id);
    if (!fb) {
      await ctx.reply('No linked Facebook account. Use /addaccount first.');
      return ctx.scene.leave();
    }

    const meta = new MetaService(fb.access_token);

    try {
      const businesses = await meta.getBusinesses();
      let adAccounts: any[] = [];
      if (businesses && businesses.length > 0) {
        adAccounts = await meta.getAdAccounts(businesses[0].id);
      }
      if (!adAccounts || adAccounts.length === 0) {
        adAccounts = await meta.getPersonalAdAccounts();
      }
      if (!adAccounts || adAccounts.length === 0) {
        await ctx.reply('No ad account found.');
        return ctx.scene.leave();
      }

      (ctx as any).session.meta = meta;
      (ctx as any).session.adAccounts = adAccounts;

      const buttons = adAccounts.map((acc: any) => [
        Markup.button.callback(`${acc.name} (${acc.currency})`, `select_adaccount_${acc.id}`)
      ]);

      await ctx.reply(
        '*Step 1/6: Select an Ad Account*\n' +
        'Choose one of your ad accounts below:',
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
      );

      return ctx.wizard.next();
    } catch (error: any) {
      console.error('Ad account fetch error:', error);
      await ctx.reply('Failed to fetch ad accounts. Try again later.');
      return ctx.scene.leave();
    }
  },

  // ========== ধাপ ২: ফেসবুক পেজ নির্বাচন ==========
  async (ctx) => {
    const data = (ctx as any).session.campaignData;
    const meta: MetaService = (ctx as any).session.meta;

    let msg = buildSummary(data);
    msg += '*Step 2/6: Select a Facebook Page*\n';
    msg += 'Choose a page to boost a post from:';

    try {
      const pages = await meta.getPages();
      if (!pages || pages.length === 0) {
        await ctx.reply('No Facebook Page found.');
        return ctx.scene.leave();
      }

      (ctx as any).session.pages = pages;

      const buttons = pages.map((page: any) => [
        Markup.button.callback(page.name, `select_page_${page.id}`)
      ]);

      await ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
      return ctx.wizard.next();
    } catch (error: any) {
      console.error('Page fetch error:', error);
      await ctx.reply('❌ Failed to fetch pages: ' + (error.message || 'Unknown error'));
      return ctx.scene.leave();
    }
  },

  // ========== ধাপ ৩: পোস্ট বা লিংক মোড ==========
  async (ctx) => {
    const data = (ctx as any).session.campaignData;
    let msg = buildSummary(data);
    msg += '*Step 3/6: Campaign Mode*\n';
    msg += 'Select whether you want to boost a post or run a traffic ad:';

    const modeButtons = [
      [Markup.button.callback('📌 Boost a Post (Post ID)', 'mode_post')],
      [Markup.button.callback('🔗 Traffic Ad (Link)', 'mode_link')],
    ];

    await ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(modeButtons) });
    return ctx.wizard.next();
  },

  // ========== ধাপ ৪: পোস্ট বা ইউআরএল সিলেক্ট ==========
  async (ctx) => {
    const data = (ctx as any).session.campaignData;
    const mode = (ctx as any).session.campaignMode;

    if (mode === 'post') {
      const meta: MetaService = (ctx as any).session.meta;
      const pages = (ctx as any).session.pages;
      const selectedPageId = data.pageId;
      const selectedPage = pages.find((p: any) => p.id === selectedPageId);

      let msg = buildSummary(data);
      msg += '*Step 4/6: Select a Post*\n';
      msg += 'Choose a post to boost:';

      try {
        const posts = await meta.getPagePosts(selectedPage.id, selectedPage.access_token);
        if (!posts || posts.length === 0) {
          await ctx.reply('No posts found on this page.');
          return ctx.scene.leave();
        }

        (ctx as any).session.posts = posts;

        const buttons = posts.slice(0, 8).map((post: any) => {
          const snippet = post.message ? post.message.substring(0, 40) + '...' : 'No text';
          return [Markup.button.callback(snippet, `select_post_${post.id}`)];
        });

        await ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
        return ctx.wizard.next();
      } catch (error: any) {
        console.error('Post fetch error:', error);
        await ctx.reply('Failed to fetch posts: ' + (error.message || 'Unknown error'));
        return ctx.scene.leave();
      }
    } else {
      // লিংক মোড
      let msg = buildSummary(data);
      msg += '*Step 4/6: Target URL*\n';
      msg += 'Send the URL where users will land (e.g., https://example.com):';
      await ctx.reply(msg, { parse_mode: 'Markdown' });
      return ctx.wizard.next();
    }
  },

  // ========== লিংক মোড: টার্গেট URL ইনপুট ==========
  async (ctx) => {
    const msgText = (ctx as any).message?.text?.trim();
    if (!msgText || !msgText.startsWith('http')) {
      await ctx.reply('Invalid URL. Please send a valid link starting with http:// or https://');
      return;
    }
    (ctx as any).session.campaignData.creative = { targetUrl: msgText };
    return ctx.wizard.next(); // CTA ধাপে যাও
  },

  // ========== ধাপ ৫: CTA নির্বাচন ==========
  async (ctx) => {
    const data = (ctx as any).session.campaignData;
    let msg = buildSummary(data);
    msg += '*Step 5/6: Select Call to Action (CTA)*\n';
    msg += 'Choose a button for your ad:';

    const ctaButtons = [
      [Markup.button.callback('Watch More', 'cta_WATCH_MORE'), Markup.button.callback('Learn More', 'cta_LEARN_MORE')],
      [Markup.button.callback('Shop Now', 'cta_SHOP_NOW'), Markup.button.callback('Order Now', 'cta_ORDER_NOW')],
      [Markup.button.callback('Sign Up', 'cta_SIGN_UP'), Markup.button.callback('Contact Us', 'cta_CONTACT_US')],
      [Markup.button.callback('Download', 'cta_DOWNLOAD'), Markup.button.callback('See Menu', 'cta_SEE_MENU')],
      [Markup.button.callback('Book Now', 'cta_BOOK_NOW'), Markup.button.callback('Apply Now', 'cta_APPLY_NOW')],
      [Markup.button.callback('No Button', 'cta_NONE')],
    ];

    await ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(ctaButtons) });
    return ctx.wizard.next();
  },

  // ========== ধাপ ৬: টার্গেটিং ==========
  async (ctx) => {
    const data = (ctx as any).session.campaignData;
    data.targeting = data.targeting || { countries: [], age_min: 18, age_max: 65, gender: 'all' };

    let msg = buildSummary(data);
    msg += '*Step 6/6: Targeting & Budget*\n';
    msg += 'Send the following details in order:\n';
    msg += '1️⃣ Minimum age (13-65) or "skip"\n';
    msg += '2️⃣ Maximum age or "skip"\n';
    msg += '3️⃣ Gender: Send "male", "female", or "all"\n';
    msg += '4️⃣ Countries: Comma separated (e.g., BD, US, IN) or "all"\n\n';
    msg += 'Now, send **minimum age** or type "skip":';

    await ctx.reply(msg, { parse_mode: 'Markdown' });
    return ctx.wizard.next();
  },

  // মিনিমাম বয়স ইনপুট
  async (ctx) => {
    const msg = (ctx as any).message?.text?.trim();
    if (msg && msg.toLowerCase() !== 'skip') {
      const ageMin = parseInt(msg);
      if (isNaN(ageMin) || ageMin < 13 || ageMin > 65) {
        await ctx.reply('Invalid age. Please send a number between 13 and 65.');
        return;
      }
      (ctx as any).session.campaignData.targeting.age_min = ageMin;
    }
    await ctx.reply('Now send **maximum age** (e.g., 65) or "skip":');
    return ctx.wizard.next();
  },

  // ম্যাক্সিমাম বয়স ইনপুট
  async (ctx) => {
    const msg = (ctx as any).message?.text?.trim();
    if (msg && msg.toLowerCase() !== 'skip') {
      const ageMax = parseInt(msg);
      const minAge = (ctx as any).session.campaignData.targeting.age_min;
      if (isNaN(ageMax) || ageMax < minAge || ageMax > 65) {
        await ctx.reply(`Invalid age. Please send a number between ${minAge} and 65.`);
        return;
      }
      (ctx as any).session.campaignData.targeting.age_max = ageMax;
    }
    await ctx.reply('Now send **gender** ("male", "female", or "all"):');
    return ctx.wizard.next();
  },

  // জেন্ডার ইনপুট
  async (ctx) => {
    const msg = (ctx as any).message?.text?.trim().toLowerCase();
    if (['male', 'female', 'all'].includes(msg)) {
      (ctx as any).session.campaignData.targeting.gender = msg;
    } else {
      await ctx.reply('Invalid gender. Please send "male", "female", or "all".');
      return;
    }
    await ctx.reply('Now send **countries** (comma separated, e.g., BD, US, IN) or "all":');
    return ctx.wizard.next();
  },

  // কান্ট্রি ইনপুট ও বাজেটে যাও
  async (ctx) => {
    const msg = (ctx as any).message?.text?.trim();
    if (msg.toLowerCase() === 'all') {
      (ctx as any).session.campaignData.targeting.countries = ['all'];
    } else {
      const countries = msg.split(',').map((c: string) => c.trim()).filter(Boolean);
      (ctx as any).session.campaignData.targeting.countries = countries;
    }

    let summary = buildSummary((ctx as any).session.campaignData);
    summary += 'Now send the **budget & schedule**:\n';
    summary += 'Send daily budget in USD (minimum 1), or type "lifetime" for lifetime budget.';
    await ctx.reply(summary, { parse_mode: 'Markdown' });
    return ctx.wizard.next();
  },

  // বাজেট: ডেইলি বা লাইফটাইম
  async (ctx) => {
    const msg = (ctx as any).message?.text?.trim().toLowerCase();
    if (msg === 'lifetime') {
      await ctx.reply('Send total lifetime budget in USD (minimum 1):');
      return ctx.wizard.next();
    }
    const amount = parseFloat(msg);
    if (isNaN(amount) || amount < 1) {
      await ctx.reply('Invalid budget. Please send a number greater than 0.');
      return;
    }
    (ctx as any).session.campaignData.dailyBudget = amount;
    (ctx as any).session.campaignData.budgetType = 'daily';
    await ctx.reply('Send start date (YYYY-MM-DD) or "today", or "continuous" for no end:');
    return ctx.wizard.selectStep(15); // তারিখ ইনপুট ধাপে স্কিপ
  },

  // লাইফটাইম বাজেট ইনপুট
  async (ctx) => {
    const amount = parseFloat((ctx as any).message?.text?.trim());
    if (isNaN(amount) || amount < 1) {
      await ctx.reply('Invalid budget. Please send a number greater than 0.');
      return;
    }
    (ctx as any).session.campaignData.lifetimeBudget = amount;
    (ctx as any).session.campaignData.budgetType = 'lifetime';
    await ctx.reply('Send start date (YYYY-MM-DD) or "today", or "continuous" for no end:');
    return ctx.wizard.next();
  },

  // তারিখ ইনপুট (শুরুর তারিখ)
  async (ctx) => {
    const msg = (ctx as any).message?.text?.trim().toLowerCase();
    if (msg === 'continuous') {
      (ctx as any).session.campaignData.startDate = new Date().toISOString().split('T')[0];
      (ctx as any).session.campaignData.endDate = null;
    } else if (msg === 'today') {
      (ctx as any).session.campaignData.startDate = new Date().toISOString().split('T')[0];
      await ctx.reply('Send end date (YYYY-MM-DD) or "none" for no end date:');
      return ctx.wizard.next();
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(msg)) {
      (ctx as any).session.campaignData.startDate = msg;
      await ctx.reply('Send end date (YYYY-MM-DD) or "none" for no end date:');
      return ctx.wizard.next();
    } else {
      await ctx.reply('Invalid format. Use YYYY-MM-DD, "today", or "continuous".');
      return;
    }
    // যদি কন্টিনিউয়াস হয়, সরাসরি কনফার্মেশনে
    return ctx.wizard.selectStep(17); // কনফার্মেশন ধাপ
  },

  // শেষ তারিখ ইনপুট (যদি কন্টিনিউয়াস না হয়)
  async (ctx) => {
    const msg = (ctx as any).message?.text?.trim().toLowerCase();
    if (msg === 'none') {
      (ctx as any).session.campaignData.endDate = null;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(msg)) {
      (ctx as any).session.campaignData.endDate = msg;
    } else {
      await ctx.reply('Invalid format. Use YYYY-MM-DD or "none".');
      return;
    }
    // কনফার্মেশন ধাপে যাও
    return ctx.wizard.selectStep(17);
  },

  // ========== কনফার্মেশন ==========
  async (ctx) => {
    const data = (ctx as any).session.campaignData;
    const summary = buildSummary(data);
    const confirmMsg = summary + '*Confirm and create campaign?*';

    const confirmButtons = [
      [Markup.button.callback('✅ Confirm', 'confirm_campaign'), Markup.button.callback('❌ Cancel', 'cancel_campaign')],
    ];

    await ctx.reply(confirmMsg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(confirmButtons) });
    return ctx.wizard.next();
  },

  async (ctx) => {
    // অ্যাকশন হ্যান্ডলারগুলো সব কাজ করবে, এই ফাঁকা ধাপ শুধু অপেক্ষার জন্য
    return;
  }
);

// ===================== অ্যাকশন হ্যান্ডলারসমূহ =====================
createCampaignScene.action(/^select_adaccount_(.+)$/, async (ctx) => {
  (ctx as any).session.campaignData.adAccountId = ctx.match[1];
  await ctx.answerCbQuery('Ad account selected');
  await ctx.wizard.next();
});

createCampaignScene.action(/^select_page_(.+)$/, async (ctx) => {
  (ctx as any).session.campaignData.pageId = ctx.match[1];
  await ctx.answerCbQuery('Page selected');
  await ctx.wizard.next();
});

createCampaignScene.action('mode_post', async (ctx) => {
  (ctx as any).session.campaignMode = 'post';
  await ctx.answerCbQuery('Post mode selected');
  await ctx.wizard.next();
});

createCampaignScene.action('mode_link', async (ctx) => {
  (ctx as any).session.campaignMode = 'link';
  await ctx.answerCbQuery('Link mode selected');
  await ctx.wizard.next();
});

createCampaignScene.action(/^select_post_(.+)$/, async (ctx) => {
  (ctx as any).session.campaignData.postId = ctx.match[1];
  await ctx.answerCbQuery('Post selected');
  // পোস্ট সিলেক্টের পর CTA ধাপে চলে যাই (5)
  await ctx.wizard.selectStep(5);
});

createCampaignScene.action(/^cta_(.+)$/, async (ctx) => {
  const cta = ctx.match[1];
  (ctx as any).session.campaignData.cta = cta;
  await ctx.answerCbQuery(`CTA: ${cta}`);
  await ctx.wizard.next();
});

createCampaignScene.action('confirm_campaign', async (ctx) => {
  await ctx.answerCbQuery('Creating campaign...');
  const data = (ctx as any).session.campaignData;
  const meta: MetaService = (ctx as any).session.meta;
  const telegramId = ctx.from?.id;

  try {
    const campaignParams = {
      name: data.postId ? `Boosted post ${data.postId}` : `Traffic ad ${data.creative?.targetUrl}`,
      objective: data.cta && data.cta !== 'NONE' ? 'LINK_CLICKS' : 'POST_ENGAGEMENT',
      status: 'PAUSED',
    };
    const campaign = await meta.createCampaign(data.adAccountId, campaignParams);

    const user = await getUserByTelegramId(telegramId!);
    const fb = user ? await getActiveFacebookAccount(user.id) : null;

    await createCampaignRecord({
      userId: user ? user.id : '',
      facebookAccountId: fb?.id || '',
      adAccountId: data.adAccountId,
      metaCampaignId: campaign.id,
      pageId: data.pageId,
      postId: data.postId || '',
      objective: campaignParams.objective,
      status: 'PAUSED',
      dailyBudget: data.budgetType === 'daily' ? data.dailyBudget : null,
      lifetimeBudget: data.budgetType === 'lifetime' ? data.lifetimeBudget : null,
      startTime: data.startDate ? new Date(data.startDate) : null,
      endTime: data.endDate ? new Date(data.endDate) : null,
      targeting: data.targeting,
      creative: data.creative || {},
    });

    await ctx.reply(`✅ Campaign created! ID: ${campaign.id}`);
  } catch (error: any) {
    console.error('Campaign creation error:', error);
    await ctx.reply('❌ Failed to create campaign: ' + (error.message || 'Unknown error'));
  }
  return ctx.scene.leave();
});

createCampaignScene.action('cancel_campaign', async (ctx) => {
  await ctx.answerCbQuery('Cancelled');
  await ctx.reply('Campaign creation cancelled.');
  return ctx.scene.leave();
});