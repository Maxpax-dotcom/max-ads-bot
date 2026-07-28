CREATE TABLE IF NOT EXISTS pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facebook_account_id UUID REFERENCES facebook_accounts(id) ON DELETE CASCADE,
    page_id VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    instagram_business_account_id VARCHAR(255),
    access_token TEXT,
    UNIQUE(page_id)
);