import { Scenes, Markup } from 'telegraf';
import { getActiveFacebookAccount } from '../../models/facebookAccount';
import { getUserByTelegramId } from '../../models/user';
import { createCampaignRecord } from '../../models/campaign';
import { MetaService } from '../../services/metaService';

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
        '*Create Campaign - Step 1/7*\n\nSelect an ad account:',
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
    console.log('Wizard Step 2 entered');
    const meta: MetaService = (ctx as any).session.meta;

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

      await ctx.reply(
        `✅ Ad account selected.\n\n*Create Campaign - Step 2/7*\n\nSelect a Facebook Page:`,
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
      );

      return ctx.wizard.next();
    } catch (error: any) {
      console.error('Page fetch error:', error);
      await ctx.reply('❌ Failed to fetch pages: ' + (error.message || 'Unknown error'));
      return ctx.scene.leave();
    }
  },

  // ========== ধাপ ৩: পোস্ট নির্বাচন (Post ID Mode / Link Mode) ==========
  async (ctx) => {
    const meta: MetaService = (ctx as any).session.meta;
    const pages = (ctx as any).session.pages;
    const selectedPageId = (ctx as any).session.campaignData.pageId;

    const selectedPage = pages.find((p: any) => p.id === selectedPageId);
    if (!selectedPage) {
      await ctx.reply('Selected page not found.');
      return ctx.scene.leave();
    }

    // প্রথমে মোড নির্বাচন: Post ID Mode নাকি Link Mode
    const modeButtons = [
      [Markup.button.callback('📌 Post ID Mode (Boost Post)', 'mode_post')],
      [Markup.button.callback('🔗 Link Mode (Traffic Ad)', 'mode_link')],
    ];

    await ctx.reply(
      `✅ Page selected.\n\n*Create Campaign - Step 3/7*\n\nSelect campaign mode:`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(modeButtons) }
    );

    return ctx.wizard.next();
  },

  // ========== ধাপ ৩-এক্সটেনশন: পোস্ট বা লিংক মোড ==========
  async (ctx) => {
    // এই ধাপে আমরা callback থেকে আসা মোড অনুযায়ী কাজ করি।
    // পোস্ট মোড হলে পোস্ট সিলেক্ট দেখাবে, লিংক মোড হলে মিডিয়া/লিংক চাইবে।
    const mode = (ctx as any).session.campaignMode;
    if (mode === 'post') {
      const meta: MetaService = (ctx as any).session.meta;
      const pages = (ctx as any).session.pages;
      const selectedPageId = (ctx as any).session.campaignData.pageId;
      const selectedPage = pages.find((p: any) => p.id === selectedPageId);

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

        await ctx.reply(
          `✅ Mode: Post ID\n\n*Create Campaign - Step 4/7*\n\nSelect a post to boost:`,
          { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
        );

        return ctx.wizard.next();
      } catch (error: any) {
        console.error('Post fetch error:', error);
        await ctx.reply('Failed to fetch posts: ' + (error.message || 'Unknown error'));
        return ctx.scene.leave();
      }
    } else {
      // লিংক মোড – মিডিয়া ও টার্গেট URL চাইবে
      (ctx as any).session.campaignData.creative = { link_mode: true };
      await ctx.reply(
        `✅ Mode: Link Traffic\n\n*Create Campaign - Step 4/7*\n\nSend the Target URL (e.g., https://example.com):`
      );
      return ctx.wizard.next();
    }
  },

  // ========== লিংক মোড: টার্গেট URL ইনপুট ==========
  async (ctx) => {
    const msg = (ctx as any).message?.text?.trim();
    if (!msg || !msg.startsWith('http')) {
      await ctx.reply('Invalid URL. Please send a valid link starting with http:// or https://');
      return;
    }
    (ctx as any).session.campaignData.creative.targetUrl = msg;
    // এখন CTA নির্বাচন
    return ctx.wizard.next(); // সবার জন্য CTA ধাপ
  },

  // ========== ধাপ ৫: CTA (Call to Action) নির্বাচন ==========
  async (ctx) => {
    const ctaButtons = [
      [Markup.button.callback('Watch More', 'cta_WATCH_MORE'), Markup.button.callback('Learn More', 'cta_LEARN_MORE')],
      [Markup.button.callback('Shop Now', 'cta_SHOP_NOW'), Markup.button.callback('Order Now', 'cta_ORDER_NOW')],
      [Markup.button.callback('Sign Up', 'cta_SIGN_UP'), Markup.button.callback('Contact Us', 'cta_CONTACT_US')],
      [Markup.button.callback('Download', 'cta_DOWNLOAD'), Markup.button.callback('See Menu', 'cta_SEE_MENU')],
      [Markup.button.callback('Book Now', 'cta_BOOK_NOW'), Markup.button.callback('Apply Now', 'cta_APPLY_NOW')],
      [Markup.button.callback('No Button', 'cta_NONE')],
    ];

    await ctx.reply(
      `✅ Step 5/7: Select Call to Action (CTA) button:`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(ctaButtons) }
    );

    return ctx.wizard.next();
  },

  // ========== ধাপ ৬: টার্গেটিং (দেশ, বয়স, লিঙ্গ, প্লেসমেন্ট) ==========
  async (ctx) => {
    (ctx as any).session.campaignData.targeting = {
      countries: [],
      age_min: 18,
      age_max: 65,
      gender: 'all',
      placements: ['auto'],
    };

    const countryButtons = [
      [Markup.button.callback('🇧🇩 Bangladesh', 'target_country_BD'), Markup.button.callback('🇮🇳 India', 'target_country_IN')],
      [Markup.button.callback('🇺🇸 United States', 'target_country_US'), Markup.button.callback('🇬🇧 United Kingdom', 'target_country_GB')],
      [Markup.button.callback('🌍 All Countries', 'target_country_all')],
      [Markup.button.callback('➡️ Next (Age & Gender)', 'target_next')],
    ];

    await ctx.reply(
      '*Step 6/7: Targeting*\n\nSelect target country (you can select multiple, then press Next):',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(countryButtons) }
    );

    return ctx.wizard.next();
  },

  // ========== বয়স ও লিঙ্গ ইনপুট (একই ধাপে থেকে টেক্সট ইনপুট) ==========
  async (ctx) => {
    const targeting = (ctx as any).session.campaignData.targeting;
    const countries = targeting.countries.length === 0 ? 'All' : targeting.countries.join(', ');
    await ctx.reply(
      `*Current targeting:*\nCountry: ${countries}\nAge: ${targeting.age_min}-${targeting.age_max}\nGender: ${targeting.gender}\n\n` +
      `Send minimum age (e.g., 18) or type "skip" to keep current:`,
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },

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
    await ctx.reply('Now send maximum age (e.g., 65) or "skip":');
    return ctx.wizard.next();
  },

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
    const genderButtons = [
      [Markup.button.callback('All', 'gender_all'), Markup.button.callback('Male', 'gender_male'), Markup.button.callback('Female', 'gender_female')],
    ];
    await ctx.reply('Select gender:', Markup.inlineKeyboard(genderButtons));
    return ctx.wizard.next();
  },

  // ========== ধাপ ৭: বাজেট ও সময় ==========
  async (ctx) => {
    (ctx as any).session.campaignData.dailyBudget = null;
    (ctx as any).session.campaignData.lifetimeBudget = null;
    await ctx.reply(
      '*Step 7/7: Budget & Schedule*\n\n' +
      'Send daily budget in USD (minimum 1). For example: 5\n' +
      'Or type "lifetime" to set lifetime budget instead.',
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },

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
    await ctx.reply('Send start date (YYYY-MM-DD) or "today":');
    return ctx.wizard.selectStep(14);
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
    await ctx.reply('Send start date (YYYY-MM-DD) or "today":');
    return ctx.wizard.next();
  },

  // শুরুর তারিখ
  async (ctx) => {
    const msg = (ctx as any).message?.text?.trim().toLowerCase();
    let startDate: string;
    if (msg === 'today') {
      startDate = new Date().toISOString().split('T')[0];
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(msg)) {
        await ctx.reply('Invalid date format. Use YYYY-MM-DD or "today".');
        return;
      }
      startDate = msg;
    }
    (ctx as any).session.campaignData.startDate = startDate;
    await ctx.reply('Send end date (YYYY-MM-DD) or "none" for no end date:');
    return ctx.wizard.next();
  },

  // শেষ তারিখ
  async (ctx) => {
    const msg = (ctx as any).message?.text?.trim().toLowerCase();
    if (msg !== 'none') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(msg)) {
        await ctx.reply('Invalid date format. Use YYYY-MM-DD or "none".');
        return;
      }
      (ctx as any).session.campaignData.endDate = msg;
    }

    const data = (ctx as any).session.campaignData;
    const summary = `
*Confirm Campaign Details:*

- Ad Account: ${data.adAccountId}
- Page: ${data.pageId}
- Post: ${data.postId || 'Link Mode'}
- CTA: ${data.cta || 'None'}
- Targeting: Country ${data.targeting.countries.join(', ') || 'All'}, Age ${data.targeting.age_min}-${data.targeting.age_max}, Gender ${data.targeting.gender}
- Budget: ${data.budgetType === 'daily' ? 'Daily $' + data.dailyBudget : 'Lifetime $' + data.lifetimeBudget}
- Start: ${data.startDate} ${data.endDate ? 'End: ' + data.endDate : 'No end date'}

Create campaign?`;

    const confirmButtons = [
      [Markup.button.callback('✅ Confirm', 'confirm_campaign'), Markup.button.callback('❌ Cancel', 'cancel_campaign')],
    ];

    await ctx.reply(summary, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(confirmButtons) });
    return ctx.wizard.next();
  },

  async (ctx) => {
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
  // পোস্ট সিলেক্টের পর CTA ধাপে যাই
  await ctx.wizard.selectStep(5); // CTA step index (0-based: step 5 = index 5)
});

createCampaignScene.action(/^cta_(.+)$/, async (ctx) => {
  const cta = ctx.match[1];
  (ctx as any).session.campaignData.cta = cta;
  await ctx.answerCbQuery(`CTA set to ${cta}`);
  await ctx.wizard.next();
});

createCampaignScene.action(/^target_country_(.+)$/, async (ctx) => {
  const country = ctx.match[1];
  const targeting = (ctx as any).session.campaignData.targeting;
  if (country === 'all') {
    targeting.countries = ['all'];
  } else {
    if (targeting.countries.includes(country)) {
      targeting.countries = targeting.countries.filter((c: string) => c !== country);
    } else {
      targeting.countries.push(country);
    }
  }
  await ctx.answerCbQuery(`Country selection updated`);
});

createCampaignScene.action('target_next', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.wizard.next();
});

createCampaignScene.action(/^gender_(.+)$/, async (ctx) => {
  (ctx as any).session.campaignData.targeting.gender = ctx.match[1];
  await ctx.answerCbQuery(`Gender set to ${ctx.match[1]}`);
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