-- PROACT Report System - Database Initialization Script
-- Standard PostgreSQL - Generated from Supabase schema

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  city TEXT DEFAULT '',
  role TEXT DEFAULT 'Viewer',
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  password_hash TEXT,
  account_type TEXT,
  province TEXT,
  must_change_password BOOLEAN DEFAULT FALSE,
  theme TEXT DEFAULT 'classic',
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- ============================================================
-- TABLE: events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  event_type TEXT,
  alert_status TEXT,
  alert_level TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  summary TEXT,
  approval_status TEXT DEFAULT 'Pending',
  approved_pdf_url TEXT,
  pinged_report_types JSONB DEFAULT '[]'::JSONB,
  affected_provinces TEXT[] DEFAULT '{}',
  gdacs_id TEXT,
  is_deployed BOOLEAN DEFAULT FALSE,
  deployed_at TIMESTAMPTZ,
  deployed_snapshot JSONB,
  CONSTRAINT events_pkey PRIMARY KEY (id)
);

-- ============================================================
-- TABLE: signatories
-- ============================================================
CREATE TABLE IF NOT EXISTS public.signatories (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT signatories_pkey PRIMARY KEY (id)
);

-- ============================================================
-- TABLE: situational_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.situational_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  event_id UUID,
  report_number INTEGER NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'Draft',
  target_lgus TEXT[] DEFAULT '{}',
  province TEXT,
  created_by UUID,
  rejection_remarks TEXT,
  approved_pdf_url TEXT,
  pending_pdf_url TEXT,
  summary TEXT,
  CONSTRAINT situational_reports_pkey PRIMARY KEY (id),
  CONSTRAINT situational_reports_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT situational_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

-- ============================================================
-- TABLE: lgu_submissions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lgu_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  situational_report_id UUID NOT NULL REFERENCES public.situational_reports(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  status TEXT DEFAULT 'Draft',
  rejection_remarks TEXT,
  submitted_by UUID REFERENCES public.users(id),
  approved_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT lgu_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT lgu_submissions_unique UNIQUE (situational_report_id, city)
);

-- ============================================================
-- TABLE: activity_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- ============================================================
-- TABLE: reports (Affected Population wrapper)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id UUID,
  situational_report_id UUID,
  CONSTRAINT reports_pkey PRIMARY KEY (id),
  CONSTRAINT reports_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT reports_sitrep_fkey FOREIGN KEY (situational_report_id) REFERENCES public.situational_reports(id)
);

-- ============================================================
-- TABLE: report_rows
-- ============================================================
CREATE TABLE IF NOT EXISTS public.report_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL,
  barangay TEXT NOT NULL,
  affected_families INTEGER DEFAULT 0,
  affected_persons INTEGER DEFAULT 0,
  ecs_cum INTEGER DEFAULT 0,
  ecs_now INTEGER DEFAULT 0,
  inside_families_cum INTEGER DEFAULT 0,
  inside_families_now INTEGER DEFAULT 0,
  inside_persons_cum INTEGER DEFAULT 0,
  inside_persons_now INTEGER DEFAULT 0,
  outside_families_cum INTEGER DEFAULT 0,
  outside_families_now INTEGER DEFAULT 0,
  outside_persons_cum INTEGER DEFAULT 0,
  outside_persons_now INTEGER DEFAULT 0,
  status TEXT DEFAULT '',
  city TEXT DEFAULT '',
  remarks TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT report_rows_pkey PRIMARY KEY (id),
  CONSTRAINT report_rows_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id)
);

-- ============================================================
-- TABLE: related_incidents
-- ============================================================
CREATE TABLE IF NOT EXISTS public.related_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  barangay TEXT NOT NULL,
  city TEXT DEFAULT '',
  type_of_incident TEXT NOT NULL,
  date_of_occurrence DATE NOT NULL,
  time_of_occurrence TIME,
  description TEXT DEFAULT '',
  actions_taken TEXT DEFAULT '',
  remarks TEXT DEFAULT '',
  status TEXT DEFAULT 'Ongoing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id UUID,
  situational_report_id UUID,
  CONSTRAINT related_incidents_pkey PRIMARY KEY (id),
  CONSTRAINT related_incidents_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT related_incidents_sitrep_fkey FOREIGN KEY (situational_report_id) REFERENCES public.situational_reports(id)
);

-- ============================================================
-- TABLE: agriculture_damage_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agriculture_damage_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  situational_report_id UUID,
  barangay TEXT NOT NULL,
  city TEXT DEFAULT '',
  classification TEXT DEFAULT '',
  type TEXT DEFAULT '',
  farmers_affected INTEGER DEFAULT 0,
  area_totally_damaged NUMERIC DEFAULT 0,
  area_partially_damaged NUMERIC DEFAULT 0,
  area_total NUMERIC DEFAULT 0,
  infra_totally_damaged NUMERIC DEFAULT 0,
  infra_partially_damaged NUMERIC DEFAULT 0,
  infra_total NUMERIC DEFAULT 0,
  production_loss_volume NUMERIC DEFAULT 0,
  production_loss_value NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Ongoing',
  remarks TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id UUID,
  CONSTRAINT agriculture_damage_reports_pkey PRIMARY KEY (id),
  CONSTRAINT agri_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT agri_sitrep_fkey FOREIGN KEY (situational_report_id) REFERENCES public.situational_reports(id)
);

-- ============================================================
-- TABLE: assistance_lgus_agencies_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assistance_lgus_agencies_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  situational_report_id UUID,
  barangay TEXT NOT NULL,
  city TEXT DEFAULT '',
  type TEXT DEFAULT '',
  qty NUMERIC DEFAULT 0,
  unit TEXT DEFAULT '',
  cost_per_unit NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  source TEXT DEFAULT '',
  remarks TEXT DEFAULT '',
  status TEXT DEFAULT 'Ongoing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id UUID,
  CONSTRAINT assistance_lgus_pkey PRIMARY KEY (id),
  CONSTRAINT asst_lgus_event_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT asst_lgus_sitrep_fkey FOREIGN KEY (situational_report_id) REFERENCES public.situational_reports(id)
);

-- ============================================================
-- TABLE: assistance_provided_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assistance_provided_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  barangay TEXT NOT NULL,
  no_families_affected INTEGER,
  needs TEXT DEFAULT '',
  no_families_requiring_assistance INTEGER,
  fnfi_qty NUMERIC,
  fnfi_unit TEXT DEFAULT '',
  fnfi_cost_per_unit NUMERIC,
  fnfi_amount NUMERIC,
  fnfi_source TEXT DEFAULT '',
  no_families_assisted INTEGER,
  pct_families_assisted NUMERIC,
  remarks TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id UUID,
  situational_report_id UUID,
  status TEXT DEFAULT 'Ongoing',
  city TEXT DEFAULT '',
  CONSTRAINT assistance_provided_pkey PRIMARY KEY (id),
  CONSTRAINT asst_prov_event_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT asst_prov_sitrep_fkey FOREIGN KEY (situational_report_id) REFERENCES public.situational_reports(id)
);

-- ============================================================
-- TABLE: class_suspension_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.class_suspension_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  barangay TEXT NOT NULL,
  city TEXT DEFAULT '',
  level_from TEXT DEFAULT '',
  level_to TEXT DEFAULT '',
  type TEXT DEFAULT '',
  date_of_suspension DATE,
  time_of_suspension TIME,
  date_resumed DATE,
  time_resumed TIME,
  remarks TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id UUID,
  situational_report_id UUID,
  status TEXT DEFAULT 'Ongoing',
  CONSTRAINT class_suspension_pkey PRIMARY KEY (id),
  CONSTRAINT class_susp_event_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT class_susp_sitrep_fkey FOREIGN KEY (situational_report_id) REFERENCES public.situational_reports(id)
);

-- ============================================================
-- TABLE: communication_lines_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.communication_lines_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  barangay TEXT NOT NULL,
  city TEXT DEFAULT '',
  telecompany TEXT DEFAULT '',
  status_of_communication TEXT DEFAULT '',
  date_interruption DATE,
  time_interruption TIME,
  date_restoration DATE,
  time_restoration TIME,
  site_count_2g INTEGER,
  with_coverage_2g INTEGER,
  pct_coverage_2g NUMERIC,
  site_count_3g INTEGER,
  with_coverage_3g INTEGER,
  pct_coverage_3g NUMERIC,
  site_count_4g INTEGER,
  with_coverage_4g INTEGER,
  pct_coverage_4g NUMERIC,
  remarks TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id UUID,
  situational_report_id UUID,
  status TEXT DEFAULT 'Operational',
  CONSTRAINT comm_lines_pkey PRIMARY KEY (id),
  CONSTRAINT comm_event_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT comm_sitrep_fkey FOREIGN KEY (situational_report_id) REFERENCES public.situational_reports(id)
);

-- ============================================================
-- TABLE: damaged_houses_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.damaged_houses_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  barangay TEXT NOT NULL,
  city TEXT DEFAULT '',
  totally_damaged INTEGER DEFAULT 0,
  partially_damaged INTEGER DEFAULT 0,
  grand_total INTEGER DEFAULT 0,
  amount_php NUMERIC,
  remarks TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id UUID,
  situational_report_id UUID,
  status TEXT DEFAULT 'Reported',
  CONSTRAINT damaged_houses_pkey PRIMARY KEY (id),
  CONSTRAINT dmg_houses_event_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT dmg_houses_sitrep_fkey FOREIGN KEY (situational_report_id) REFERENCES public.situational_reports(id)
);

-- ============================================================
-- TABLE: declaration_state_of_calamity_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.declaration_state_of_calamity_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  barangay TEXT NOT NULL,
  city TEXT DEFAULT '',
  type TEXT DEFAULT '',
  count_soc INTEGER,
  resolution_number TEXT DEFAULT '',
  resolution_date DATE,
  remarks TEXT DEFAULT '',
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id UUID,
  situational_report_id UUID,
  status TEXT DEFAULT 'Declared',
  CONSTRAINT decl_calamity_pkey PRIMARY KEY (id),
  CONSTRAINT decl_cal_event_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT decl_cal_sitrep_fkey FOREIGN KEY (situational_report_id) REFERENCES public.situational_reports(id)
);

-- ============================================================
-- TABLE: infrastructure_damage_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.infrastructure_damage_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  situational_report_id UUID,
  barangay TEXT NOT NULL,
  city TEXT DEFAULT '',
  type TEXT DEFAULT '',
  classification TEXT DEFAULT '',
  infrastructure_name TEXT DEFAULT '',
  number_damaged INTEGER DEFAULT 0,
  unit TEXT DEFAULT '',
  quantity NUMERIC DEFAULT 0,
  cost NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Ongoing',
  remarks TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id UUID,
  CONSTRAINT infra_damage_pkey PRIMARY KEY (id),
  CONSTRAINT infra_event_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT infra_sitrep_fkey FOREIGN KEY (situational_report_id) REFERENCES public.situational_reports(id)
);

-- ============================================================
-- TABLE: power_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.power_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  barangay TEXT NOT NULL,
  city TEXT DEFAULT '',
  type TEXT NOT NULL,
  service_provider TEXT NOT NULL,
  date_of_interruption DATE NOT NULL,
  time_of_interruption TIME,
  date_restored DATE,
  time_restored TIME,
  remarks TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id UUID,
  situational_report_id UUID,
  status TEXT DEFAULT 'Ongoing',
  CONSTRAINT power_reports_pkey PRIMARY KEY (id),
  CONSTRAINT power_event_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT power_sitrep_fkey FOREIGN KEY (situational_report_id) REFERENCES public.situational_reports(id)
);

-- ============================================================
-- TABLE: pre_emptive_evacuation_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pre_emptive_evacuation_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  barangay TEXT NOT NULL,
  city TEXT DEFAULT '',
  families INTEGER,
  male_count INTEGER,
  female_count INTEGER,
  total INTEGER,
  remarks TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id UUID,
  situational_report_id UUID,
  status TEXT DEFAULT 'Completed',
  CONSTRAINT pre_evac_pkey PRIMARY KEY (id),
  CONSTRAINT pre_evac_event_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT pre_evac_sitrep_fkey FOREIGN KEY (situational_report_id) REFERENCES public.situational_reports(id)
);

-- ============================================================
-- TABLE: roads_and_bridges
-- ============================================================
CREATE TABLE IF NOT EXISTS public.roads_and_bridges (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  barangay TEXT NOT NULL,
  city TEXT DEFAULT '',
  remarks TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  classification TEXT NOT NULL DEFAULT 'Other',
  status TEXT DEFAULT '',
  date_reported_passable DATE,
  time_reported_passable TIME,
  date_reported_not_passable DATE,
  time_reported_not_passable TIME,
  event_id UUID,
  situational_report_id UUID,
  type TEXT DEFAULT 'Road',
  road_bridge_name TEXT,
  CONSTRAINT roads_bridges_pkey PRIMARY KEY (id),
  CONSTRAINT roads_event_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT roads_sitrep_fkey FOREIGN KEY (situational_report_id) REFERENCES public.situational_reports(id)
);

-- ============================================================
-- TABLE: roads_and_bridges_sections
-- ============================================================
CREATE TABLE IF NOT EXISTS public.roads_and_bridges_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT roads_sections_pkey PRIMARY KEY (id),
  CONSTRAINT roads_sections_report_fkey FOREIGN KEY (report_id) REFERENCES public.roads_and_bridges(id)
);

-- ============================================================
-- TABLE: water_supply_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.water_supply_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  service_provider TEXT NOT NULL,
  date_of_interruption DATE NOT NULL,
  time_of_interruption TIME,
  date_restored DATE,
  time_restored TIME,
  remarks TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id UUID,
  status TEXT DEFAULT 'Ongoing',
  situational_report_id UUID,
  barangay TEXT,
  city TEXT DEFAULT '',
  CONSTRAINT water_supply_pkey PRIMARY KEY (id),
  CONSTRAINT water_event_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT water_sitrep_fkey FOREIGN KEY (situational_report_id) REFERENCES public.situational_reports(id)
);

-- ============================================================
-- TABLE: work_suspension_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.work_suspension_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  barangay TEXT NOT NULL,
  city TEXT DEFAULT '',
  type TEXT DEFAULT '',
  date_of_suspension DATE,
  time_of_suspension TIME,
  date_resumed DATE,
  time_resumed TIME,
  remarks TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id UUID,
  situational_report_id UUID,
  status TEXT DEFAULT 'Ongoing',
  CONSTRAINT work_suspension_pkey PRIMARY KEY (id),
  CONSTRAINT work_susp_event_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT work_susp_sitrep_fkey FOREIGN KEY (situational_report_id) REFERENCES public.situational_reports(id)
);

-- ============================================================
-- TABLE: event_deployments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_deployments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  city TEXT NOT NULL,
  province TEXT,
  deployed_by UUID,
  strength_label TEXT DEFAULT 'Standard',
  strength_value INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT event_deployments_pkey PRIMARY KEY (id),
  CONSTRAINT event_deployments_unique UNIQUE (event_id, city),
  CONSTRAINT event_deployments_event_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT event_deployments_deployed_by_fkey FOREIGN KEY (deployed_by) REFERENCES public.users(id)
);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}'::JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: event_signals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  province TEXT NOT NULL,
  city TEXT,
  barangay TEXT,
  signal TEXT,
  assigned_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT event_signals_pkey PRIMARY KEY (id),
  CONSTRAINT event_signals_event_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT event_signals_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id),
  CONSTRAINT event_signals_unique UNIQUE (event_id, province, city, barangay)
);

-- ============================================================
-- TABLE: settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT settings_pkey PRIMARY KEY (id)
);

-- ============================================================
-- SEED: Default Super Admin User
-- Email:    admin@proact.local
-- Password: Admin@1234
-- ============================================================
INSERT INTO public.users (
  id,
  email,
  first_name,
  last_name,
  role,
  status,
  account_type,
  password_hash,
  must_change_password
) VALUES (
  gen_random_uuid(),
  'admin@proact.local',
  'System',
  'Admin',
  'Super Admin',
  'Active',
  'Super Admin',
  '$2a$12$4RFQwd9YewFlzqZW2y9et.E7eFxPsP5HmG5YsAs3HpruWhBh1Fpzu',
  FALSE
) ON CONFLICT (email) DO NOTHING;

