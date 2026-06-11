ALTER TABLE situational_reports ADD COLUMN IF NOT EXISTS cloned_from_id UUID REFERENCES situational_reports(id) ON DELETE SET NULL;
ALTER TABLE situational_reports ADD COLUMN IF NOT EXISTS cloned_at TIMESTAMPTZ;
ALTER TABLE situational_reports ADD COLUMN IF NOT EXISTS auto_cloned BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_sitrep_cloned_from ON situational_reports(cloned_from_id);

CREATE TABLE IF NOT EXISTS public.ai_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  situational_report_id UUID NOT NULL REFERENCES public.situational_reports(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_summaries_pkey PRIMARY KEY (id)
);
