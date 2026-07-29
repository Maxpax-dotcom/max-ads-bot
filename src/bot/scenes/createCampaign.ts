// Telegraf থেকে প্রয়োজনীয় ফাংশন ইমপোর্ট
import { Scenes, Markup } from 'telegraf';
// ডাটাবেস থেকে অ্যাক্টিভ ফেসবুক অ্যাকাউন্ট আনার ফাংশন
import { getActiveFacebookAccount } from '../../models/facebookAccount';
// ইউজারের UUID বের করার ফাংশন (টেলিগ্রাম আইডি থেকে)
import { getUserByTelegramId } from '../../models/user';
// ক্যাম্পেইন ডাটাবেসে সংরক্ষণের ফাংশন
import { createCampaignRecord } from '../../models/campaign';
// মেটা API সার্ভিস
import { MetaService } from '../../services/metaService';

// ক্যাম্পেইন তৈরির উইজার্ড সিন তৈরি
export const createCampaignScene = new Scenes.WizardScene(
  'CREATE_CAMPAIGN',

  // ========== ধাপ ১: অ্যাড অ্যাকাউন্ট নির্বাচন ==========
  async (ctx) => {
  console.log('Wizard Step 1 entered');
  await ctx.reply('✅ Campaign wizard started! Select an option (coming soon).');
  return ctx.scene.leave();
},

    // ---------- UUID ফিক্স ----------
    // প্রথমে টেলিগ্রাম আইডি থেকে users টেবিলের UUID বের করো
    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply('User not found in database. Please /start first.');
      return ctx.scene.leave();
    }
    // UUID ব্যবহার করে অ্যাক্টিভ ফেসবুক অ্যাকাউন্ট খুঁজো
    const fb = await getActiveFacebookAccount(user.id);
    // --------------------------------

    if (!fb) {
      await ctx.reply('No linked Facebook account. Use /addaccount first.');
      return ctx.scene.leave();
    }

    const meta = new MetaService(fb.access_token);

    try {
      // ---------- ফলব্যাক লজিক (বিজনেস ম্যানেজার → ব্যক্তিগত অ্যাকাউন্ট) ----------
      const businesses = await meta.getBusinesses();
      let adAccounts: any[] = [];

      // প্রথমে বিজনেস ম্যানেজার থাকলে তার অ্যাড অ্যাকাউন্ট আনার চেষ্টা
      if (businesses && businesses.length > 0) {
        adAccounts = await meta.getAdAccounts(businesses[0].id);
      }

      // যদি বিজনেস অ্যাকাউন্ট না থাকে বা খালি আসে, তাহলে ব্যক্তিগত অ্যাড অ্যাকাউন্ট আনো
      if (!adAccounts || adAccounts.length === 0) {
        adAccounts = await meta.getPersonalAdAccounts(); // এই মেথডটি MetaService-এ এখনো নেই, পরের ধাপে যোগ করবো
      }
      // -------------------------------------------------------------------------

      if (!adAccounts || adAccounts.length === 0) {
        await ctx.reply('No ad account found.');
        return ctx.scene.leave();
      }

      // সেশনে মেটা সার্ভিস ও অ্যাড অ্যাকাউন্ট সংরক্ষণ করো
      (ctx as any).session.meta = meta;
      (ctx as any).session.adAccounts = adAccounts;

      // প্রতিটি অ্যাড অ্যাকাউন্টের জন্য বাটন তৈরি
      const buttons = adAccounts.map((acc: any) => [
        Markup.button.callback(`${acc.name} (${acc.currency})`, `select_adaccount_${acc.id}`)
      ]);

      await ctx.reply(
        '*Create Campaign - Step 1/6*\n\nSelect an ad account:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons)
        }
      );

      return ctx.wizard.next();
    } catch (error) {
      console.error('Ad account fetch error:', error);
      await ctx.reply('Failed to fetch ad accounts. Try again later.');
      return ctx.scene.leave();
    }
  },

  // ========== ধাপ ২: ফেসবুক পেজ নির্বাচন ==========
  async (ctx) => {
    const meta: MetaService = (ctx as any).session.meta;

    try {
      const pages = await meta.getPages();
      if (!pages || pages.length === 0) {
        await ctx.reply('No Facebook Page found.');
        return ctx.scene.leave();
      }

      (ctx as any).session.pages = pages;

      const buttons = pages.map((page: any) => [
        Markup.button.callback(`${page.name}`, `select_page_${page.id}`)
      ]);

      await ctx.reply(
        '*Create Campaign - Step 2/6*\n\nSelect a Facebook Page:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons)
        }
      );

      return ctx.wizard.next();
    } catch (error) {
      console.error('Page fetch error:', error);
      await ctx.reply('Failed to fetch pages.');
      return ctx.scene.leave();
    }
  },

  // ========== ধাপ ৩: পেজের পোস্ট নির্বাচন ==========
  async (ctx) => {
    const meta: MetaService = (ctx as any).session.meta;
    const pages = (ctx as any).session.pages;
    const selectedPageId = (ctx as any).session.campaignData.pageId;

    const selectedPage = pages.find((p: any) => p.id === selectedPageId);
    if (!selectedPage) {
      await ctx.reply('Selected page not found.');
      return ctx.scene.leave();
    }

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
        '*Create Campaign - Step 3/6*\n\nSelect a post to boost:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons)
        }
      );

      return ctx.wizard.next();
    } catch (error) {
      console.error('Post fetch error:', error);
      await ctx.reply('Failed to fetch posts.');
      return ctx.scene.leave();
    }
  },

  // ========== ধাপ ৪: টার্গেটিং সেট করা ==========
  async (ctx) => {
    (ctx as any).session.campaignData.targeting = {
      countries: ['BD'],
      age_min: 18,
      age_max: 65,
      gender: 'all',
      placements: ['auto'],
    };

    const countryButtons = [
      [
        Markup.button.callback('🇧🇩 Bangladesh', 'target_country_BD'),
        Markup.button.callback('🇮🇳 India', 'target_country_IN'),
      ],
      [
        Markup.button.callback('🇺🇸 United States', 'target_country_US'),
        Markup.button.callback('🇬🇧 United Kingdom', 'target_country_GB'),
      ],
      [
        Markup.button.callback('🌍 All Countries', 'target_country_all'),
      ],
      [Markup.button.callback('➡️ Next (Age & Gender)', 'target_next')],
    ];

    await ctx.reply(
      '*Create Campaign - Step 4/6: Targeting*\n\nSelect target country:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(countryButtons)
      }
    );

    return ctx.wizard.next();
  },

  // ========== ধাপ ৪-এক্সটেনশন: বয়স ও লিঙ্গ নির্বাচন ==========
  async (ctx) => {
    const targeting = (ctx as any).session.campaignData.targeting;
    const countries = targeting.countries.includes('all') ? 'All' : targeting.countries.join(', ');

    await ctx.reply(
      `*Current targeting:*\n` +
      `Country: ${countries}\n` +
      `Age: ${targeting.age_min}-${targeting.age_max}\n` +
      `Gender: ${targeting.gender}\n\n` +
      `Send minimum age (e.g., 18) or type "skip" to keep current:`,
      { parse_mode: 'Markdown' }
    );

    return ctx.wizard.next();
  },

  // ========== বয়স ইনপুট হ্যান্ডলার ==========
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

  // ========== বয়স সর্বোচ্চ ইনপুট হ্যান্ডলার ==========
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
      [
        Markup.button.callback('All', 'gender_all'),
        Markup.button.callback('Male', 'gender_male'),
        Markup.button.callback('Female', 'gender_female'),
      ],
    ];

    await ctx.reply('Select gender:', Markup.inlineKeyboard(genderButtons));
    return ctx.wizard.next();
  },

  // ========== লিঙ্গ নির্বাচন হয়ে গেলে বাজেট ধাপ ==========
  async (ctx) => {
    return ctx.wizard.next();
  },

  // ========== ধাপ ৫: বাজেট ও সময় ==========
  async (ctx) => {
    (ctx as any).session.campaignData.dailyBudget = null;
    (ctx as any).session.campaignData.lifetimeBudget = null;

    await ctx.reply(
      '*Create Campaign - Step 5/6: Budget & Schedule*\n\n' +
      'Send daily budget in USD (minimum 1). For example: 5\n' +
      'Or type "lifetime" to set lifetime budget instead.',
      { parse_mode: 'Markdown' }
    );

    return ctx.wizard.next();
  },

  // ========== বাজেট ইনপুট হ্যান্ডলার ==========
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
    return ctx.wizard.selectStep(11);
  },

  // ========== লাইফটাইম বাজেট ইনপুট ==========
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

  // ========== শুরুর তারিখ ইনপুট ==========
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

  // ========== শেষ তারিখ ইনপুট ==========
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
- Post: ${data.postId}
- Targeting: Country ${data.targeting.countries.join(', ')}, Age ${data.targeting.age_min}-${data.targeting.age_max}, Gender ${data.targeting.gender}
- Budget: ${data.budgetType === 'daily' ? 'Daily $' + data.dailyBudget : 'Lifetime $' + data.lifetimeBudget}
- Start: ${data.startDate} ${data.endDate ? 'End: ' + data.endDate : 'No end date'}

Create campaign?`;

    const confirmButtons = [
      [
        Markup.button.callback('✅ Confirm', 'confirm_campaign'),
        Markup.button.callback('❌ Cancel', 'cancel_campaign'),
      ],
    ];

    await ctx.reply(summary, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(confirmButtons),
    });

    return ctx.wizard.next();
  },

  // ========== ফাইনাল ধাপ (অ্যাকশন হ্যান্ডলার) ==========
  async (ctx) => {
    // nothing, action handlers take over
    return;
  }
);

// ===================== অ্যাকশন হ্যান্ডলারসমূহ =====================

createCampaignScene.action(/^select_adaccount_(.+)$/, async (ctx) => {
  const accountId = ctx.match[1];
  (ctx as any).session.campaignData.adAccountId = accountId;
  await ctx.answerCbQuery('Ad account selected');
  await ctx.wizard.next();
});

createCampaignScene.action(/^select_page_(.+)$/, async (ctx) => {
  const pageId = ctx.match[1];
  (ctx as any).session.campaignData.pageId = pageId;
  await ctx.answerCbQuery('Page selected');
  await ctx.wizard.next();
});

createCampaignScene.action(/^select_post_(.+)$/, async (ctx) => {
  const postId = ctx.match[1];
  (ctx as any).session.campaignData.postId = postId;
  await ctx.answerCbQuery('Post selected');
  await ctx.wizard.next();
});

createCampaignScene.action(/^target_country_(.+)$/, async (ctx) => {
  const country = ctx.match[1];
  const targeting = (ctx as any).session.campaignData.targeting;
  if (country === 'all') {
    targeting.countries = ['all'];
  } else {
    targeting.countries = [country];
  }
  await ctx.answerCbQuery(`Country set to ${country}`);
});

createCampaignScene.action('target_next', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.wizard.next();
});

createCampaignScene.action(/^gender_(.+)$/, async (ctx) => {
  const gender = ctx.match[1];
  (ctx as any).session.campaignData.targeting.gender = gender;
  await ctx.answerCbQuery(`Gender set to ${gender}`);
  await ctx.wizard.next();
  await ctx.wizard.next();
});

createCampaignScene.action('confirm_campaign', async (ctx) => {
  await ctx.answerCbQuery('Creating campaign...');
  const data = (ctx as any).session.campaignData;
  const meta: MetaService = (ctx as any).session.meta;
  const telegramId = ctx.from?.id;

  try {
    const campaignParams = {
      name: `Boosted post ${data.postId}`,
      objective: 'POST_ENGAGEMENT',
      status: 'PAUSED',
    };
    const campaign = await meta.createCampaign(data.adAccountId, campaignParams);

    // ইউজারের UUID পেতে getUserByTelegramId ব্যবহার করি
    const user = await getUserByTelegramId(telegramId!);
    const fb = user ? await getActiveFacebookAccount(user.id) : null;

    await createCampaignRecord({
      userId: user ? user.id : '',
      facebookAccountId: fb?.id || '',
      adAccountId: data.adAccountId,
      metaCampaignId: campaign.id,
      pageId: data.pageId,
      postId: data.postId,
      objective: 'POST_ENGAGEMENT',
      status: 'PAUSED',
      dailyBudget: data.budgetType === 'daily' ? data.dailyBudget : null,
      lifetimeBudget: data.budgetType === 'lifetime' ? data.lifetimeBudget : null,
      startTime: data.startDate ? new Date(data.startDate) : null,
      endTime: data.endDate ? new Date(data.endDate) : null,
      targeting: data.targeting,
      creative: {},
    });

    await ctx.reply(`✅ Campaign created! ID: ${campaign.id}`);
    await ctx.reply('You can manage it from /dashboard (web) or /active');
  } catch (error) {
    console.error('Campaign creation error:', error);
    await ctx.reply('❌ Failed to create campaign. Please check your permissions and budget.');
  }
  return ctx.scene.leave();
});

createCampaignScene.action('cancel_campaign', async (ctx) => {
  await ctx.answerCbQuery('Cancelled');
  await ctx.reply('Campaign creation cancelled.');
  return ctx.scene.leave();
});