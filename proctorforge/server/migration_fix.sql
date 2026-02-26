-- ================================================
-- ProctorForge AI - Database Migration Fix
-- 
-- PASTE THIS ENTIRE SCRIPT in Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → Paste → Run)
--
-- This adds missing columns to users and exams tables
-- and activates any draft exams so students can see them.
-- Safe to run multiple times (uses IF NOT EXISTS).
-- ================================================

-- ============================
-- 1. ADD MISSING USER COLUMNS
-- ============================
DO $$
BEGIN
    -- gender
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='gender') THEN
        ALTER TABLE users ADD COLUMN gender VARCHAR(20);
    END IF;

    -- class_name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='class_name') THEN
        ALTER TABLE users ADD COLUMN class_name VARCHAR(100);
    END IF;

    -- year
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='year') THEN
        ALTER TABLE users ADD COLUMN year VARCHAR(20);
    END IF;

    -- section
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='section') THEN
        ALTER TABLE users ADD COLUMN section VARCHAR(20);
    END IF;

    -- register_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='register_number') THEN
        ALTER TABLE users ADD COLUMN register_number VARCHAR(100);
    END IF;
END $$;

-- ============================
-- 2. ADD MISSING EXAM COLUMNS
-- ============================
DO $$
BEGIN
    -- type (mcq/coding)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exams' AND column_name='type') THEN
        ALTER TABLE exams ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'mcq';
    END IF;

    -- assigned_class
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exams' AND column_name='assigned_class') THEN
        ALTER TABLE exams ADD COLUMN assigned_class VARCHAR(100);
    END IF;

    -- assigned_year
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exams' AND column_name='assigned_year') THEN
        ALTER TABLE exams ADD COLUMN assigned_year VARCHAR(20);
    END IF;

    -- assigned_section
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exams' AND column_name='assigned_section') THEN
        ALTER TABLE exams ADD COLUMN assigned_section VARCHAR(20);
    END IF;
END $$;

-- ============================
-- 3. ACTIVATE ALL DRAFT EXAMS
-- ============================
-- Existing exams stuck in "draft" won't show for students.
-- This sets them all to "active" so students can see them now.
UPDATE exams SET status = 'active' WHERE status = 'draft';

-- ============================
-- 4. VERIFY
-- ============================
SELECT 'Migration complete! ✅' AS status;

-- Show current table structures
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'exams' 
ORDER BY ordinal_position;

-- Show exam count by status
SELECT status, COUNT(*) as count FROM exams GROUP BY status;
