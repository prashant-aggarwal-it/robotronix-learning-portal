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


