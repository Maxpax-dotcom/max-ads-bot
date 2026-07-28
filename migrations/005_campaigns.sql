CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    facebook_account_id UUID REFERENCES facebook_accounts(id),
    ad_account_id UUID REFERENCES ad_accounts(id),
    meta_campaign_id VARCHAR(255),
    page_id UUID REFERENCES pages(id),
    post_id VARCHAR(255),
    objective VARCHAR(50) DEFAULT 'POST_ENGAGEMENT',
    status VARCHAR(30) DEFAULT 'PAUSED',
    daily_budget INTEGER,
    lifetime_budget INTEGER,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    targeting JSONB,
    creative JSONB,
    created_at TIMESTAMP DEFAULT now()
);