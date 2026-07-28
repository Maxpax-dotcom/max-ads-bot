CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    spend DECIMAL(10,2),
    reach INTEGER,
    impressions INTEGER,
    clicks INTEGER,
    ctr DECIMAL(6,4),
    cpc DECIMAL(10,4),
    cpm DECIMAL(10,4),
    UNIQUE(campaign_id, date)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100),
    details JSONB,
    created_at TIMESTAMP DEFAULT now()
);