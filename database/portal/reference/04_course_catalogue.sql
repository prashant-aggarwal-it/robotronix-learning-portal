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
