-- =====================================================================
-- APP BEHAVIOUR
-- =====================================================================
-- Parent onboarding:
--
--   Country dropdown:
--     SELECT id, name, iso2
--     FROM public.countries
--     WHERE is_active = TRUE
--     ORDER BY sort_order, name;
--
--   State dropdown after country selection:
--     SELECT id, name, code
--     FROM public.states
--     WHERE country_id = :country_id
--       AND is_active = TRUE
--     ORDER BY sort_order, name;
--
--   City dropdown after state selection:
--     SELECT id, name, timezone_name
--     FROM public.cities
--     WHERE state_id = :state_id
--       AND is_active = TRUE
--     ORDER BY name;
--
--   Timezone resolution priority:
--       1. cities.timezone_name
--       2. states.timezone_name
--       3. countries.default_timezone_name
--       4. user selects from timezones WHERE is_user_selectable = TRUE
--
--   Store:
--       country_id
--       state_id
--       city_id
--       timezone_name
--       area_locality  (free text if required)
--       postal_code    (separate field)
--
-- DO NOT expose the complete timezones table as one huge parent dropdown.
--
-- =====================================================================
-- STATES / CITIES IMPORT
-- =====================================================================
-- This file deliberately creates the final schema but does NOT hard-code
-- 150,000+ city INSERT statements. That would make your core migration huge,
-- slow to review, and difficult to keep current.
--
-- Recommended production process:
--   1. Download a versioned PostgreSQL/CSV export from ONE maintained source.
--   2. Import states/cities into staging tables.
--   3. Upsert them into public.states/public.cities using ISO country codes.
--   4. Preserve the source city timezone as the IANA timezone_name.
--   5. Record the import date/version in reference_data_sources.
--
-- Recommended source:
--   Countries States Cities Database
--   https://github.com/dr5hn/countries-states-cities-database
--   ODbL v1.0 — attribution required.
--
-- This keeps Robotronix fast at runtime: the web app reads locations locally
-- from Supabase instead of calling an external location API for every form.
-- =====================================================================

-- Quick verification
SELECT COUNT(*) AS country_count FROM public.countries;
SELECT COUNT(*) AS timezone_count FROM public.timezones;
SELECT COUNT(*) FILTER (WHERE is_user_selectable) AS parent_timezone_count
FROM public.timezones;
SELECT code, name, symbol, decimal_digits, is_active, is_default
FROM public.currencies
WHERE is_active = TRUE
ORDER BY sort_order, code;


