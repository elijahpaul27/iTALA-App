PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  school_name TEXT NOT NULL,
  school_id TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL,
  grade_level TEXT NOT NULL,
  section TEXT NOT NULL,
  school_year TEXT NOT NULL,
  curriculum TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES Teachers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  lrn TEXT NOT NULL CHECK (lrn GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  name_extn TEXT,
  sex TEXT NOT NULL CHECK (sex IN ('M', 'F')),
  birthdate TEXT NOT NULL,
  eligibility_credential TEXT,
  eligibility_school_name TEXT,
  eligibility_school_id TEXT,
  eligibility_school_address TEXT,
  pept_rating REAL CHECK (pept_rating IS NULL OR (pept_rating BETWEEN 0 AND 100)),
  pept_date TEXT,
  als_rating REAL CHECK (als_rating IS NULL OR (als_rating BETWEEN 0 AND 100)),
  testing_center TEXT,
  other_credential TEXT,
  eligibility_remarks TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES Classes(id) ON DELETE CASCADE,
  UNIQUE (class_id, lrn)
);

CREATE TABLE IF NOT EXISTS Subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  written_work_weight REAL NOT NULL CHECK (written_work_weight >= 0),
  perf_task_weight REAL NOT NULL CHECK (perf_task_weight >= 0),
  quarterly_weight REAL NOT NULL CHECK (quarterly_weight >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES Classes(id) ON DELETE CASCADE,
  UNIQUE (class_id, name),
  CHECK (ROUND(written_work_weight + perf_task_weight + quarterly_weight, 4) = 1.0)
);

CREATE TABLE IF NOT EXISTS Assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  type TEXT NOT NULL CHECK (type IN ('WW', 'PT', 'QA')),
  max_score REAL NOT NULL CHECK (max_score > 0),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES Subjects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  assessment_id INTEGER NOT NULL,
  raw_score REAL NOT NULL CHECK (raw_score >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE,
  FOREIGN KEY (assessment_id) REFERENCES Assessments(id) ON DELETE CASCADE,
  UNIQUE (student_id, assessment_id)
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
  FOREIGN KEY (grade_id) REFERENCES Grades(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES Classes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Attendance_Logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Tardy')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE,
  UNIQUE (student_id, date)
);

CREATE TABLE IF NOT EXISTS Academic_Records_History (
  student_id INTEGER NOT NULL,
  school_year TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  section TEXT NOT NULL,
  adviser TEXT,
  school_name TEXT,
  school_id TEXT,
  final_rating REAL NOT NULL CHECK (final_rating BETWEEN 0 AND 100),
  action_taken TEXT NOT NULL,
  subject_details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, school_year, grade_level),
  FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON Classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON Students(class_id);
CREATE INDEX IF NOT EXISTS idx_subjects_class_id ON Subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_assessments_subject_quarter ON Assessments(subject_id, quarter);
CREATE INDEX IF NOT EXISTS idx_assessments_subject_quarter_type ON Assessments(subject_id, quarter, type);
CREATE INDEX IF NOT EXISTS idx_assessments_class ON Assessments(subject_id);
CREATE INDEX IF NOT EXISTS idx_grades_student_assessment ON Grades(student_id, assessment_id);
CREATE INDEX IF NOT EXISTS idx_grades_student ON Grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_class_quarter ON Grades(student_id, assessment_id);
CREATE INDEX IF NOT EXISTS idx_grade_audit_grade_id ON grade_audit(grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_audit_class_created ON grade_audit(class_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON Attendance_Logs(student_id, date);

CREATE VIEW IF NOT EXISTS v_quarterly_grade_summary AS
WITH assessment_totals AS (
  SELECT
    st.id AS student_id,
    st.class_id,
    st.lrn,
    st.last_name,
    st.first_name,
    st.middle_name,
    st.sex,
    subj.id AS subject_id,
    subj.name AS subject_name,
    subj.written_work_weight,
    subj.perf_task_weight,
    subj.quarterly_weight,
    a.quarter,
    a.type,
    SUM(COALESCE(g.raw_score, 0)) AS raw_score_total,
    SUM(a.max_score) AS max_score_total
  FROM Students st
  JOIN Subjects subj ON subj.class_id = st.class_id
  JOIN Assessments a ON a.subject_id = subj.id
  LEFT JOIN Grades g ON g.student_id = st.id AND g.assessment_id = a.id
  GROUP BY
    st.id,
    subj.id,
    a.quarter,
    a.type
),
component_scores AS (
  SELECT
    student_id,
    class_id,
    lrn,
    last_name,
    first_name,
    middle_name,
    sex,
    subject_id,
    subject_name,
    quarter,
    SUM(CASE WHEN type = 'WW' THEN raw_score_total ELSE 0 END) AS written_raw_score,
    SUM(CASE WHEN type = 'WW' THEN max_score_total ELSE 0 END) AS written_max_score,
    SUM(CASE WHEN type = 'WW' AND max_score_total > 0 THEN (raw_score_total / max_score_total) * 100.0 * written_work_weight ELSE 0 END) AS written_weighted_score,
    SUM(CASE WHEN type = 'PT' THEN raw_score_total ELSE 0 END) AS perf_raw_score,
    SUM(CASE WHEN type = 'PT' THEN max_score_total ELSE 0 END) AS perf_max_score,
    SUM(CASE WHEN type = 'PT' AND max_score_total > 0 THEN (raw_score_total / max_score_total) * 100.0 * perf_task_weight ELSE 0 END) AS perf_weighted_score,
    SUM(CASE WHEN type = 'QA' THEN raw_score_total ELSE 0 END) AS quarterly_raw_score,
    SUM(CASE WHEN type = 'QA' THEN max_score_total ELSE 0 END) AS quarterly_max_score,
    SUM(CASE WHEN type = 'QA' AND max_score_total > 0 THEN (raw_score_total / max_score_total) * 100.0 * quarterly_weight ELSE 0 END) AS quarterly_weighted_score
  FROM assessment_totals
  GROUP BY
    student_id,
    subject_id,
    quarter
),
initial_grades AS (
  SELECT
    *,
    written_weighted_score + perf_weighted_score + quarterly_weighted_score AS initial_grade_raw,
    ROUND(written_weighted_score + perf_weighted_score + quarterly_weighted_score, 2) AS initial_grade
  FROM component_scores
)
SELECT
  student_id,
  class_id,
  lrn,
  last_name,
  first_name,
  middle_name,
  sex,
  subject_id,
  subject_name,
  quarter,
  ROUND(CASE WHEN written_max_score > 0 THEN (written_raw_score / written_max_score) * 100.0 ELSE 0 END, 2) AS written_percentage_score,
  ROUND(written_weighted_score, 2) AS written_weighted_score,
  ROUND(CASE WHEN perf_max_score > 0 THEN (perf_raw_score / perf_max_score) * 100.0 ELSE 0 END, 2) AS perf_percentage_score,
  ROUND(perf_weighted_score, 2) AS perf_weighted_score,
  ROUND(CASE WHEN quarterly_max_score > 0 THEN (quarterly_raw_score / quarterly_max_score) * 100.0 ELSE 0 END, 2) AS quarterly_percentage_score,
  ROUND(quarterly_weighted_score, 2) AS quarterly_weighted_score,
  ROUND(initial_grade_raw, 3) AS initial_grade_raw,
  initial_grade,
  ROUND(CASE
    WHEN initial_grade_raw >= 60 THEN MIN(100.0, ((initial_grade_raw - 60.0) / 1.6) + 75.0)
    ELSE MAX(60.0, (initial_grade_raw / 4.0) + 60.0)
  END, 3) AS transmuted_grade_decimal,
  CASE
    WHEN initial_grade >= 60 THEN MIN(100, CAST(((initial_grade - 60.0) / 1.6) AS INTEGER) + 75)
    ELSE MAX(60, CAST((initial_grade / 4.0) AS INTEGER) + 60)
  END AS transmuted_grade
FROM initial_grades;
