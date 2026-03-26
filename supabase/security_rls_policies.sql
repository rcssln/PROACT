-- ============================================================
-- RDRMS C1 — Row Level Security (RLS) Policies
-- Run this entire script in the Supabase SQL Editor
-- ============================================================

-- Enable RLS on every table
ALTER TABLE public.users                             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatories                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.situational_reports              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agriculture_damage_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistance_lgus_agencies_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistance_provided_reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_suspension_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_lines_reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damaged_houses_reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.declaration_state_of_calamity_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infrastructure_damage_reports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.power_reports                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_emptive_evacuation_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.related_incidents                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_rows                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roads_and_bridges                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roads_and_bridges_sections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_supply_reports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_suspension_reports          ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- IMPORTANT: Because this app uses a custom auth model
-- (not Supabase Auth), all reads/writes from the browser
-- must go through the service-role key (via Edge Functions
-- or a backend). The anon key should have NO access.
--
-- The policies below block the anon role from all tables.
-- All legitimate operations are performed by the service role
-- (which bypasses RLS), keeping data safe from unauthenticated
-- direct API calls.
-- ============================================================

-- DENY all access to the anon role on sensitive tables
-- (No policy = deny-by-default once RLS is enabled, but
--  we add explicit deny policies for clarity.)

-- users — most sensitive table; block anon completely
CREATE POLICY "Deny anon read on users"
  ON public.users FOR SELECT TO anon USING (false);

CREATE POLICY "Deny anon write on users"
  ON public.users FOR ALL TO anon USING (false);

-- activity_logs
CREATE POLICY "Deny anon on activity_logs"
  ON public.activity_logs FOR ALL TO anon USING (false);

-- events (read-only for anon could be allowed if needed publicly, deny for now)
CREATE POLICY "Deny anon on events"
  ON public.events FOR ALL TO anon USING (false);

-- signatories
CREATE POLICY "Deny anon on signatories"
  ON public.signatories FOR ALL TO anon USING (false);

-- situational_reports
CREATE POLICY "Deny anon on situational_reports"
  ON public.situational_reports FOR ALL TO anon USING (false);

-- All sub-report tables — deny anon
CREATE POLICY "Deny anon on agriculture_damage_reports"
  ON public.agriculture_damage_reports FOR ALL TO anon USING (false);

CREATE POLICY "Deny anon on assistance_lgus_agencies_reports"
  ON public.assistance_lgus_agencies_reports FOR ALL TO anon USING (false);

CREATE POLICY "Deny anon on assistance_provided_reports"
  ON public.assistance_provided_reports FOR ALL TO anon USING (false);

CREATE POLICY "Deny anon on class_suspension_reports"
  ON public.class_suspension_reports FOR ALL TO anon USING (false);

CREATE POLICY "Deny anon on communication_lines_reports"
  ON public.communication_lines_reports FOR ALL TO anon USING (false);

CREATE POLICY "Deny anon on damaged_houses_reports"
  ON public.damaged_houses_reports FOR ALL TO anon USING (false);

CREATE POLICY "Deny anon on declaration_state_of_calamity_reports"
  ON public.declaration_state_of_calamity_reports FOR ALL TO anon USING (false);

CREATE POLICY "Deny anon on infrastructure_damage_reports"
  ON public.infrastructure_damage_reports FOR ALL TO anon USING (false);

CREATE POLICY "Deny anon on power_reports"
  ON public.power_reports FOR ALL TO anon USING (false);

CREATE POLICY "Deny anon on pre_emptive_evacuation_reports"
  ON public.pre_emptive_evacuation_reports FOR ALL TO anon USING (false);

CREATE POLICY "Deny anon on related_incidents"
  ON public.related_incidents FOR ALL TO anon USING (false);

CREATE POLICY "Deny anon on report_rows"
  ON public.report_rows FOR ALL TO anon USING (false);

CREATE POLICY "Deny anon on reports"
  ON public.reports FOR ALL TO anon USING (false);

CREATE POLICY "Deny anon on roads_and_bridges"
  ON public.roads_and_bridges FOR ALL TO anon USING (false);

CREATE POLICY "Deny anon on roads_and_bridges_sections"
  ON public.roads_and_bridges_sections FOR ALL TO anon USING (false);

CREATE POLICY "Deny anon on water_supply_reports"
  ON public.water_supply_reports FOR ALL TO anon USING (false);

CREATE POLICY "Deny anon on work_suspension_reports"
  ON public.work_suspension_reports FOR ALL TO anon USING (false);
