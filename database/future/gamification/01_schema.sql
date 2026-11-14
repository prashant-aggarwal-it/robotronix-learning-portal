-- FUTURE MODULE GAMIFICATION — BASE CANONICAL DDL
-- FUTURE DESIGN ONLY. Never run in active Release 1 installer.
-- Dependencies documented in database/future/manifest.json.
CREATE SCHEMA IF NOT EXISTS gamification;
REVOKE ALL ON SCHEMA gamification FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA gamification TO service_role;
CREATE TABLE gamification.award_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
 points integer NOT NULL, enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE gamification.xp_awards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL REFERENCES public.students(id),
 award_rule_id uuid NOT NULL REFERENCES gamification.award_rules(id),
 source_event_id uuid NOT NULL UNIQUE, awarded_at timestamptz NOT NULL DEFAULT now(),
 legacy_xp_transaction_id uuid UNIQUE REFERENCES public.xp_transactions(id)
);

CREATE TABLE gamification.badges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, title text NOT NULL
);

CREATE TABLE gamification.badge_awards (
 student_id uuid NOT NULL REFERENCES public.students(id),
 badge_id uuid NOT NULL REFERENCES gamification.badges(id),
 awarded_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(student_id,badge_id)
);

CREATE TABLE gamification.streak_state (
 student_id uuid PRIMARY KEY REFERENCES public.students(id), streak_days integer NOT NULL DEFAULT 0,
 last_qualified_date date
);

-- DENY BY DEFAULT: no anon/authenticated table grants.
ALTER TABLE gamification.award_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE gamification.award_rules FROM PUBLIC, anon, authenticated;
ALTER TABLE gamification.xp_awards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE gamification.xp_awards FROM PUBLIC, anon, authenticated;
ALTER TABLE gamification.badges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE gamification.badges FROM PUBLIC, anon, authenticated;
ALTER TABLE gamification.badge_awards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE gamification.badge_awards FROM PUBLIC, anon, authenticated;
ALTER TABLE gamification.streak_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE gamification.streak_state FROM PUBLIC, anon, authenticated;
