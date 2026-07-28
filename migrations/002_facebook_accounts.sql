CREATE TABLE IF NOT EXISTS facebook_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    meta_user_id VARCHAR(255),
    name VARCHAR(255),
    email VARCHAR(255),
    profile_pic_url TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(user_id, meta_user_id)
);