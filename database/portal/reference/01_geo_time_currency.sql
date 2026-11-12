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

