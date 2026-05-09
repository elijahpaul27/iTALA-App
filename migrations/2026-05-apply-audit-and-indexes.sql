PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grade_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grade_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,
  user_id INTEGER,
  old_value REAL,
  new_value REAL,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(grade_id) REFERENCES Grades(id) ON DELETE CASCADE,
  FOREIGN KEY(student_id) REFERENCES Students(id) ON DELETE CASCADE,
  FOREIGN KEY(class_id) REFERENCES Classes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_grades_class_quarter ON Grades(student_id, assessment_id);
CREATE INDEX IF NOT EXISTS idx_grades_student ON Grades(student_id);
CREATE INDEX IF NOT EXISTS idx_assessments_class ON Assessments(subject_id);
CREATE INDEX IF NOT EXISTS idx_assessments_subject_quarter_type ON Assessments(subject_id, quarter, type);
CREATE INDEX IF NOT EXISTS idx_grade_audit_grade_id ON grade_audit(grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_audit_class_created ON grade_audit(class_id, created_at);
