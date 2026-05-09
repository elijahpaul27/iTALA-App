PRAGMA foreign_keys = ON;

-- SQLite does not support ALTER TABLE ADD COLUMN IF NOT EXISTS.
-- The Electron startup migrator adds the missing SF10 columns after checking
-- PRAGMA table_info, then records this SQL file in schema_migrations.
CREATE INDEX IF NOT EXISTS idx_students_class_id ON Students(class_id);
CREATE INDEX IF NOT EXISTS idx_history_student_year_grade ON Academic_Records_History(student_id, school_year, grade_level);
