-- ============================================================
-- RDRRMC Report System - Sample Data Seed Script
-- Region 1 (Ilocos Region) - All 15 SitRep Categories
-- Usage: Paste this entire script in the Supabase SQL Editor
-- Note: Does NOT create any users.
-- ============================================================

-- ============================================================
-- STEP 1: Create a sample Event
-- ============================================================
INSERT INTO public.events (
  id, name, event_type, alert_status, alert_level, color,
  summary, approval_status, pinged_report_types,
  affected_provinces, is_deployed, deployed_at,
  start_date, end_date
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Typhoon Bising',
  'typhoon',
  'red',
  'Typhoon',
  '#ef4444',
  '**TYPHOON BISING** - Category: Typhoon (TY) - Max Winds: 140 km/h - Affected Provinces: Ilocos Norte, Ilocos Sur, La Union, Pangasinan. Typhoon Bising made landfall over Region 1, bringing strong winds and heavy rainfall causing significant damage to infrastructure, agriculture, and communities across the region.',
  'Approved',
  '["affectedPopulation","relatedIncidents","roadsAndBridges","power","waterSupply","communicationLines","damagedHouses","classSuspension","workSuspension","stateOfCalamity","preEmptiveEvacuation","assistanceProvided","assistanceLgus","agricultureDamage","infrastructureDamage"]',
  '{"Ilocos Norte","Ilocos Sur","La Union","Pangasinan"}',
  TRUE,
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '3 days',
  NULL
);

-- ============================================================
-- STEP 2: Create Situational Report No. 1
-- ============================================================
INSERT INTO public.situational_reports (
  id, event_id, report_number, title, status
) VALUES (
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  1,
  'Situational Report No. 1 - Typhoon Bising',
  'Approved'
);

-- ============================================================
-- STEP 2.5: Create Event Deployments (for LGU visibility)
-- =============-==============================================
INSERT INTO public.event_deployments (
  event_id, city, province, deployed_by, strength_label, strength_value
) VALUES
(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Laoag City',
  'Ilocos Norte',
  NULL,
  'Standard',
  1
),
(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Pagudpud',
  'Ilocos Norte',
  NULL,
  'Standard',
  1
),
(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Bauang',
  'La Union',
  NULL,
  'Standard',
  1
);

-- ============================================================
-- STEP 3: Create a reports entry (header for Affected Population)
-- ============================================================
INSERT INTO public.reports (
  id, event_id, situational_report_id, submitted_at, created_at
) VALUES (
  'cccccccc-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001',
  NOW() - INTERVAL '2 days 1 hour',
  NOW() - INTERVAL '2 days 1 hour'
);

-- ============================================================
-- CATEGORY 1: Affected Population (report_rows)
-- Barangays from Laoag City and Batac City, Ilocos Norte
-- ============================================================
INSERT INTO public.report_rows (
  id, report_id, barangay,
  affected_families, affected_persons,
  ecs_cum, ecs_now,
  inside_families_cum, inside_families_now,
  inside_persons_cum, inside_persons_now,
  outside_families_cum, outside_families_now,
  outside_persons_cum, outside_persons_now,
  status, created_at
) VALUES
(
  gen_random_uuid(),
  'cccccccc-0000-0000-0000-000000000001',
  'Balatong',
  120, 580,
  3, 2,
  75, 60,
  312, 250,
  45, 40,
  198, 165,
  'Displaced',
  NOW() - INTERVAL '2 days 1 hour'
),
(
  gen_random_uuid(),
  'cccccccc-0000-0000-0000-000000000001',
  'Bengcag',
  95, 420,
  2, 2,
  60, 55,
  260, 240,
  35, 30,
  145, 130,
  'Displaced',
  NOW() - INTERVAL '2 days 1 hour'
),
(
  gen_random_uuid(),
  'cccccccc-0000-0000-0000-000000000001',
  'Calayab',
  80, 350,
  1, 1,
  45, 40,
  195, 175,
  35, 32,
  148, 135,
  'Displaced',
  NOW() - INTERVAL '2 days 1 hour'
),
(
  gen_random_uuid(),
  'cccccccc-0000-0000-0000-000000000001',
  'Abut',
  60, 270,
  1, 1,
  35, 32,
  152, 140,
  25, 22,
  115, 100,
  'Displaced',
  NOW() - INTERVAL '2 days 1 hour'
);

-- ============================================================
-- CATEGORY 2: Assistance (LGUs/Agencies)
-- Laoag City, San Fernando City (La Union), Vigan City
-- ============================================================
INSERT INTO public.assistance_lgus_agencies_reports (
  id, situational_report_id, event_id,
  barangay, city, type, qty, unit, cost_per_unit, amount, source, status, remarks, created_at
) VALUES
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Poblacion 1',
  'Laoag City',
  'Family Food Pack',
  500, 'packs', 350.00, 175000.00,
  'DSWD Region 1',
  'Ongoing',
  'Distributed to evacuation centers',
  NOW() - INTERVAL '1 day 12 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Poro',
  'San Fernando City',
  'Non-Food Items (NFI)',
  200, 'kits', 850.00, 170000.00,
  'LGU San Fernando City',
  'Ongoing',
  'Hygiene and sleeping kits for evacuees',
  NOW() - INTERVAL '1 day 10 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Cabaroan',
  'Vigan City',
  'Water',
  100, 'drums', 500.00, 50000.00,
  'Ilocos Sur Provincial Government',
  'Ongoing',
  'Potable water for evacuation centers',
  NOW() - INTERVAL '1 day 8 hours'
);

-- ============================================================
-- CATEGORY 3: Agriculture Damage
-- Bayambang (Pangasinan), Laoag City, Bantay (Ilocos Sur)
-- ============================================================
INSERT INTO public.agriculture_damage_reports (
  id, situational_report_id, event_id,
  barangay, city, classification, type,
  farmers_affected,
  area_totally_damaged, area_partially_damaged, area_total,
  infra_totally_damaged, infra_partially_damaged, infra_total,
  production_loss_volume, production_loss_value,
  status, remarks, created_at
) VALUES
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Bayambang Poblacion',
  'Bayambang',
  'Crop',
  'Palay (Rice)',
  320,
  45.50, 120.75, 166.25,
  0, 0, 0,
  249.375, 4987500.00,
  'Ongoing',
  'Paddy fields flooded due to heavy rains from Typhoon Bising',
  NOW() - INTERVAL '1 day 6 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Laoag City Proper',
  'Laoag City',
  'Crop',
  'Tobacco',
  85,
  10.00, 25.50, 35.50,
  0, 0, 0,
  71.00, 639000.00,
  'Ongoing',
  'Tobacco fields severely damaged by strong winds',
  NOW() - INTERVAL '1 day 5 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Bantay Cao',
  'Bantay',
  'Livestock',
  'Poultry',
  45,
  0, 0, 0,
  0, 0, 0,
  0, 850000.00,
  'Ongoing',
  'Poultry houses damaged, estimated 5,000 birds lost',
  NOW() - INTERVAL '1 day 4 hours'
);

-- ============================================================
-- CATEGORY 4: Infrastructure Damage
-- Dagupan City (Pangasinan), Laoag City, Vigan City
-- ============================================================
INSERT INTO public.infrastructure_damage_reports (
  id, situational_report_id, event_id,
  barangay, city, type, classification, infrastructure_name,
  number_damaged, unit, quantity, cost,
  status, remarks, created_at
) VALUES
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Pantal',
  'Dagupan City',
  'Bridge',
  'National',
  'Pantal River Bridge',
  1, 'units', 1, 2500000.00,
  'Ongoing',
  'Bridge approach damaged; currently one-lane traffic only',
  NOW() - INTERVAL '1 day 3 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Gabu Norte East',
  'Laoag City',
  'Road',
  'National',
  'Manila North Road (Laoag Section)',
  1, 'km', 2.5, 1800000.00,
  'Ongoing',
  'Road shoulder eroded, lane closure in effect',
  NOW() - INTERVAL '1 day 2 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Barabar',
  'Laoag City',
  'Flood Control',
  'Local',
  'Abra River Dike (Laoag Section)',
  1, 'units', 1, 3200000.00,
  'Ongoing',
  'Dike breached at 50-meter section',
  NOW() - INTERVAL '22 hours'
);

-- ============================================================
-- CATEGORY 5: Power Status
-- Calasiao (Pangasinan), Laoag City, San Fernando City (La Union)
-- ============================================================
INSERT INTO public.power_reports (
  id, situational_report_id, event_id,
  barangay, city, type, service_provider,
  date_of_interruption, time_of_interruption,
  date_restored, time_restored,
  status, remarks, created_at
) VALUES
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Calasiao Poblacion',
  'Calasiao',
  'Total',
  'Pangasinan Electric Cooperative I (PANELCO I)',
  CURRENT_DATE - 3, '08:30:00',
  NULL, NULL,
  'Ongoing',
  'Power lines downed by fallen trees; full restoration ongoing',
  NOW() - INTERVAL '2 days 2 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Laoag City Proper',
  'Laoag City',
  'Partial',
  'Ilocos Norte Electric Cooperative (INEC)',
  CURRENT_DATE - 3, '07:15:00',
  CURRENT_DATE - 1, '16:00:00',
  'Restored',
  'Power restored to most barangays; 3 barangays still without power',
  NOW() - INTERVAL '2 days 3 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Poro',
  'San Fernando City',
  'Total',
  'La Union Electric Cooperative (LUECO)',
  CURRENT_DATE - 3, '09:00:00',
  CURRENT_DATE - 2, '18:30:00',
  'Restored',
  'Service fully restored',
  NOW() - INTERVAL '2 days'
);

-- ============================================================
-- CATEGORY 6: Water Status
-- Bauang (La Union), Dagupan City (Pangasinan)
-- ============================================================
INSERT INTO public.water_supply_reports (
  id, situational_report_id, event_id,
  barangay, city, type, service_provider,
  date_of_interruption, time_of_interruption,
  date_restored, time_restored,
  status, remarks, created_at
) VALUES
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Paringao',
  'Bauang',
  'Total',
  'Bauang Water District',
  CURRENT_DATE - 3, '10:00:00',
  NULL, NULL,
  'Ongoing',
  'Main water pipeline damaged; tanker water distribution ongoing',
  NOW() - INTERVAL '1 day 18 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Pantal',
  'Dagupan City',
  'Partial',
  'Dagupan City Water District (DaWaD)',
  CURRENT_DATE - 3, '11:30:00',
  CURRENT_DATE - 2, '14:00:00',
  'Restored',
  'Water service restored; pressure monitoring ongoing',
  NOW() - INTERVAL '1 day 16 hours'
);

-- ============================================================
-- CATEGORY 7: Roads & Bridges
-- Laoag City, Vigan City, San Fernando City
-- ============================================================
INSERT INTO public.roads_and_bridges (
  id, situational_report_id, event_id,
  barangay, city, classification, type,
  status,
  date_reported_not_passable, time_reported_not_passable,
  date_reported_passable, time_reported_passable,
  remarks, created_at
) VALUES
(
  'dddddddd-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Gabu Norte East',
  'Laoag City',
  'National',
  'Road',
  'Not Passable',
  CURRENT_DATE - 3, '06:00:00',
  NULL, NULL,
  'Manila North Road - Laoag Section (km 503-505): Flooded; 1 meter floodwater depth; DPWH clearing operations ongoing',
  NOW() - INTERVAL '2 days'
),
(
  'dddddddd-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Barangay I (Pob.)',
  'Vigan City',
  'National',
  'Bridge',
  'Passable',
  CURRENT_DATE - 3, '08:00:00',
  CURRENT_DATE - 2, '14:00:00',
  'Mestizo River Bridge: One-way traffic; structural inspection completed',
  NOW() - INTERVAL '1 day 20 hours'
),
(
  'dddddddd-0000-0000-0000-000000000003',
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Poro',
  'San Fernando City',
  'Provincial',
  'Road',
  'Passable with Restriction',
  CURRENT_DATE - 3, '07:30:00',
  CURRENT_DATE - 3, '15:00:00',
  'Poro-Carlatan Road: Light vehicles only; road shoulder damaged',
  NOW() - INTERVAL '2 days'
);

-- Roads and Bridges Sections
INSERT INTO public.roads_and_bridges_sections (id, report_id, name, created_at) VALUES
(gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000001', 'km 503 - Laoag North Gate', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000001', 'km 505 - Brgy. Gabu Junction', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000002', 'Mestizo Bridge Approach (North)', NOW() - INTERVAL '1 day 20 hours'),
(gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000003', 'Poro Road - Section A', NOW() - INTERVAL '2 days');

-- ============================================================
-- CATEGORY 8: Communication Lines
-- Laoag City, Dagupan City, San Fernando City
-- ============================================================
INSERT INTO public.communication_lines_reports (
  id, situational_report_id, event_id,
  barangay, city, telecompany, status_of_communication,
  date_interruption, time_interruption,
  date_restoration, time_restoration,
  site_count_2g, with_coverage_2g, pct_coverage_2g,
  site_count_3g, with_coverage_3g, pct_coverage_3g,
  site_count_4g, with_coverage_4g, pct_coverage_4g,
  status, remarks, created_at
) VALUES
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Laoag City Proper',
  'Laoag City',
  'Globe Telecom',
  'Partial Interruption',
  CURRENT_DATE - 3, '07:00:00',
  NULL, NULL,
  18, 14, 77.78,
  18, 12, 66.67,
  18, 10, 55.56,
  'Ongoing',
  '4 cell sites affected; generator deployment ongoing',
  NOW() - INTERVAL '2 days'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Pantal',
  'Dagupan City',
  'Smart Communications',
  'Operational',
  CURRENT_DATE - 3, '07:00:00',
  CURRENT_DATE - 2, '20:00:00',
  8, 8, 100.00,
  8, 8, 100.00,
  8, 8, 100.00,
  'Operational',
  'All sites restored to normal operation',
  NOW() - INTERVAL '1 day 15 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Poro',
  'San Fernando City',
  'DITO Telecommunity',
  'Operational',
  NULL, NULL,
  NULL, NULL,
  5, 5, 100.00,
  5, 5, 100.00,
  5, 5, 100.00,
  'Operational',
  'No interruption recorded for this provider',
  NOW() - INTERVAL '2 days'
);

-- ============================================================
-- CATEGORY 9: Related Incidents
-- Bacarra (Ilocos Norte), Naguilian (La Union), Laoag City
-- ============================================================
INSERT INTO public.related_incidents (
  id, situational_report_id, event_id,
  barangay, city, type_of_incident,
  date_of_occurrence, time_of_occurrence,
  description, actions_taken,
  status, remarks, created_at
) VALUES
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Bimmanga',
  'Bacarra',
  'Flood',
  CURRENT_DATE - 3, '05:30:00',
  'Severe flooding in low-lying areas of Barangay Bimmanga due to overflow of Bacarra River. Approximately 200 families affected.',
  'MDRRMO coordinated evacuation to barangay gymnasium. DSWD deployed relief goods.',
  'Ongoing',
  'Water level slowly receding',
  NOW() - INTERVAL '2 days 5 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Naguilian',
  'Naguilian',
  'Landslide',
  CURRENT_DATE - 3, '09:15:00',
  'Landslide along the Naguilian-Baguio Road blocking vehicular traffic. No reported casualties.',
  'DPWH Region 1 deployed heavy equipment for clearing. Alternate routes advised.',
  'Resolved',
  'Road cleared at 6:00 PM same day',
  NOW() - INTERVAL '1 day 20 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Calayab',
  'Laoag City',
  'Flash Flood',
  CURRENT_DATE - 3, '03:00:00',
  'Flash flood hit residential areas near Calayab Creek. Several houses inundated with water reaching waist level.',
  'Rapid response team deployed by city DRRMO. Residents evacuated to multi-purpose hall.',
  'Ongoing',
  'Continuous monitoring by LDRRMO',
  NOW() - INTERVAL '2 days 8 hours'
);

-- ============================================================
-- CATEGORY 10: Damaged Houses
-- Laoag City, Batac City, San Fernando City, Bantay (Ilocos Sur)
-- ============================================================
INSERT INTO public.damaged_houses_reports (
  id, situational_report_id, event_id,
  barangay, city,
  totally_damaged, partially_damaged, grand_total, amount_php,
  status, remarks, created_at
) VALUES
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Balatong',
  'Laoag City',
  15, 42, 57, 4250000.00,
  'Reported',
  'Most houses were light materials; full assessment still ongoing',
  NOW() - INTERVAL '1 day 12 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Abut',
  'Batac City',
  8, 25, 33, 1875000.00,
  'Reported',
  'Roofs blown off by strong winds; concrete structures partially damaged',
  NOW() - INTERVAL '1 day 10 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Poro',
  'San Fernando City',
  5, 18, 23, 1150000.00,
  'Reported',
  'Flood damage to ground floor structures',
  NOW() - INTERVAL '1 day 8 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Bantay Cao',
  'Bantay',
  22, 60, 82, 5800000.00,
  'Reported',
  'Heavily impacted coastal barangay; assessment teams dispatched',
  NOW() - INTERVAL '1 day 6 hours'
);

-- ============================================================
-- CATEGORY 11: Class Suspension
-- Laoag City, Vigan City, Dagupan City
-- ============================================================
INSERT INTO public.class_suspension_reports (
  id, situational_report_id, event_id,
  barangay, city, level_from, level_to, type,
  date_of_suspension, time_of_suspension,
  date_resumed, time_resumed,
  status, remarks, created_at
) VALUES
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Laoag City Proper',
  'Laoag City',
  'Kindergarten', 'Senior High School', 'All Levels',
  CURRENT_DATE - 3, '06:00:00',
  CURRENT_DATE - 1, '07:00:00',
  'Resumed',
  'All classes suspended for 2 days; resumed after flood waters receded',
  NOW() - INTERVAL '2 days'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Barangay I (Pob.)',
  'Vigan City',
  'Kindergarten', 'Senior High School', 'All Levels',
  CURRENT_DATE - 3, '06:00:00',
  CURRENT_DATE - 2, '07:00:00',
  'Resumed',
  'Preemptive suspension; schools declared evacuation centers',
  NOW() - INTERVAL '2 days'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Pantal',
  'Dagupan City',
  'Kindergarten', 'Senior High School', 'All Levels',
  CURRENT_DATE - 3, '05:00:00',
  NULL, NULL,
  'Ongoing',
  'Schools still used as evacuation centers; resumption TBD',
  NOW() - INTERVAL '2 days'
);

-- ============================================================
-- CATEGORY 12: Work Suspension
-- Laoag City, Vigan City, San Fernando City
-- ============================================================
INSERT INTO public.work_suspension_reports (
  id, situational_report_id, event_id,
  barangay, city, type,
  date_of_suspension, time_of_suspension,
  date_resumed, time_resumed,
  status, remarks, created_at
) VALUES
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Laoag City Proper',
  'Laoag City',
  'Government',
  CURRENT_DATE - 3, '07:00:00',
  CURRENT_DATE - 1, '08:00:00',
  'Resumed',
  'Work in government offices suspended for 2 days per executive order of the City Mayor',
  NOW() - INTERVAL '2 days'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Barangay I (Pob.)',
  'Vigan City',
  'Government',
  CURRENT_DATE - 3, '06:00:00',
  CURRENT_DATE - 2, '08:00:00',
  'Resumed',
  'Provincial Capitol operations suspended; essential services maintained',
  NOW() - INTERVAL '2 days'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Poro',
  'San Fernando City',
  'Private',
  CURRENT_DATE - 3, '07:00:00',
  CURRENT_DATE - 3, '17:00:00',
  'Resumed',
  'Private establishments in commercial district temporarily closed; opened by afternoon',
  NOW() - INTERVAL '2 days'
);

-- ============================================================
-- CATEGORY 13: State of Calamity
-- Laoag City (Ilocos Norte), Bayambang (Pangasinan)
-- ============================================================
INSERT INTO public.declaration_state_of_calamity_reports (
  id, situational_report_id, event_id,
  barangay, city, type, count_soc,
  resolution_number, resolution_date,
  status, remarks, created_at
) VALUES
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Laoag City Proper',
  'Laoag City',
  'City',
  1,
  'Resolution No. 2026-045',
  CURRENT_DATE - 2,
  'Declared',
  'City of Laoag declared under State of Calamity due to extensive flooding and infrastructure damage caused by Typhoon Bising',
  NOW() - INTERVAL '1 day 18 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Bayambang Poblacion',
  'Bayambang',
  'Municipality',
  1,
  'Resolution No. 078-2026',
  CURRENT_DATE - 2,
  'Declared',
  'Bayambang declared under State of Calamity due to widespread agricultural damage; DRRM funds authorized for release',
  NOW() - INTERVAL '1 day 16 hours'
);

-- ============================================================
-- CATEGORY 14: Pre-emptive Evacuation
-- Pagudpud, Bangui (Ilocos Norte), Bauang (La Union), Bacarra
-- ============================================================
INSERT INTO public.pre_emptive_evacuation_reports (
  id, situational_report_id, event_id,
  barangay, city,
  families, male_count, female_count, total,
  status, remarks, created_at
) VALUES
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Caparispisan',
  'Pagudpud',
  85, 190, 205, 395,
  'Completed',
  'Coastal barangay; evacuated to Pagudpud Central Elementary School before typhoon landfall',
  NOW() - INTERVAL '3 days 2 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Gabur',
  'Bangui',
  65, 148, 162, 310,
  'Completed',
  'Evacuated to Bangui Municipal Gymnasium; known landslide-prone and flood-prone area',
  NOW() - INTERVAL '3 days 1 hour'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Paringao',
  'Bauang',
  110, 245, 270, 515,
  'Completed',
  'Riverbank area evacuated; families moved to Bauang National High School gymnasium',
  NOW() - INTERVAL '3 days 1 hour'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Bimmanga',
  'Bacarra',
  72, 165, 175, 340,
  'Completed',
  'Flood-prone zone; pre-emptive evacuation completed before typhoon arrival',
  NOW() - INTERVAL '3 days'
);

-- ============================================================
-- CATEGORY 15: Assistance Provided to Affected Families
-- Laoag City, Pagudpud, Bauang, Bangui
-- ============================================================
INSERT INTO public.assistance_provided_reports (
  id, situational_report_id, event_id,
  barangay, city,
  no_families_affected, needs, no_families_requiring_assistance,
  fnfi_qty, fnfi_unit, fnfi_cost_per_unit, fnfi_amount, fnfi_source,
  no_families_assisted, pct_families_assisted,
  status, remarks, created_at
) VALUES
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Balatong',
  'Laoag City',
  120, 'Food and Non-Food Items', 120,
  120, 'packs', 350.00, 42000.00, 'DSWD Region 1',
  120, 100.00,
  'Ongoing',
  'Family food packs distributed to all affected families',
  NOW() - INTERVAL '1 day 6 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Caparispisan',
  'Pagudpud',
  85, 'Food, Water, and Shelter Materials', 85,
  85, 'packs', 350.00, 29750.00, 'LGU Pagudpud',
  75, 88.24,
  'Ongoing',
  '10 families receiving assistance from DSWD; initial distribution completed',
  NOW() - INTERVAL '1 day 4 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Paringao',
  'Bauang',
  110, 'Food and Water', 110,
  110, 'packs', 350.00, 38500.00, 'Philippine Red Cross - La Union Chapter',
  110, 100.00,
  'Ongoing',
  'Full coverage achieved; distribution coordinated with barangay officials',
  NOW() - INTERVAL '1 day 2 hours'
),
(
  gen_random_uuid(),
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Gabur',
  'Bangui',
  65, 'Food, Hygiene Kits, Bedding', 65,
  65, 'kits', 850.00, 55250.00, 'DSWD Region 1',
  65, 100.00,
  'Ongoing',
  'Hygiene and sleeping kits distributed alongside food packs',
  NOW() - INTERVAL '22 hours'
);
