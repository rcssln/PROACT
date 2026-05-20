ALTER TABLE situational_reports ADD COLUMN IF NOT EXISTS cloned_from_id UUID REFERENCES situational_reports(id) ON DELETE SET NULL;
ALTER TABLE situational_reports ADD COLUMN IF NOT EXISTS cloned_at TIMESTAMPTZ;
ALTER TABLE situational_reports ADD COLUMN IF NOT EXISTS auto_cloned BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_sitrep_cloned_from ON situational_reports(cloned_from_id);
