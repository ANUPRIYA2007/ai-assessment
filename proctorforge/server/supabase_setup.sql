-- ================================================
-- ProctorForge AI - Supabase Database Setup
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- 1. USERS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'student',    -- student, teacher, admin
    status VARCHAR(20) NOT NULL DEFAULT 'active',   -- active, suspended, locked
    created_at TIMESTAMP DEFAULT NOW(),
    -- Student-specific fields
    gender VARCHAR(20),
    class_name VARCHAR(100),
    year VARCHAR(20),
    section VARCHAR(20),
    register_number VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ================================================
-- 2. EXAMS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    type VARCHAR(20) NOT NULL DEFAULT 'mcq',        -- mcq, coding
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',    -- draft, published, active, completed
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    -- Class-based assignment
    assigned_class VARCHAR(100),
    assigned_year VARCHAR(20),
    assigned_section VARCHAR(20)
);

-- ================================================
-- 3. EXAM ASSIGNMENTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS exam_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES exams(id),
    student_id UUID NOT NULL REFERENCES users(id),
    assigned_by UUID NOT NULL REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'   -- pending, started, completed
);

CREATE INDEX IF NOT EXISTS idx_exam_assignments_exam ON exam_assignments(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_assignments_student ON exam_assignments(student_id);

-- ================================================
-- 4. QUESTIONS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES exams(id),
    type VARCHAR(20) NOT NULL DEFAULT 'mcq',        -- mcq, coding
    language VARCHAR(20),                            -- python, java, cpp, javascript
    question_text TEXT NOT NULL,
    options JSONB,                                   -- MCQ: [{"label":"A","text":"..."},...]
    correct_answer TEXT,                             -- MCQ answer
    test_cases JSONB,                                -- Coding: [{"input":"...","expected_output":"..."}]
    points INTEGER NOT NULL DEFAULT 10,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);

-- ================================================
-- 5. ATTEMPTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    exam_id UUID NOT NULL REFERENCES exams(id),
    start_time TIMESTAMP DEFAULT NOW(),
    end_time TIMESTAMP,
    trust_score FLOAT NOT NULL DEFAULT 100.0,
    risk_level VARCHAR(20) NOT NULL DEFAULT 'low',   -- low, medium, high, critical
    status VARCHAR(20) NOT NULL DEFAULT 'active',    -- active, paused, completed, terminated
    device_fingerprint TEXT,
    browser_info JSONB
);

CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_exam ON attempts(exam_id);

-- ================================================
-- 6. CODE SUBMISSIONS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS code_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES attempts(id),
    question_id UUID NOT NULL REFERENCES questions(id),
    language VARCHAR(20) NOT NULL,
    code TEXT NOT NULL,
    test_results JSONB,
    score FLOAT,
    submitted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_code_submissions_attempt ON code_submissions(attempt_id);

-- ================================================
-- 7. LIVE CODE LOGS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS live_code_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES attempts(id),
    question_id UUID REFERENCES questions(id),
    code_snapshot TEXT NOT NULL,
    event_type VARCHAR(20) NOT NULL DEFAULT 'autosave',  -- autosave, paste, submit
    "timestamp" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_code_logs_attempt ON live_code_logs(attempt_id);

-- ================================================
-- 8. TYPING METRICS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS typing_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES attempts(id),
    wpm FLOAT,
    backspace_ratio FLOAT,
    paste_size INTEGER,
    idle_time FLOAT,
    entropy_score FLOAT,
    burst_detected VARCHAR(10) DEFAULT 'false',
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_typing_metrics_attempt ON typing_metrics(attempt_id);

-- ================================================
-- 9. EVENTS TABLE (Security/Behavioral Events)
-- ================================================
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES attempts(id),
    event_type VARCHAR(50) NOT NULL,                 -- tab_switch, devtools, paste, gaze_deviation, etc.
    event_data JSONB,
    confidence_score FLOAT,
    hmac_signature TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_attempt ON events(attempt_id);

-- ================================================
-- 10. AI INTERVENTIONS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS ai_interventions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES attempts(id),
    trigger_event VARCHAR(50) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    intervention_text TEXT,
    challenge_prompt TEXT,
    response_text TEXT,
    outcome VARCHAR(20),                             -- passed, failed, pending
    trust_adjustment FLOAT,
    reasoning_trace JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_interventions_attempt ON ai_interventions(attempt_id);

-- ================================================
-- 11. AUDIT REPORTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS audit_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES attempts(id),
    summary TEXT,
    timeline JSONB,                                  -- Chronological event list
    risk_breakdown JSONB,                            -- Per-dimension scores
    final_trust_score FLOAT,
    ai_reasoning JSONB,
    generated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_reports_attempt ON audit_reports(attempt_id);

-- ================================================
-- ENABLE SUPABASE REALTIME
-- This enables live updates for monitoring dashboards
-- ================================================
ALTER PUBLICATION supabase_realtime ADD TABLE attempts;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_interventions;
ALTER PUBLICATION supabase_realtime ADD TABLE typing_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE live_code_logs;

-- ================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Required for Supabase - tables are locked by default
-- ================================================

-- Disable RLS for server-side access (our backend uses service role)
-- If you want RLS, enable it and add policies per table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_code_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;

-- Allow our backend (service_role) full access to all tables
-- The backend authenticates via JWT, not Supabase RLS
CREATE POLICY "Service role full access" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON exams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON exam_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON attempts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON code_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON live_code_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON typing_metrics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON ai_interventions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON audit_reports FOR ALL USING (true) WITH CHECK (true);

-- ================================================
-- DONE! All tables created with Realtime enabled.
-- ================================================
SELECT 'ProctorForge AI database setup complete! 🚀' AS status;
