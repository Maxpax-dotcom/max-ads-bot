import axios from 'axios';

/**
 * মেটা (ফেসবুক) মার্কেটিং API-এর সাথে যোগাযোগের ক্লাস।
 * প্রতিটি মেথডই অফিশিয়াল গ্রাফ API এন্ডপয়েন্ট ব্যবহার করে।
 */
export class MetaService {
  // ফেসবুক অ্যাকাউন্টের অ্যাক্সেস টোকেন, যা ডাটাবেস থেকে ডিক্রিপ্ট করা হয়েছে
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * ইউজারের সব বিজনেস ম্যানেজার/পোর্টফোলিওর তালিকা আনে।
   * এন্ডপয়েন্ট: GET /me/businesses
   */
  async getBusinesses() {
    const res = await axios.get('https://graph.facebook.com/v18.0/me/businesses', {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    return res.data.data;
  }

  /**
   * নির্দিষ্ট একটি বিজনেসের অধীনে থাকা অ্যাড অ্যাকাউন্টগুলোর তালিকা আনে।
   * এন্ডপয়েন্ট: GET /{business-id}/owned_ad_accounts
   */
  async getAdAccounts(businessId: string) {
    const res = await axios.get(
      `https://graph.facebook.com/v18.0/${businessId}/owned_ad_accounts?fields=name,currency,timezone_name`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      }
    );
    return res.data.data;
  }

  /**
   * ব্যক্তিগত অ্যাড অ্যাকাউন্টের তালিকা আনে (বিজনেস ম্যানেজার ছাড়াই)।
   * এন্ডপয়েন্ট: GET /me/adaccounts
   */
  async getPersonalAdAccounts() {
    const res = await axios.get(
      'https://graph.facebook.com/v18.0/me/adaccounts?fields=name,currency,timezone_name',
      {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      }
    );
    return res.data.data;
  }

  /**
   * ইউজারের ফেসবুক পেজগুলোর তালিকা আনে (ইনস্টাগ্রাম অ্যাকাউন্ট ও পেজ টোকেনসহ)।
   * এন্ডপয়েন্ট: GET /me/accounts
   */
  async getPages() {
    const res = await axios.get(
      'https://graph.facebook.com/v18.0/me/accounts?fields=name,instagram_business_account,access_token',
      {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      }
    );
    return res.data.data;
  }

  /**
   * একটি পেজের সাম্প্রতিক পোস্টগুলোর তালিকা আনে।
   * (বুস্ট করার জন্য পোস্ট সিলেক্ট করতে ব্যবহৃত হবে)
   * এন্ডপয়েন্ট: GET /{page-id}/posts
   */
  async getPagePosts(pageId: string, pageToken: string) {
    const res = await axios.get(
      `https://graph.facebook.com/v18.0/${pageId}/posts?fields=message,created_time,permalink_url&limit=10`,
      {
        headers: { Authorization: `Bearer ${pageToken}` }
      }
    );
    return res.data.data;
  }

  /**
   * নতুন ক্যাম্পেইন তৈরি করে (ড্রাফট বা সরাসরি অ্যাক্টিভেট করা যায়)।
   * এন্ডপয়েন্ট: POST /act_{ad-account-id}/campaigns
   */
  async createCampaign(adAccountId: string, params: any) {
    const res = await axios.post(
      `https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns`,
      params,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      }
    );
    return res.data;
  }
}