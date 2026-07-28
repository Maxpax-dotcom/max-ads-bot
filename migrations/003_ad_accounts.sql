CREATE TABLE IF NOT EXISTS ad_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facebook_account_id UUID REFERENCES facebook_accounts(id) ON DELETE CASCADE,
    account_id VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    currency CHAR(3),
    timezone_name VARCHAR(100),
    UNIQUE(account_id)
);