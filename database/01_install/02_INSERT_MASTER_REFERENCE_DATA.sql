-- Robotronix™ Learning Portal — Production v1.0.0
-- Generated consolidated release file. Fresh-install oriented; historical patch files are intentionally omitted.


-- ============================================================================
-- COUNTRIES / TIMEZONES / CURRENCIES / REFERENCE SOURCE
-- ============================================================================

-- =====================================================================
-- ROBOTRONIX™ PRODUCTION REFERENCE DATA
-- File: 01_reference_final.sql
-- Purpose:
--   * Standard countries (ISO)
--   * State / province + city master schema
--   * IANA timezone master + parent-friendly selectable timezone layer
--   * ISO currency master + Robotronix active currencies
--
-- IMPORTANT DESIGN RULES
--   1. Never store country/state/city names as free text in core records.
--      Store country_id, state_id and city_id.
--   2. Store IANA timezone names such as Asia/Kolkata, not IST/GMT+5:30.
--   3. Parents normally should NOT browse hundreds of timezones.
--      Country -> State -> City should determine/suggest the timezone.
--   4. Currency code (INR/AED/USD...) is the financial identifier.
--      Currency symbol is display-only. Where a clear/reliable symbol is not
--      available, the ISO currency code itself is used as the display fallback
--      instead of NULL.
--   5. Countries/timezones/currencies are fully seeded here.
--   6. States/cities are created here but should be bulk-imported from ONE
--      maintained location dataset. Do not hand-maintain a global city list.
--
-- Recommended location source:
--   Countries States Cities Database (dr5hn), ODbL v1.0.
--   If that dataset is imported, attribution and licence obligations apply.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. REFERENCE DATA SOURCE / PROVENANCE
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reference_data_sources (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_url TEXT,
    licence TEXT,
    attribution_text TEXT,
    last_imported_at TIMESTAMPTZ
);

INSERT INTO public.reference_data_sources
(code, name, source_url, licence, attribution_text)
VALUES
(
    'CSC_GLOBAL_LOCATIONS',
    'Countries States Cities Database',
    'https://github.com/dr5hn/countries-states-cities-database',
    'ODbL-1.0',
    'Data by Countries States Cities Database | ODbL v1.0'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    source_url = EXCLUDED.source_url,
    licence = EXCLUDED.licence,
    attribution_text = EXCLUDED.attribution_text;

-- ---------------------------------------------------------------------
-- 1. COUNTRIES
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.countries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    iso2 CHAR(2) NOT NULL UNIQUE,
    iso3 CHAR(3) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone_code TEXT,
    default_timezone_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 999,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.countries (iso2, iso3, name)
VALUES
    ('AF', 'AFG', 'Afghanistan'),
    ('AL', 'ALB', 'Albania'),
    ('DZ', 'DZA', 'Algeria'),
    ('AS', 'ASM', 'American Samoa'),
    ('AD', 'AND', 'Andorra'),
    ('AO', 'AGO', 'Angola'),
    ('AI', 'AIA', 'Anguilla'),
    ('AQ', 'ATA', 'Antarctica'),
    ('AG', 'ATG', 'Antigua and Barbuda'),
    ('AR', 'ARG', 'Argentina'),
    ('AM', 'ARM', 'Armenia'),
    ('AW', 'ABW', 'Aruba'),
    ('AU', 'AUS', 'Australia'),
    ('AT', 'AUT', 'Austria'),
    ('AZ', 'AZE', 'Azerbaijan'),
    ('BS', 'BHS', 'Bahamas'),
    ('BH', 'BHR', 'Bahrain'),
    ('BD', 'BGD', 'Bangladesh'),
    ('BB', 'BRB', 'Barbados'),
    ('BY', 'BLR', 'Belarus'),
    ('BE', 'BEL', 'Belgium'),
    ('BZ', 'BLZ', 'Belize'),
    ('BJ', 'BEN', 'Benin'),
    ('BM', 'BMU', 'Bermuda'),
    ('BT', 'BTN', 'Bhutan'),
    ('BO', 'BOL', 'Bolivia, Plurinational State of'),
    ('BQ', 'BES', 'Bonaire, Sint Eustatius and Saba'),
    ('BA', 'BIH', 'Bosnia and Herzegovina'),
    ('BW', 'BWA', 'Botswana'),
    ('BV', 'BVT', 'Bouvet Island'),
    ('BR', 'BRA', 'Brazil'),
    ('IO', 'IOT', 'British Indian Ocean Territory'),
    ('BN', 'BRN', 'Brunei Darussalam'),
    ('BG', 'BGR', 'Bulgaria'),
    ('BF', 'BFA', 'Burkina Faso'),
    ('BI', 'BDI', 'Burundi'),
    ('CV', 'CPV', 'Cabo Verde'),
    ('KH', 'KHM', 'Cambodia'),
    ('CM', 'CMR', 'Cameroon'),
    ('CA', 'CAN', 'Canada'),
    ('KY', 'CYM', 'Cayman Islands'),
    ('CF', 'CAF', 'Central African Republic'),
    ('TD', 'TCD', 'Chad'),
    ('CL', 'CHL', 'Chile'),
    ('CN', 'CHN', 'China'),
    ('CX', 'CXR', 'Christmas Island'),
    ('CC', 'CCK', 'Cocos (Keeling) Islands'),
    ('CO', 'COL', 'Colombia'),
    ('KM', 'COM', 'Comoros'),
    ('CG', 'COG', 'Congo'),
    ('CD', 'COD', 'Congo, The Democratic Republic of the'),
    ('CK', 'COK', 'Cook Islands'),
    ('CR', 'CRI', 'Costa Rica'),
    ('HR', 'HRV', 'Croatia'),
    ('CU', 'CUB', 'Cuba'),
    ('CW', 'CUW', 'Curaçao'),
    ('CY', 'CYP', 'Cyprus'),
    ('CZ', 'CZE', 'Czechia'),
    ('CI', 'CIV', 'Côte d''Ivoire'),
    ('DK', 'DNK', 'Denmark'),
    ('DJ', 'DJI', 'Djibouti'),
    ('DM', 'DMA', 'Dominica'),
    ('DO', 'DOM', 'Dominican Republic'),
    ('EC', 'ECU', 'Ecuador'),
    ('EG', 'EGY', 'Egypt'),
    ('SV', 'SLV', 'El Salvador'),
    ('GQ', 'GNQ', 'Equatorial Guinea'),
    ('ER', 'ERI', 'Eritrea'),
    ('EE', 'EST', 'Estonia'),
    ('SZ', 'SWZ', 'Eswatini'),
    ('ET', 'ETH', 'Ethiopia'),
    ('FK', 'FLK', 'Falkland Islands (Malvinas)'),
    ('FO', 'FRO', 'Faroe Islands'),
    ('FJ', 'FJI', 'Fiji'),
    ('FI', 'FIN', 'Finland'),
    ('FR', 'FRA', 'France'),
    ('GF', 'GUF', 'French Guiana'),
    ('PF', 'PYF', 'French Polynesia'),
    ('TF', 'ATF', 'French Southern Territories'),
    ('GA', 'GAB', 'Gabon'),
    ('GM', 'GMB', 'Gambia'),
    ('GE', 'GEO', 'Georgia'),
    ('DE', 'DEU', 'Germany'),
    ('GH', 'GHA', 'Ghana'),
    ('GI', 'GIB', 'Gibraltar'),
    ('GR', 'GRC', 'Greece'),
    ('GL', 'GRL', 'Greenland'),
    ('GD', 'GRD', 'Grenada'),
    ('GP', 'GLP', 'Guadeloupe'),
    ('GU', 'GUM', 'Guam'),
    ('GT', 'GTM', 'Guatemala'),
    ('GG', 'GGY', 'Guernsey'),
    ('GN', 'GIN', 'Guinea'),
    ('GW', 'GNB', 'Guinea-Bissau'),
    ('GY', 'GUY', 'Guyana'),
    ('HT', 'HTI', 'Haiti'),
    ('HM', 'HMD', 'Heard Island and McDonald Islands'),
    ('VA', 'VAT', 'Holy See (Vatican City State)'),
    ('HN', 'HND', 'Honduras'),
    ('HK', 'HKG', 'Hong Kong'),
    ('HU', 'HUN', 'Hungary'),
    ('IS', 'ISL', 'Iceland'),
    ('IN', 'IND', 'India'),
    ('ID', 'IDN', 'Indonesia'),
    ('IR', 'IRN', 'Iran, Islamic Republic of'),
    ('IQ', 'IRQ', 'Iraq'),
    ('IE', 'IRL', 'Ireland'),
    ('IM', 'IMN', 'Isle of Man'),
    ('IL', 'ISR', 'Israel'),
    ('IT', 'ITA', 'Italy'),
    ('JM', 'JAM', 'Jamaica'),
    ('JP', 'JPN', 'Japan'),
    ('JE', 'JEY', 'Jersey'),
    ('JO', 'JOR', 'Jordan'),
    ('KZ', 'KAZ', 'Kazakhstan'),
    ('KE', 'KEN', 'Kenya'),
    ('KI', 'KIR', 'Kiribati'),
    ('KP', 'PRK', 'Korea, Democratic People''s Republic of'),
    ('KR', 'KOR', 'Korea, Republic of'),
    ('KW', 'KWT', 'Kuwait'),
    ('KG', 'KGZ', 'Kyrgyzstan'),
    ('LA', 'LAO', 'Lao People''s Democratic Republic'),
    ('LV', 'LVA', 'Latvia'),
    ('LB', 'LBN', 'Lebanon'),
    ('LS', 'LSO', 'Lesotho'),
    ('LR', 'LBR', 'Liberia'),
    ('LY', 'LBY', 'Libya'),
    ('LI', 'LIE', 'Liechtenstein'),
    ('LT', 'LTU', 'Lithuania'),
    ('LU', 'LUX', 'Luxembourg'),
    ('MO', 'MAC', 'Macao'),
    ('MG', 'MDG', 'Madagascar'),
    ('MW', 'MWI', 'Malawi'),
    ('MY', 'MYS', 'Malaysia'),
    ('MV', 'MDV', 'Maldives'),
    ('ML', 'MLI', 'Mali'),
    ('MT', 'MLT', 'Malta'),
    ('MH', 'MHL', 'Marshall Islands'),
    ('MQ', 'MTQ', 'Martinique'),
    ('MR', 'MRT', 'Mauritania'),
    ('MU', 'MUS', 'Mauritius'),
    ('YT', 'MYT', 'Mayotte'),
    ('MX', 'MEX', 'Mexico'),
    ('FM', 'FSM', 'Micronesia, Federated States of'),
    ('MD', 'MDA', 'Moldova, Republic of'),
    ('MC', 'MCO', 'Monaco'),
    ('MN', 'MNG', 'Mongolia'),
    ('ME', 'MNE', 'Montenegro'),
    ('MS', 'MSR', 'Montserrat'),
    ('MA', 'MAR', 'Morocco'),
    ('MZ', 'MOZ', 'Mozambique'),
    ('MM', 'MMR', 'Myanmar'),
    ('NA', 'NAM', 'Namibia'),
    ('NR', 'NRU', 'Nauru'),
    ('NP', 'NPL', 'Nepal'),
    ('NL', 'NLD', 'Netherlands'),
    ('NC', 'NCL', 'New Caledonia'),
    ('NZ', 'NZL', 'New Zealand'),
    ('NI', 'NIC', 'Nicaragua'),
    ('NE', 'NER', 'Niger'),
    ('NG', 'NGA', 'Nigeria'),
    ('NU', 'NIU', 'Niue'),
    ('NF', 'NFK', 'Norfolk Island'),
    ('MK', 'MKD', 'North Macedonia'),
    ('MP', 'MNP', 'Northern Mariana Islands'),
    ('NO', 'NOR', 'Norway'),
    ('OM', 'OMN', 'Oman'),
    ('PK', 'PAK', 'Pakistan'),
    ('PW', 'PLW', 'Palau'),
    ('PS', 'PSE', 'Palestine, State of'),
    ('PA', 'PAN', 'Panama'),
    ('PG', 'PNG', 'Papua New Guinea'),
    ('PY', 'PRY', 'Paraguay'),
    ('PE', 'PER', 'Peru'),
    ('PH', 'PHL', 'Philippines'),
    ('PN', 'PCN', 'Pitcairn'),
    ('PL', 'POL', 'Poland'),
    ('PT', 'PRT', 'Portugal'),
    ('PR', 'PRI', 'Puerto Rico'),
    ('QA', 'QAT', 'Qatar'),
    ('RO', 'ROU', 'Romania'),
    ('RU', 'RUS', 'Russian Federation'),
    ('RW', 'RWA', 'Rwanda'),
    ('RE', 'REU', 'Réunion'),
    ('BL', 'BLM', 'Saint Barthélemy'),
    ('SH', 'SHN', 'Saint Helena, Ascension and Tristan da Cunha'),
    ('KN', 'KNA', 'Saint Kitts and Nevis'),
    ('LC', 'LCA', 'Saint Lucia'),
    ('MF', 'MAF', 'Saint Martin (French part)'),
    ('PM', 'SPM', 'Saint Pierre and Miquelon'),
    ('VC', 'VCT', 'Saint Vincent and the Grenadines'),
    ('WS', 'WSM', 'Samoa'),
    ('SM', 'SMR', 'San Marino'),
    ('ST', 'STP', 'Sao Tome and Principe'),
    ('SA', 'SAU', 'Saudi Arabia'),
    ('SN', 'SEN', 'Senegal'),
    ('RS', 'SRB', 'Serbia'),
    ('SC', 'SYC', 'Seychelles'),
    ('SL', 'SLE', 'Sierra Leone'),
    ('SG', 'SGP', 'Singapore'),
    ('SX', 'SXM', 'Sint Maarten (Dutch part)'),
    ('SK', 'SVK', 'Slovakia'),
    ('SI', 'SVN', 'Slovenia'),
    ('SB', 'SLB', 'Solomon Islands'),
    ('SO', 'SOM', 'Somalia'),
    ('ZA', 'ZAF', 'South Africa'),
    ('GS', 'SGS', 'South Georgia and the South Sandwich Islands'),
    ('SS', 'SSD', 'South Sudan'),
    ('ES', 'ESP', 'Spain'),
    ('LK', 'LKA', 'Sri Lanka'),
    ('SD', 'SDN', 'Sudan'),
    ('SR', 'SUR', 'Suriname'),
    ('SJ', 'SJM', 'Svalbard and Jan Mayen'),
    ('SE', 'SWE', 'Sweden'),
    ('CH', 'CHE', 'Switzerland'),
    ('SY', 'SYR', 'Syrian Arab Republic'),
    ('TW', 'TWN', 'Taiwan, Province of China'),
    ('TJ', 'TJK', 'Tajikistan'),
    ('TZ', 'TZA', 'Tanzania, United Republic of'),
    ('TH', 'THA', 'Thailand'),
    ('TL', 'TLS', 'Timor-Leste'),
    ('TG', 'TGO', 'Togo'),
    ('TK', 'TKL', 'Tokelau'),
    ('TO', 'TON', 'Tonga'),
    ('TT', 'TTO', 'Trinidad and Tobago'),
    ('TN', 'TUN', 'Tunisia'),
    ('TM', 'TKM', 'Turkmenistan'),
    ('TC', 'TCA', 'Turks and Caicos Islands'),
    ('TV', 'TUV', 'Tuvalu'),
    ('TR', 'TUR', 'Türkiye'),
    ('UG', 'UGA', 'Uganda'),
    ('UA', 'UKR', 'Ukraine'),
    ('AE', 'ARE', 'United Arab Emirates'),
    ('GB', 'GBR', 'United Kingdom'),
    ('US', 'USA', 'United States'),
    ('UM', 'UMI', 'United States Minor Outlying Islands'),
    ('UY', 'URY', 'Uruguay'),
    ('UZ', 'UZB', 'Uzbekistan'),
    ('VU', 'VUT', 'Vanuatu'),
    ('VE', 'VEN', 'Venezuela, Bolivarian Republic of'),
    ('VN', 'VNM', 'Viet Nam'),
    ('VG', 'VGB', 'Virgin Islands, British'),
    ('VI', 'VIR', 'Virgin Islands, U.S.'),
    ('WF', 'WLF', 'Wallis and Futuna'),
    ('EH', 'ESH', 'Western Sahara'),
    ('YE', 'YEM', 'Yemen'),
    ('ZM', 'ZMB', 'Zambia'),
    ('ZW', 'ZWE', 'Zimbabwe'),
    ('AX', 'ALA', 'Åland Islands')
ON CONFLICT (iso2) DO UPDATE SET
    iso3 = EXCLUDED.iso3,
    name = EXCLUDED.name,
    updated_at = NOW();

-- Put likely Robotronix markets first in dropdowns.
UPDATE public.countries
SET sort_order = CASE iso2
    WHEN 'IN' THEN 1
    WHEN 'AE' THEN 2
    WHEN 'SA' THEN 3
    WHEN 'QA' THEN 4
    WHEN 'OM' THEN 5
    WHEN 'KW' THEN 6
    WHEN 'BH' THEN 7
    WHEN 'SG' THEN 8
    WHEN 'HK' THEN 9
    WHEN 'GB' THEN 10
    WHEN 'US' THEN 11
    WHEN 'CA' THEN 12
    WHEN 'AU' THEN 13
    WHEN 'NZ' THEN 14
    WHEN 'MY' THEN 15
    ELSE 999
END;

-- Safe defaults only for countries where this is useful as an initial suggestion.
-- City timezone remains the preferred source when available.
UPDATE public.countries SET default_timezone_name = 'Asia/Kolkata' WHERE iso2 = 'IN';
UPDATE public.countries SET default_timezone_name = 'Asia/Dubai' WHERE iso2 = 'AE';
UPDATE public.countries SET default_timezone_name = 'Asia/Riyadh' WHERE iso2 = 'SA';
UPDATE public.countries SET default_timezone_name = 'Asia/Qatar' WHERE iso2 = 'QA';
UPDATE public.countries SET default_timezone_name = 'Asia/Muscat' WHERE iso2 = 'OM';
UPDATE public.countries SET default_timezone_name = 'Asia/Kuwait' WHERE iso2 = 'KW';
UPDATE public.countries SET default_timezone_name = 'Asia/Bahrain' WHERE iso2 = 'BH';
UPDATE public.countries SET default_timezone_name = 'Asia/Singapore' WHERE iso2 = 'SG';
UPDATE public.countries SET default_timezone_name = 'Asia/Hong_Kong' WHERE iso2 = 'HK';

-- ---------------------------------------------------------------------
-- 2. TIMEZONES
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.timezones (
    iana_name TEXT PRIMARY KEY,
    display_name TEXT,
    country_code CHAR(2),
    city_label TEXT,
    is_user_selectable BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 999,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PostgreSQL already knows the IANA timezone catalogue.
-- This avoids hard-coding hundreds of timezone names into the seed.
INSERT INTO public.timezones (iana_name)
SELECT DISTINCT name
FROM pg_timezone_names
WHERE name NOT LIKE 'Etc/%'
  AND name NOT LIKE 'posix/%'
  AND name NOT LIKE 'right/%'
  AND name NOT IN ('Factory','GMT','GMT0','Greenwich','UCT','UTC','Universal','Zulu',
                   'CET','EET','MET','WET','EST','HST','MST')
ON CONFLICT (iana_name) DO NOTHING;

-- Parent-friendly shortlist.
-- The app should normally auto-select timezone from the chosen city.
WITH friendly(iana_name, display_name, country_code, city_label, sort_order) AS (
VALUES
    ('Asia/Kolkata', 'India — New Delhi', 'IN', 'New Delhi', 1),
    ('Asia/Dubai', 'UAE — Dubai', 'AE', 'Dubai', 2),
    ('Asia/Riyadh', 'Saudi Arabia — Riyadh', 'SA', 'Riyadh', 3),
    ('Asia/Qatar', 'Qatar — Doha', 'QA', 'Doha', 4),
    ('Asia/Muscat', 'Oman — Muscat', 'OM', 'Muscat', 5),
    ('Asia/Kuwait', 'Kuwait — Kuwait City', 'KW', 'Kuwait City', 6),
    ('Asia/Bahrain', 'Bahrain — Manama', 'BH', 'Manama', 7),
    ('Asia/Singapore', 'Singapore', 'SG', 'Singapore', 8),
    ('Asia/Hong_Kong', 'Hong Kong', 'HK', 'Hong Kong', 9),
    ('Asia/Kuala_Lumpur', 'Malaysia — Kuala Lumpur', 'MY', 'Kuala Lumpur', 10),
    ('Europe/London', 'United Kingdom — London', 'GB', 'London', 11),
    ('Europe/Paris', 'Central Europe — Paris', 'FR', 'Paris', 12),
    ('America/New_York', 'USA — New York', 'US', 'New York', 13),
    ('America/Chicago', 'USA — Chicago', 'US', 'Chicago', 14),
    ('America/Denver', 'USA — Denver', 'US', 'Denver', 15),
    ('America/Los_Angeles', 'USA — Los Angeles', 'US', 'Los Angeles', 16),
    ('America/Toronto', 'Canada — Toronto', 'CA', 'Toronto', 17),
    ('America/Vancouver', 'Canada — Vancouver', 'CA', 'Vancouver', 18),
    ('Australia/Sydney', 'Australia — Sydney', 'AU', 'Sydney', 19),
    ('Australia/Perth', 'Australia — Perth', 'AU', 'Perth', 20),
    ('Pacific/Auckland', 'New Zealand — Auckland', 'NZ', 'Auckland', 21)
)
UPDATE public.timezones t
SET
    display_name = f.display_name,
    country_code = f.country_code,
    city_label = f.city_label,
    is_user_selectable = TRUE,
    sort_order = f.sort_order
FROM friendly f
WHERE t.iana_name = f.iana_name;

-- ---------------------------------------------------------------------
-- 3. STATES / PROVINCES / REGIONS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.states (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_id BIGINT,
    country_id BIGINT NOT NULL REFERENCES public.countries(id) ON DELETE RESTRICT,
    code TEXT,
    name TEXT NOT NULL,
    type TEXT,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    timezone_name TEXT REFERENCES public.timezones(iana_name),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 999,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (country_id, name)
);

-- ---------------------------------------------------------------------
-- 4. CITIES
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cities (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_id BIGINT,
    country_id BIGINT NOT NULL REFERENCES public.countries(id) ON DELETE RESTRICT,
    state_id BIGINT REFERENCES public.states(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    native_name TEXT,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    timezone_name TEXT REFERENCES public.timezones(iana_name),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (country_id, state_id, name)
);

-- Optional aliases keep search friendly while saved records remain standardized.
-- Example: searching "Gurgaon" can resolve to the canonical city "Gurugram".
CREATE TABLE IF NOT EXISTS public.city_aliases (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    city_id BIGINT NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    UNIQUE (city_id, alias)
);

-- ---------------------------------------------------------------------
-- 5. CURRENCIES
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.currencies (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code CHAR(3) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    symbol TEXT,
    decimal_digits INTEGER NOT NULL DEFAULT 2
        CHECK (decimal_digits BETWEEN 0 AND 4),
    sort_order INTEGER NOT NULL DEFAULT 999,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.currencies
(code, name, symbol, decimal_digits, sort_order, is_active, is_default)
VALUES
    ('AED', 'UAE Dirham', 'AED', 2, 2, TRUE, FALSE),
    ('AFN', 'Afghani', 'AFN', 0, 999, FALSE, FALSE),
    ('ALL', 'Lek', 'ALL', 0, 999, FALSE, FALSE),
    ('AMD', 'Armenian Dram', 'AMD', 2, 999, FALSE, FALSE),
    ('ANG', 'Netherlands Antillean Guilder', 'ANG', 2, 999, FALSE, FALSE),
    ('AOA', 'Kwanza', 'AOA', 2, 999, FALSE, FALSE),
    ('ARS', 'Argentine Peso', 'ARS', 2, 999, FALSE, FALSE),
    ('AUD', 'Australian Dollar', 'A$', 2, 14, TRUE, FALSE),
    ('AWG', 'Aruban Florin', 'AWG', 2, 999, FALSE, FALSE),
    ('AZN', 'Azerbaijan Manat', 'AZN', 2, 999, FALSE, FALSE),
    ('BAM', 'Convertible Mark', 'BAM', 2, 999, FALSE, FALSE),
    ('BBD', 'Barbados Dollar', 'BBD', 2, 999, FALSE, FALSE),
    ('BDT', 'Taka', 'BDT', 2, 999, FALSE, FALSE),
    ('BGN', 'Bulgarian Lev', 'BGN', 2, 999, FALSE, FALSE),
    ('BHD', 'Bahraini Dinar', 'BHD', 3, 7, TRUE, FALSE),
    ('BIF', 'Burundi Franc', 'BIF', 0, 999, FALSE, FALSE),
    ('BMD', 'Bermudian Dollar', 'BMD', 2, 999, FALSE, FALSE),
    ('BND', 'Brunei Dollar', 'BND', 2, 999, FALSE, FALSE),
    ('BOB', 'Boliviano', 'BOB', 2, 999, FALSE, FALSE),
    ('BOV', 'Mvdol', 'BOV', 2, 999, FALSE, FALSE),
    ('BRL', 'Brazilian Real', 'R$', 2, 999, FALSE, FALSE),
    ('BSD', 'Bahamian Dollar', 'BSD', 2, 999, FALSE, FALSE),
    ('BTN', 'Ngultrum', 'BTN', 2, 999, FALSE, FALSE),
    ('BWP', 'Pula', 'BWP', 2, 999, FALSE, FALSE),
    ('BYN', 'Belarusian Ruble', 'BYN', 2, 999, FALSE, FALSE),
    ('BZD', 'Belize Dollar', 'BZD', 2, 999, FALSE, FALSE),
    ('CAD', 'Canadian Dollar', 'C$', 2, 16, TRUE, FALSE),
    ('CDF', 'Congolese Franc', 'CDF', 2, 999, FALSE, FALSE),
    ('CHE', 'WIR Euro', 'CHE', 2, 999, FALSE, FALSE),
    ('CHF', 'Swiss Franc', 'CHF', 2, 999, FALSE, FALSE),
    ('CHW', 'WIR Franc', 'CHW', 2, 999, FALSE, FALSE),
    ('CLF', 'Unidad de Fomento', 'CLF', 4, 999, FALSE, FALSE),
    ('CLP', 'Chilean Peso', 'CLP', 0, 999, FALSE, FALSE),
    ('CNY', 'Yuan Renminbi', 'CN¥', 2, 999, FALSE, FALSE),
    ('COP', 'Colombian Peso', 'COP', 2, 999, FALSE, FALSE),
    ('COU', 'Unidad de Valor Real', 'COU', 2, 999, FALSE, FALSE),
    ('CRC', 'Costa Rican Colon', 'CRC', 2, 999, FALSE, FALSE),
    ('CUC', 'Peso Convertible', 'CUC', 2, 999, FALSE, FALSE),
    ('CUP', 'Cuban Peso', 'CUP', 2, 999, FALSE, FALSE),
    ('CVE', 'Cabo Verde Escudo', 'CVE', 2, 999, FALSE, FALSE),
    ('CZK', 'Czech Koruna', 'CZK', 2, 999, FALSE, FALSE),
    ('DJF', 'Djibouti Franc', 'DJF', 0, 999, FALSE, FALSE),
    ('DKK', 'Danish Krone', 'DKK', 2, 999, FALSE, FALSE),
    ('DOP', 'Dominican Peso', 'DOP', 2, 999, FALSE, FALSE),
    ('DZD', 'Algerian Dinar', 'DZD', 2, 999, FALSE, FALSE),
    ('EGP', 'Egyptian Pound', 'EGP', 2, 999, FALSE, FALSE),
    ('ERN', 'Nakfa', 'ERN', 2, 999, FALSE, FALSE),
    ('ETB', 'Ethiopian Birr', 'ETB', 2, 999, FALSE, FALSE),
    ('EUR', 'Euro', '€', 2, 9, TRUE, FALSE),
    ('FJD', 'Fiji Dollar', 'FJD', 2, 999, FALSE, FALSE),
    ('FKP', 'Falkland Islands Pound', 'FKP', 2, 999, FALSE, FALSE),
    ('GBP', 'Pound Sterling', '£', 2, 10, TRUE, FALSE),
    ('GEL', 'Lari', 'GEL', 2, 999, FALSE, FALSE),
    ('GHS', 'Ghana Cedi', 'GHS', 2, 999, FALSE, FALSE),
    ('GIP', 'Gibraltar Pound', 'GIP', 2, 999, FALSE, FALSE),
    ('GMD', 'Dalasi', 'GMD', 2, 999, FALSE, FALSE),
    ('GNF', 'Guinean Franc', 'GNF', 0, 999, FALSE, FALSE),
    ('GTQ', 'Quetzal', 'GTQ', 2, 999, FALSE, FALSE),
    ('GYD', 'Guyana Dollar', 'GYD', 2, 999, FALSE, FALSE),
    ('HKD', 'Hong Kong Dollar', 'HK$', 2, 12, TRUE, FALSE),
    ('HNL', 'Lempira', 'HNL', 2, 999, FALSE, FALSE),
    ('HRK', 'Kuna', 'HRK', 2, 999, FALSE, FALSE),
    ('HTG', 'Gourde', 'HTG', 2, 999, FALSE, FALSE),
    ('HUF', 'Forint', 'HUF', 2, 999, FALSE, FALSE),
    ('IDR', 'Rupiah', 'IDR', 2, 999, FALSE, FALSE),
    ('ILS', 'New Israeli Sheqel', '₪', 2, 999, FALSE, FALSE),
    ('INR', 'Indian Rupee', '₹', 2, 1, TRUE, TRUE),
    ('IQD', 'Iraqi Dinar', 'IQD', 0, 999, FALSE, FALSE),
    ('IRR', 'Iranian Rial', 'IRR', 0, 999, FALSE, FALSE),
    ('ISK', 'Iceland Krona', 'ISK', 0, 999, FALSE, FALSE),
    ('JMD', 'Jamaican Dollar', 'JMD', 2, 999, FALSE, FALSE),
    ('JOD', 'Jordanian Dinar', 'JOD', 3, 999, FALSE, FALSE),
    ('JPY', 'Yen', '¥', 0, 999, FALSE, FALSE),
    ('KES', 'Kenyan Shilling', 'KES', 2, 999, FALSE, FALSE),
    ('KGS', 'Som', 'KGS', 2, 999, FALSE, FALSE),
    ('KHR', 'Riel', 'KHR', 2, 999, FALSE, FALSE),
    ('KMF', 'Comorian Franc', 'KMF', 0, 999, FALSE, FALSE),
    ('KPW', 'North Korean Won', 'KPW', 0, 999, FALSE, FALSE),
    ('KRW', 'Won', '₩', 0, 999, FALSE, FALSE),
    ('KWD', 'Kuwaiti Dinar', 'KWD', 3, 6, TRUE, FALSE),
    ('KYD', 'Cayman Islands Dollar', 'KYD', 2, 999, FALSE, FALSE),
    ('KZT', 'Tenge', 'KZT', 2, 999, FALSE, FALSE),
    ('LAK', 'Lao Kip', 'LAK', 0, 999, FALSE, FALSE),
    ('LBP', 'Lebanese Pound', 'LBP', 0, 999, FALSE, FALSE),
    ('LKR', 'Sri Lanka Rupee', 'LKR', 2, 999, FALSE, FALSE),
    ('LRD', 'Liberian Dollar', 'LRD', 2, 999, FALSE, FALSE),
    ('LSL', 'Loti', 'LSL', 2, 999, FALSE, FALSE),
    ('LYD', 'Libyan Dinar', 'LYD', 3, 999, FALSE, FALSE),
    ('MAD', 'Moroccan Dirham', 'MAD', 2, 999, FALSE, FALSE),
    ('MDL', 'Moldovan Leu', 'MDL', 2, 999, FALSE, FALSE),
    ('MGA', 'Malagasy Ariary', 'MGA', 0, 999, FALSE, FALSE),
    ('MKD', 'Denar', 'MKD', 2, 999, FALSE, FALSE),
    ('MMK', 'Kyat', 'MMK', 0, 999, FALSE, FALSE),
    ('MNT', 'Tugrik', 'MNT', 2, 999, FALSE, FALSE),
    ('MOP', 'Pataca', 'MOP', 2, 999, FALSE, FALSE),
    ('MRU', 'Ouguiya', 'MRU', 2, 999, FALSE, FALSE),
    ('MUR', 'Mauritius Rupee', 'MUR', 2, 999, FALSE, FALSE),
    ('MVR', 'Rufiyaa', 'MVR', 2, 999, FALSE, FALSE),
    ('MWK', 'Malawi Kwacha', 'MWK', 2, 999, FALSE, FALSE),
    ('MXN', 'Mexican Peso', 'MX$', 2, 999, FALSE, FALSE),
    ('MXV', 'Mexican Unidad de Inversion (UDI)', 'MXV', 2, 999, FALSE, FALSE),
    ('MYR', 'Malaysian Ringgit', 'RM', 2, 13, TRUE, FALSE),
    ('MZN', 'Mozambique Metical', 'MZN', 2, 999, FALSE, FALSE),
    ('NAD', 'Namibia Dollar', 'NAD', 2, 999, FALSE, FALSE),
    ('NGN', 'Naira', 'NGN', 2, 999, FALSE, FALSE),
    ('NIO', 'Cordoba Oro', 'NIO', 2, 999, FALSE, FALSE),
    ('NOK', 'Norwegian Krone', 'NOK', 2, 999, FALSE, FALSE),
    ('NPR', 'Nepalese Rupee', 'NPR', 2, 999, FALSE, FALSE),
    ('NZD', 'New Zealand Dollar', 'NZ$', 2, 15, TRUE, FALSE),
    ('OMR', 'Rial Omani', 'OMR', 3, 5, TRUE, FALSE),
    ('PAB', 'Balboa', 'PAB', 2, 999, FALSE, FALSE),
    ('PEN', 'Sol', 'PEN', 2, 999, FALSE, FALSE),
    ('PGK', 'Kina', 'PGK', 2, 999, FALSE, FALSE),
    ('PHP', 'Philippine Peso', '₱', 2, 999, FALSE, FALSE),
    ('PKR', 'Pakistan Rupee', 'PKR', 2, 999, FALSE, FALSE),
    ('PLN', 'Zloty', 'PLN', 2, 999, FALSE, FALSE),
    ('PYG', 'Guarani', 'PYG', 0, 999, FALSE, FALSE),
    ('QAR', 'Qatari Rial', 'QAR', 2, 4, TRUE, FALSE),
    ('RON', 'Romanian Leu', 'RON', 2, 999, FALSE, FALSE),
    ('RSD', 'Serbian Dinar', 'RSD', 0, 999, FALSE, FALSE),
    ('RUB', 'Russian Ruble', 'RUB', 2, 999, FALSE, FALSE),
    ('RWF', 'Rwanda Franc', 'RWF', 0, 999, FALSE, FALSE),
    ('SAR', 'Saudi Riyal', 'SAR', 2, 3, TRUE, FALSE),
    ('SBD', 'Solomon Islands Dollar', 'SBD', 2, 999, FALSE, FALSE),
    ('SCR', 'Seychelles Rupee', 'SCR', 2, 999, FALSE, FALSE),
    ('SDG', 'Sudanese Pound', 'SDG', 2, 999, FALSE, FALSE),
    ('SEK', 'Swedish Krona', 'SEK', 2, 999, FALSE, FALSE),
    ('SGD', 'Singapore Dollar', 'S$', 2, 11, TRUE, FALSE),
    ('SHP', 'Saint Helena Pound', 'SHP', 2, 999, FALSE, FALSE),
    ('SLE', 'Leone', 'SLE', 2, 999, FALSE, FALSE),
    ('SLL', 'Leone', 'SLL', 0, 999, FALSE, FALSE),
    ('SOS', 'Somali Shilling', 'SOS', 0, 999, FALSE, FALSE),
    ('SRD', 'Surinam Dollar', 'SRD', 2, 999, FALSE, FALSE),
    ('SSP', 'South Sudanese Pound', 'SSP', 2, 999, FALSE, FALSE),
    ('STN', 'Dobra', 'STN', 2, 999, FALSE, FALSE),
    ('SVC', 'El Salvador Colon', 'SVC', 2, 999, FALSE, FALSE),
    ('SYP', 'Syrian Pound', 'SYP', 0, 999, FALSE, FALSE),
    ('SZL', 'Lilangeni', 'SZL', 2, 999, FALSE, FALSE),
    ('THB', 'Baht', 'THB', 2, 999, FALSE, FALSE),
    ('TJS', 'Somoni', 'TJS', 2, 999, FALSE, FALSE),
    ('TMT', 'Turkmenistan New Manat', 'TMT', 2, 999, FALSE, FALSE),
    ('TND', 'Tunisian Dinar', 'TND', 3, 999, FALSE, FALSE),
    ('TOP', 'Pa’anga', 'TOP', 2, 999, FALSE, FALSE),
    ('TRY', 'Turkish Lira', 'TRY', 2, 999, FALSE, FALSE),
    ('TTD', 'Trinidad and Tobago Dollar', 'TTD', 2, 999, FALSE, FALSE),
    ('TWD', 'New Taiwan Dollar', 'NT$', 2, 999, FALSE, FALSE),
    ('TZS', 'Tanzanian Shilling', 'TZS', 2, 999, FALSE, FALSE),
    ('UAH', 'Hryvnia', 'UAH', 2, 999, FALSE, FALSE),
    ('UGX', 'Uganda Shilling', 'UGX', 0, 999, FALSE, FALSE),
    ('USD', 'US Dollar', '$', 2, 8, TRUE, FALSE),
    ('USN', 'US Dollar (Next day)', 'USN', 2, 999, FALSE, FALSE),
    ('UYI', 'Uruguay Peso en Unidades Indexadas (UI)', 'UYI', 0, 999, FALSE, FALSE),
    ('UYU', 'Peso Uruguayo', 'UYU', 2, 999, FALSE, FALSE),
    ('UYW', 'Unidad Previsional', 'UYW', 4, 999, FALSE, FALSE),
    ('UZS', 'Uzbekistan Sum', 'UZS', 2, 999, FALSE, FALSE),
    ('VED', 'Bolívar Soberano', 'VED', 2, 999, FALSE, FALSE),
    ('VES', 'Bolívar Soberano', 'VES', 2, 999, FALSE, FALSE),
    ('VND', 'Dong', '₫', 0, 999, FALSE, FALSE),
    ('VUV', 'Vatu', 'VUV', 0, 999, FALSE, FALSE),
    ('WST', 'Tala', 'WST', 2, 999, FALSE, FALSE),
    ('XAF', 'CFA Franc BEAC', 'FCFA', 0, 999, FALSE, FALSE),
    ('XAG', 'Silver', 'XAG', 2, 999, FALSE, FALSE),
    ('XAU', 'Gold', 'XAU', 2, 999, FALSE, FALSE),
    ('XBA', 'Bond Markets Unit European Composite Unit (EURCO)', 'XBA', 2, 999, FALSE, FALSE),
    ('XBB', 'Bond Markets Unit European Monetary Unit (E.M.U.-6)', 'XBB', 2, 999, FALSE, FALSE),
    ('XBC', 'Bond Markets Unit European Unit of Account 9 (E.U.A.-9)', 'XBC', 2, 999, FALSE, FALSE),
    ('XBD', 'Bond Markets Unit European Unit of Account 17 (E.U.A.-17)', 'XBD', 2, 999, FALSE, FALSE),
    ('XCD', 'East Caribbean Dollar', 'EC$', 2, 999, FALSE, FALSE),
    ('XDR', 'SDR (Special Drawing Right)', 'XDR', 2, 999, FALSE, FALSE),
    ('XOF', 'CFA Franc BCEAO', 'F CFA', 0, 999, FALSE, FALSE),
    ('XPD', 'Palladium', 'XPD', 2, 999, FALSE, FALSE),
    ('XPF', 'CFP Franc', 'CFPF', 0, 999, FALSE, FALSE),
    ('XPT', 'Platinum', 'XPT', 2, 999, FALSE, FALSE),
    ('XSU', 'Sucre', 'XSU', 2, 999, FALSE, FALSE),
    ('XTS', 'Codes specifically reserved for testing purposes', 'XTS', 2, 999, FALSE, FALSE),
    ('XUA', 'ADB Unit of Account', 'XUA', 2, 999, FALSE, FALSE),
    ('XXX', 'The codes assigned for transactions where no currency is involved', '¤', 2, 999, FALSE, FALSE),
    ('YER', 'Yemeni Rial', 'YER', 0, 999, FALSE, FALSE),
    ('ZAR', 'Rand', 'ZAR', 2, 999, FALSE, FALSE),
    ('ZMW', 'Zambian Kwacha', 'ZMW', 2, 999, FALSE, FALSE),
    ('ZWL', 'Zimbabwe Dollar', 'ZWL', 2, 999, FALSE, FALSE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    symbol = EXCLUDED.symbol,
    decimal_digits = EXCLUDED.decimal_digits,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    is_default = EXCLUDED.is_default,
    updated_at = NOW();

-- Robotronix default currency: INR
UPDATE public.currencies
SET
    is_default = (code = 'INR'),
    is_active = CASE WHEN code = 'INR' THEN TRUE ELSE is_active END,
    updated_at = NOW()
WHERE is_default IS DISTINCT FROM (code = 'INR')
   OR (code = 'INR' AND is_active = FALSE);

CREATE UNIQUE INDEX IF NOT EXISTS ux_currencies_single_default
ON public.currencies ((is_default))
WHERE is_default = TRUE;

-- ---------------------------------------------------------------------
-- 6. INDEXES FOR DEPENDENT DROPDOWNS / SEARCH
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_countries_active_sort
    ON public.countries (is_active, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_states_country_active_name
    ON public.states (country_id, is_active, name);

CREATE INDEX IF NOT EXISTS idx_cities_state_active_name
    ON public.cities (state_id, is_active, name);

CREATE INDEX IF NOT EXISTS idx_cities_country_active_name
    ON public.cities (country_id, is_active, name);

CREATE INDEX IF NOT EXISTS idx_city_aliases_alias_lower
    ON public.city_aliases (LOWER(alias));

CREATE INDEX IF NOT EXISTS idx_timezones_selectable_sort
    ON public.timezones (is_user_selectable, sort_order);

CREATE INDEX IF NOT EXISTS idx_currencies_active_sort
    ON public.currencies (is_active, sort_order, code);

COMMIT;

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


-- ============================================================================
-- ACADEMIC LEVEL MASTER + COURSE MAPPING
-- ============================================================================

-- ============================================================
-- ROBOTRONIX™ ACADEMIC MASTER - FINAL V2
-- File: 02_academic_final_v2.sql
--
-- Designed for the CURRENT Robotronix schema where:
--   public.courses.id = UUID
--   public.courses.grade_from = INTEGER
--   public.courses.grade_to = INTEGER
--
-- Purpose:
--   1. Create/populate academic level master
--   2. Create UUID-compatible course-to-academic-level mapping
--   3. Automatically map EXISTING courses from grade_from/grade_to
--
-- IMPORTANT:
--   * This script DOES NOT create, replace, or overwrite public.courses.
--   * It DOES NOT insert the 20 production Robotronix courses.
--   * College/Postgraduate/Professional eligibility can be added explicitly
--     later for real production courses.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. ACADEMIC LEVEL MASTER
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.academic_levels (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    level_group TEXT NOT NULL,
    grade_number INTEGER,
    sort_order INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If an older academic_levels table already exists without grade_number,
-- add it safely.
ALTER TABLE public.academic_levels
    ADD COLUMN IF NOT EXISTS grade_number INTEGER;

-- Optional consistency check:
-- school grades may have grade_number; non-grade levels remain NULL.
ALTER TABLE public.academic_levels
    DROP CONSTRAINT IF EXISTS academic_levels_grade_number_check;

ALTER TABLE public.academic_levels
    ADD CONSTRAINT academic_levels_grade_number_check
    CHECK (grade_number IS NULL OR grade_number BETWEEN 1 AND 12);

INSERT INTO public.academic_levels
    (code, name, level_group, grade_number, sort_order, is_active)
VALUES
    ('PRE_NURSERY',          'Pre-Nursery',              'school',            NULL,  1, TRUE),
    ('NURSERY',              'Nursery',                  'school',            NULL,  2, TRUE),
    ('KG',                   'KG',                       'school',            NULL,  3, TRUE),

    ('GRADE_01',             'Grade 1',                  'school',               1,  4, TRUE),
    ('GRADE_02',             'Grade 2',                  'school',               2,  5, TRUE),
    ('GRADE_03',             'Grade 3',                  'school',               3,  6, TRUE),
    ('GRADE_04',             'Grade 4',                  'school',               4,  7, TRUE),
    ('GRADE_05',             'Grade 5',                  'school',               5,  8, TRUE),
    ('GRADE_06',             'Grade 6',                  'school',               6,  9, TRUE),
    ('GRADE_07',             'Grade 7',                  'school',               7, 10, TRUE),
    ('GRADE_08',             'Grade 8',                  'school',               8, 11, TRUE),
    ('GRADE_09',             'Grade 9',                  'school',               9, 12, TRUE),
    ('GRADE_10',             'Grade 10',                 'school',              10, 13, TRUE),
    ('GRADE_11',             'Grade 11',                 'school',              11, 14, TRUE),
    ('GRADE_12',             'Grade 12',                 'school',              12, 15, TRUE),

    ('COLLEGE_UNDERGRAD',    'College / Undergraduate',  'higher_education',   NULL, 16, TRUE),
    ('COLLEGE_POSTGRAD',     'Postgraduate',             'higher_education',   NULL, 17, TRUE),
    ('WORKING_PROFESSIONAL', 'Working Professional',     'professional',       NULL, 18, TRUE),
    ('OTHER_ADULT_LEARNER',  'Other Adult Learner',      'adult',              NULL, 19, TRUE)

ON CONFLICT (code)
DO UPDATE SET
    name         = EXCLUDED.name,
    level_group  = EXCLUDED.level_group,
    grade_number = EXCLUDED.grade_number,
    sort_order   = EXCLUDED.sort_order,
    is_active    = EXCLUDED.is_active,
    updated_at   = NOW();


-- ------------------------------------------------------------
-- 2. COURSE <-> ACADEMIC LEVEL MAPPING
-- IMPORTANT: course_id is UUID because public.courses.id is UUID.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.course_academic_levels (
    course_id UUID NOT NULL
        REFERENCES public.courses(id)
        ON DELETE CASCADE,

    academic_level_id BIGINT NOT NULL
        REFERENCES public.academic_levels(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (course_id, academic_level_id)
);

CREATE INDEX IF NOT EXISTS idx_course_academic_levels_course
    ON public.course_academic_levels(course_id);

CREATE INDEX IF NOT EXISTS idx_course_academic_levels_level
    ON public.course_academic_levels(academic_level_id);


-- ------------------------------------------------------------
-- 3. MAP ALL EXISTING SCHOOL-GRADE COURSES AUTOMATICALLY
--
-- Example:
--   course grade_from=5, grade_to=8
--   -> Grade 5, Grade 6, Grade 7, Grade 8
--
-- This maps your current QA Robotics Foundations course correctly.
-- ------------------------------------------------------------

INSERT INTO public.course_academic_levels
    (course_id, academic_level_id)
SELECT
    c.id,
    a.id
FROM public.courses c
JOIN public.academic_levels a
    ON a.grade_number BETWEEN c.grade_from AND c.grade_to
WHERE
    a.grade_number IS NOT NULL
    AND a.is_active = TRUE
    AND c.grade_from IS NOT NULL
    AND c.grade_to IS NOT NULL
    AND c.grade_from BETWEEN 1 AND 12
    AND c.grade_to BETWEEN 1 AND 12
    AND c.grade_from <= c.grade_to
ON CONFLICT (course_id, academic_level_id) DO NOTHING;


COMMIT;


-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- A. Verify academic levels
SELECT
    id,
    code,
    name,
    level_group,
    grade_number,
    sort_order,
    is_active
FROM public.academic_levels
ORDER BY sort_order;


-- B. Verify course mappings
SELECT
    c.code AS course_code,
    c.title AS course_title,
    c.grade_from,
    c.grade_to,
    a.code AS academic_level_code,
    a.name AS academic_level
FROM public.course_academic_levels cal
JOIN public.courses c
    ON c.id = cal.course_id
JOIN public.academic_levels a
    ON a.id = cal.academic_level_id
ORDER BY
    c.title,
    a.sort_order;


-- C. Expected for your current QA course:
-- QA-RF-01 | QA Robotics Foundations
-- Grade 5
-- Grade 6
-- Grade 7
-- Grade 8
-- ============================================================


-- ============================================================================
-- PRODUCTION COURSE CATALOGUE
-- ============================================================================

-- ============================================================
-- ROBOTRONIX™ PRODUCTION COURSE CATALOGUE - V3
-- File: 08_production_course_catalogue_v3.sql
--
-- JSON-based seed version.
-- This avoids the large multi-row VALUES parsing issue seen in V1/V2.
--
-- IMPORTANT OPERATIONAL DEFAULTS
-- The public catalogue does not define these database-specific values:
--   total_sessions              = 24
--   session_duration            = 60 minutes
--   planned_hours               = 24
--   delivery_modes              = ['online']
--   assessment_pattern          = Project-based continuous assessment
--   practice_missions           = true
--   certificate                 = true
--   status                      = active
--   default_cohort_capacity     = 6
--   minimum_cohort_size         = 1
--
-- Existing QA/test courses are NOT deleted.
-- ============================================================

BEGIN;

WITH course_payload AS (
    SELECT *
    FROM jsonb_to_recordset($robotronix_catalogue$
[{"code":"RTX-SCRATCH","slug":"scratch-coding","title":"Scratch Coding","short_title":"Scratch Coding","category":"Coding & Programming","grade_from":3,"grade_to":6,"age_from":8,"age_to":12,"level":"Beginner","coding_type":"block","technologies":["Scratch 3.0","Block Coding"],"description":"Create games and animations while building strong coding logic.","outcomes":["Use events, sequences, loops and conditions confidently","Test, debug and improve interactive projects","Plan and explain an original Scratch creation"],"projects":["Games","Interactive stories","Animations","Puzzles"],"outcome_subtitle":"Build coding logic through games, stories and animation"},{"code":"RTX-MOBILE-APP","slug":"mobile-app-development","title":"Mobile App Development","short_title":"Mobile App Development","category":"Apps, Web & Digital Design","grade_from":4,"grade_to":8,"age_from":9,"age_to":14,"level":"Beginner to Intermediate","coding_type":"block","technologies":["MIT App Inventor","Block Coding"],"description":"Design useful mobile apps while learning interface thinking, coding logic and device interaction.","outcomes":["Design clear multi-screen app interfaces","Apply block-code logic to app behaviour","Build and test useful mobile applications"],"projects":["Quiz app","Utility app"],"outcome_subtitle":"Turn ideas into working mobile applications"},{"code":"RTX-3D-DESIGN","slug":"3d-design-modelling","title":"3D Design & Modelling","short_title":"3D Design","category":"Apps, Web & Digital Design","grade_from":5,"grade_to":12,"age_from":10,"age_to":18,"level":"Beginner to Intermediate","coding_type":"design","technologies":["Tinkercad","Onshape"],"description":"Move from sketches to accurate digital models and printable prototypes.","outcomes":["Develop spatial and product-design thinking","Create accurate digital 3D models","Prepare designs for prototyping and 3D printing"],"projects":["Product models","Mechanical parts"],"outcome_subtitle":"Design accurate digital models and printable prototypes"},{"code":"RTX-AI-CREATORS","slug":"ai-creators","title":"AI Creators","short_title":"AI Creators","category":"AI & Future Skills","grade_from":6,"grade_to":9,"age_from":11,"age_to":15,"level":"Beginner to Intermediate","coding_type":"ai","technologies":["Generative AI","Canva"],"description":"Turn ideas into polished digital creations with AI while learning to verify and improve outputs.","outcomes":["Prompt, iterate and improve creative AI output","Evaluate AI output instead of accepting it blindly","Use AI tools to create polished digital work"],"projects":["AI visual story","Presentation / school project"],"outcome_subtitle":"Create, verify and improve useful AI-assisted work"},{"code":"RTX-WEB","slug":"web-design-development","title":"Web Design & Development","short_title":"Web Development","category":"Apps, Web & Digital Design","grade_from":5,"grade_to":12,"age_from":10,"age_to":18,"level":"Beginner to Intermediate","coding_type":"text","technologies":["HTML","CSS"],"description":"Design and code responsive websites from the ground up.","outcomes":["Structure pages with HTML and CSS","Create clear and responsive layouts","Build and present complete web pages"],"projects":["Personal website","Landing page"],"outcome_subtitle":"Build responsive websites from the ground up"},{"code":"RTX-PYTHON","slug":"python-programming","title":"Python Programming","short_title":"Python","category":"Coding & Programming","grade_from":6,"grade_to":12,"age_from":11,"age_to":18,"level":"Beginner to Advanced","coding_type":"text","technologies":["Python","Thonny"],"description":"Grow from first Python programs to structured real-world applications in one continuous pathway.","outcomes":["Use conditions, loops, functions and data structures confidently","Write structured Python programs","Build and debug practical applications"],"projects":["Games","Real-world GUI applications"],"outcome_subtitle":"Progress from coding foundations to structured applications"},{"code":"RTX-BLOCK-ROBOTICS","slug":"block-coding-robotics","title":"Block Coding & Robotics","short_title":"Block Robotics","category":"Robotics & Smart Systems","grade_from":4,"grade_to":5,"age_from":9,"age_to":11,"level":"Beginner","coding_type":"block","technologies":["Quarky","PictoBlox"],"description":"Code, build and control a real robot using Quarky, PictoBlox and block programming.","outcomes":["Connect block-code logic with physical inputs, outputs and movement","Use sensors in simple autonomous behaviours","Build and debug hands-on robotics projects"],"projects":["Line follower robot","Obstacle avoidance robot"],"outcome_subtitle":"Connect visual coding with real robotic movement and sensors"},{"code":"RTX-ARDUINO","slug":"arduino-robotics","title":"Arduino Robotics","short_title":"Arduino Robotics","category":"Robotics & Smart Systems","grade_from":5,"grade_to":12,"age_from":10,"age_to":18,"level":"Beginner to Advanced","coding_type":"text","technologies":["Arduino UNO","Sensors"],"description":"Make code interact with the physical world through electronics and sensors.","outcomes":["Wire and program common electronic components","Read sensors and control outputs","Build and troubleshoot physical-computing projects"],"projects":["Traffic light","Sensor alarm"],"outcome_subtitle":"Build electronics and sensor projects that respond to the real world"},{"code":"RTX-ESP32-IOT","slug":"iot-smart-systems-esp32","title":"IoT & Smart Systems with ESP32","short_title":"ESP32 IoT","category":"Robotics & Smart Systems","grade_from":8,"grade_to":12,"age_from":13,"age_to":18,"level":"Intermediate","coding_type":"text","technologies":["ESP32","C++"],"description":"Connect sensors and devices to build smart, internet-enabled systems.","outcomes":["Program ESP32 inputs, outputs and Wi-Fi features","Connect sensors to networked applications","Build reliable connected-device prototypes"],"projects":["Smart monitor","Connected control"],"outcome_subtitle":"Build connected systems using sensors, devices and Wi-Fi"},{"code":"RTX-FULLSTACK","slug":"full-stack-development","title":"Full-Stack Development","short_title":"Full-Stack","category":"Apps, Web & Digital Design","grade_from":8,"grade_to":12,"age_from":13,"age_to":18,"level":"Intermediate to Advanced","coding_type":"text","technologies":["JavaScript","Node.js","Express"],"description":"Connect front end, back end, APIs and data into complete web applications.","outcomes":["Build server-side routes and APIs with Node.js and Express","Connect front-end interfaces to back-end services","Develop complete web applications"],"projects":["Full-stack web app","REST API"],"outcome_subtitle":"Connect front end, back end, APIs and data"},{"code":"RTX-SQL","slug":"database-design-sql","title":"Database Design & SQL","short_title":"Database & SQL","category":"Data & Analytics","grade_from":8,"grade_to":12,"age_from":13,"age_to":18,"level":"Intermediate","coding_type":"text","technologies":["SQL","MySQL"],"description":"Learn how structured data is stored, related and queried.","outcomes":["Design tables and understand relationships","Write practical SQL queries","Model structured data for real applications"],"projects":["Student database","Query challenges"],"outcome_subtitle":"Design relational data and query it confidently"},{"code":"RTX-DATA-ANALYTICS","slug":"data-analytics","title":"Data Analytics","short_title":"Data Analytics","category":"Data & Analytics","grade_from":8,"grade_to":12,"age_from":13,"age_to":18,"level":"Intermediate","coding_type":"data","technologies":["Excel","SQL"],"description":"Turn raw data into clear dashboards, trends and decisions.","outcomes":["Clean and analyse structured datasets","Use spreadsheets and SQL to answer data questions","Communicate findings clearly"],"projects":["Excel analysis","SQL report"],"outcome_subtitle":"Turn raw data into useful trends, reports and decisions"},{"code":"RTX-DATA-SCIENCE","slug":"data-science-python","title":"Data Science with Python","short_title":"Data Science","category":"Data & Analytics","grade_from":8,"grade_to":12,"age_from":13,"age_to":18,"level":"Intermediate","coding_type":"data","technologies":["Python","Pandas"],"description":"Use Python to explore data, spot patterns and build analytical thinking.","outcomes":["Work with Pandas and visualisation tools","Explore and clean datasets with Python","Interpret patterns and trends in data"],"projects":["Data exploration","Trend analysis"],"outcome_subtitle":"Explore data and discover patterns with Python"},{"code":"RTX-JAVA","slug":"java-programming-oop","title":"Java Programming & OOP","short_title":"Java & OOP","category":"Coding & Programming","grade_from":8,"grade_to":12,"age_from":13,"age_to":18,"level":"Intermediate","coding_type":"text","technologies":["Java","OOP"],"description":"Think in objects and build structured Java applications.","outcomes":["Model problems using classes and objects","Apply encapsulation, inheritance and polymorphism","Build structured Java applications"],"projects":["Student system","Banking model"],"outcome_subtitle":"Build structured applications using object-oriented thinking"},{"code":"RTX-DSA","slug":"data-structures-algorithms","title":"Data Structures & Algorithms","short_title":"DSA","category":"Academic & Advanced CS","grade_from":9,"grade_to":12,"age_from":14,"age_to":18,"level":"Advanced","coding_type":"text","technologies":["Python","Java","Algorithms"],"description":"Learn to choose better structures and design more efficient solutions.","outcomes":["Select appropriate data structures for common problems","Analyse and improve algorithmic solutions","Implement searching, sorting and core structures"],"projects":["Algorithm visualiser","Search and sort challenges"],"outcome_subtitle":"Choose better structures and design more efficient solutions"},{"code":"RTX-RPI-PYTHON","slug":"raspberry-pi-python","title":"Raspberry Pi & Python","short_title":"Raspberry Pi","category":"Robotics & Smart Systems","grade_from":8,"grade_to":12,"age_from":13,"age_to":18,"level":"Intermediate","coding_type":"text","technologies":["Raspberry Pi","Python","GPIO"],"description":"Combine Python, Linux and hardware to build richer physical-computing systems.","outcomes":["Control sensors and outputs using Python and GPIO","Use Linux and Python in physical-computing projects","Build integrated hardware-software prototypes"],"projects":["Weather station","Camera project"],"outcome_subtitle":"Combine Python, Linux and hardware in physical-computing systems"},{"code":"RTX-AI-ROBOTICS","slug":"ai-robotics-computer-vision","title":"AI Robotics & Computer Vision","short_title":"AI Robotics","category":"Robotics & Smart Systems","grade_from":9,"grade_to":12,"age_from":14,"age_to":18,"level":"Advanced","coding_type":"text","technologies":["Python","OpenCV"],"description":"Give robotics projects the ability to see, recognise patterns and respond intelligently.","outcomes":["Process camera input with introductory computer-vision techniques","Use visual information to trigger intelligent responses","Build and test vision-enabled prototypes"],"projects":["Vision-triggered system","Object-tracking prototype"],"outcome_subtitle":"Make robotics projects see, recognise and respond"},{"code":"RTX-GENAI-AUTO","slug":"generative-ai-automation","title":"Generative AI & Automation","short_title":"GenAI & Automation","category":"AI & Future Skills","grade_from":9,"grade_to":12,"age_from":14,"age_to":18,"level":"Advanced","coding_type":"ai","technologies":["Generative AI","Python"],"description":"Go beyond prompting to design connected AI workflows and automations.","outcomes":["Connect multiple AI steps into structured workflows","Evaluate and improve automated AI outputs","Design useful AI-assisted processes"],"projects":["Research workflow","Content pipeline"],"outcome_subtitle":"Design connected AI workflows and useful automations"},{"code":"RTX-CS-IP-1112","slug":"class-11-12-cs-ip","title":"Class 11–12 CS & IP","short_title":"Class 11–12 CS/IP","category":"Academic & Advanced CS","grade_from":11,"grade_to":12,"age_from":16,"age_to":18,"level":"Senior Secondary","coding_type":"text","technologies":["Python","SQL"],"description":"Strengthen senior-secondary concepts with focused Python, SQL and practical preparation.","outcomes":["Improve conceptual clarity and coding accuracy","Practise Python and SQL problem solving","Prepare confidently for practical and academic requirements"],"projects":["Python practicals","SQL queries"],"outcome_subtitle":"Strengthen Python, SQL and senior-secondary practical skills"},{"code":"RTX-AP-CSA","slug":"ap-computer-science-a-java","title":"AP Computer Science A – Java","short_title":"AP CSA – Java","category":"Academic & Advanced CS","grade_from":9,"grade_to":12,"age_from":14,"age_to":18,"level":"Advanced","coding_type":"text","technologies":["Java","AP CSA"],"description":"Build AP Computer Science A confidence through Java, algorithms and problem solving.","outcomes":["Apply core Java and object-oriented concepts","Solve algorithmic problems using Java","Build confidence with AP CSA-style programming"],"projects":["Java classes","Algorithm practice"],"outcome_subtitle":"Build AP CSA confidence through Java and problem solving"}]
$robotronix_catalogue$::jsonb)
    AS x(
        code text,
        slug text,
        title text,
        short_title text,
        category text,
        grade_from integer,
        grade_to integer,
        age_from integer,
        age_to integer,
        level text,
        coding_type text,
        technologies jsonb,
        description text,
        outcomes jsonb,
        projects jsonb,
        outcome_subtitle text
    )
)
INSERT INTO public.courses (
    id,
    slug,
    title,
    short_title,
    code,
    category,
    grade_from,
    grade_to,
    age_from,
    age_to,
    level,
    total_sessions,
    session_duration,
    planned_hours,
    delivery_modes,
    coding_type,
    technologies,
    description,
    outcomes,
    projects,
    assessment_pattern,
    practice_missions,
    certificate,
    status,
    created_at,
    updated_at,
    public_name,
    internal_name,
    outcome_subtitle,
    default_cohort_capacity,
    minimum_cohort_size
)
SELECT
    gen_random_uuid(),
    p.slug,
    p.title,
    p.short_title,
    p.code,
    p.category,
    p.grade_from,
    p.grade_to,
    p.age_from,
    p.age_to,
    p.level,
    24,
    60,
    24,
    ARRAY['online']::text[],
    p.coding_type,
    ARRAY(SELECT jsonb_array_elements_text(p.technologies)),
    p.description,
    ARRAY(SELECT jsonb_array_elements_text(p.outcomes)),
    ARRAY(SELECT jsonb_array_elements_text(p.projects)),
    'Project-based continuous assessment',
    TRUE,
    TRUE,
    'active',
    NOW(),
    NOW(),
    p.title,
    p.title,
    p.outcome_subtitle,
    6,
    1
FROM course_payload p

ON CONFLICT (code)
DO UPDATE SET
    slug                    = EXCLUDED.slug,
    title                   = EXCLUDED.title,
    short_title             = EXCLUDED.short_title,
    category                = EXCLUDED.category,
    grade_from              = EXCLUDED.grade_from,
    grade_to                = EXCLUDED.grade_to,
    age_from                = EXCLUDED.age_from,
    age_to                  = EXCLUDED.age_to,
    level                   = EXCLUDED.level,
    total_sessions          = EXCLUDED.total_sessions,
    session_duration        = EXCLUDED.session_duration,
    planned_hours           = EXCLUDED.planned_hours,
    delivery_modes          = EXCLUDED.delivery_modes,
    coding_type             = EXCLUDED.coding_type,
    technologies            = EXCLUDED.technologies,
    description             = EXCLUDED.description,
    outcomes                = EXCLUDED.outcomes,
    projects                = EXCLUDED.projects,
    assessment_pattern      = EXCLUDED.assessment_pattern,
    practice_missions       = EXCLUDED.practice_missions,
    certificate             = EXCLUDED.certificate,
    status                  = EXCLUDED.status,
    updated_at              = NOW(),
    public_name             = EXCLUDED.public_name,
    internal_name           = EXCLUDED.internal_name,
    outcome_subtitle        = EXCLUDED.outcome_subtitle,
    default_cohort_capacity = EXCLUDED.default_cohort_capacity,
    minimum_cohort_size     = EXCLUDED.minimum_cohort_size;


-- Remove stale SCHOOL-GRADE mappings for Robotronix production courses.
DELETE FROM public.course_academic_levels cal
USING public.courses c, public.academic_levels a
WHERE cal.course_id = c.id
  AND cal.academic_level_id = a.id
  AND c.code LIKE 'RTX-%'
  AND a.grade_number IS NOT NULL
  AND NOT (a.grade_number BETWEEN c.grade_from AND c.grade_to);


-- Add the correct school-grade mappings.
INSERT INTO public.course_academic_levels
    (course_id, academic_level_id)
SELECT
    c.id,
    a.id
FROM public.courses c
JOIN public.academic_levels a
    ON a.grade_number BETWEEN c.grade_from AND c.grade_to
WHERE c.code LIKE 'RTX-%'
  AND a.grade_number IS NOT NULL
  AND a.is_active = TRUE
ON CONFLICT (course_id, academic_level_id) DO NOTHING;

COMMIT;


-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT
    code,
    title,
    category,
    grade_from,
    grade_to,
    total_sessions,
    session_duration,
    planned_hours,
    delivery_modes,
    status
FROM public.courses
WHERE code LIKE 'RTX-%'
ORDER BY category, title;


SELECT
    COUNT(*) AS robotronix_production_course_count
FROM public.courses
WHERE code LIKE 'RTX-%';


SELECT
    c.code,
    c.title,
    a.name AS academic_level
FROM public.course_academic_levels cal
JOIN public.courses c
    ON c.id = cal.course_id
JOIN public.academic_levels a
    ON a.id = cal.academic_level_id
WHERE c.code LIKE 'RTX-%'
ORDER BY c.title, a.sort_order;


-- Existing QA/test courses remain untouched.
-- Remove QA data separately during the production-reset step.
-- ============================================================
