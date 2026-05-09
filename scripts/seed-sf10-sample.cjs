const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();

const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const userDataPath = path.join(appData, 'itala');
const dbPath = path.join(userDataPath, 'itala.sqlite3');
const schemaPath = path.join(__dirname, '..', 'src', 'db', 'schema.sql');

const sample = {
  teacher: {
    name: 'SF10 Sample Teacher',
    pin: '1010',
    school_name: 'TR Yangco Elementary School',
    school_id: '136666'
  },
  classRecord: {
    grade_level: 'Grade 4',
    section: 'Sampaguita',
    school_year: '2025-2026',
    curriculum: 'MATATAG'
  },
  student: {
    lrn: '136666400001',
    last_name: 'Dela Cruz',
    first_name: 'Amihan',
    middle_name: 'Reyes',
    name_extn: '',
    sex: 'F',
    birthdate: '2016-08-14',
    eligibility_credential: 'Kinder Progress Report',
    eligibility_school_name: 'Yangco Child Development Center',
    eligibility_school_id: 'CDC-04512',
    eligibility_school_address: 'Barangay Magsaysay, San Antonio, Zambales',
    pept_rating: 91,
    pept_date: '2022-04-12',
    als_rating: 90,
    testing_center: 'Zambales Division Testing Center',
    other_credential: 'ECCD Checklist completed',
    eligibility_remarks: 'Eligible for Grade 1 based on kindergarten completion and supporting assessment records.'
  }
};

const historyRecords = [
  {
    school_year: '2022-2023',
    grade_level: 'Grade 1',
    section: 'Rizal',
    adviser: 'Ma. Lourdes Santos',
    school_name: 'TR Yangco Elementary School',
    school_id: '136666',
    final_rating: 92,
    action_taken: 'PROMOTED',
    subjects: [
      ['Filipino', 90, 91, 92, 93, 92, 'PASSED'],
      ['English', 91, 92, 93, 94, 93, 'PASSED'],
      ['Mathematics', 88, 90, 91, 92, 90, 'PASSED'],
      ['Science', 89, 91, 92, 93, 91, 'PASSED'],
      ['GMRC', 94, 95, 95, 96, 95, 'PASSED'],
      ['Araling Panlipunan', 90, 91, 92, 92, 91, 'PASSED'],
      ['MAPEH', 93, 94, 94, 95, 94, 'PASSED']
    ]
  },
  {
    school_year: '2023-2024',
    grade_level: 'Grade 2',
    section: 'Mabini',
    adviser: 'Rafael Mendoza',
    school_name: 'TR Yangco Elementary School',
    school_id: '136666',
    final_rating: 94,
    action_taken: 'PROMOTED',
    subjects: [
      ['Filipino', 92, 93, 94, 94, 93, 'PASSED'],
      ['English', 93, 94, 94, 95, 94, 'PASSED'],
      ['Mathematics', 91, 92, 93, 94, 93, 'PASSED'],
      ['Science', 92, 93, 93, 94, 93, 'PASSED'],
      ['GMRC', 96, 96, 97, 97, 97, 'PASSED'],
      ['Araling Panlipunan', 93, 93, 94, 95, 94, 'PASSED'],
      ['MAPEH', 94, 95, 95, 96, 95, 'PASSED']
    ]
  },
  {
    school_year: '2024-2025',
    grade_level: 'Grade 3',
    section: 'Bonifacio',
    adviser: 'Elena Garcia',
    school_name: 'TR Yangco Elementary School',
    school_id: '136666',
    final_rating: 95,
    action_taken: 'PROMOTED',
    subjects: [
      ['Filipino', 94, 94, 95, 95, 95, 'PASSED'],
      ['English', 95, 95, 96, 96, 96, 'PASSED'],
      ['Mathematics', 92, 94, 95, 95, 94, 'PASSED'],
      ['Science', 94, 95, 95, 96, 95, 'PASSED'],
      ['GMRC', 97, 97, 98, 98, 98, 'PASSED'],
      ['Araling Panlipunan', 94, 95, 95, 96, 95, 'PASSED'],
      ['MAPEH', 96, 96, 97, 97, 97, 'PASSED']
    ]
  }
];

const currentSubjects = [
  { name: 'Filipino', ww: 0.3, pt: 0.5, qa: 0.2, base: 0.92 },
  { name: 'English', ww: 0.3, pt: 0.5, qa: 0.2, base: 0.94 },
  { name: 'Mathematics', ww: 0.4, pt: 0.4, qa: 0.2, base: 0.91 },
  { name: 'Science', ww: 0.4, pt: 0.4, qa: 0.2, base: 0.93 },
  { name: 'Araling Panlipunan', ww: 0.3, pt: 0.5, qa: 0.2, base: 0.94 },
  { name: 'GMRC', ww: 0.3, pt: 0.5, qa: 0.2, base: 0.97 },
  { name: 'MAPEH', ww: 0.2, pt: 0.6, qa: 0.2, base: 0.95 }
];

function createPinHash(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pin, salt, 120000, 64, 'sha512').toString('hex');
  return `pbkdf2_sha512$120000$${salt}$${hash}`;
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row ?? null);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

async function exec(db, sql) {
  await new Promise((resolve, reject) => {
    db.exec(sql, (error) => (error ? reject(error) : resolve()));
  });
}

async function addColumnIfMissing(db, tableName, columnName, definition) {
  const columns = new Set((await all(db, `PRAGMA table_info(${tableName})`)).map((row) => row.name));
  if (!columns.has(columnName)) {
    await exec(db, `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

async function ensureSf10Columns(db) {
  await addColumnIfMissing(db, 'Students', 'eligibility_school_name', 'TEXT');
  await addColumnIfMissing(db, 'Students', 'eligibility_school_id', 'TEXT');
  await addColumnIfMissing(db, 'Students', 'eligibility_school_address', 'TEXT');
  await addColumnIfMissing(db, 'Students', 'pept_rating', 'REAL CHECK (pept_rating IS NULL OR (pept_rating BETWEEN 0 AND 100))');
  await addColumnIfMissing(db, 'Students', 'pept_date', 'TEXT');
  await addColumnIfMissing(db, 'Students', 'als_rating', 'REAL CHECK (als_rating IS NULL OR (als_rating BETWEEN 0 AND 100))');
  await addColumnIfMissing(db, 'Students', 'testing_center', 'TEXT');
  await addColumnIfMissing(db, 'Students', 'other_credential', 'TEXT');
  await addColumnIfMissing(db, 'Students', 'eligibility_remarks', 'TEXT');
  await addColumnIfMissing(db, 'Academic_Records_History', 'adviser', 'TEXT');
  await addColumnIfMissing(db, 'Academic_Records_History', 'school_name', 'TEXT');
  await addColumnIfMissing(db, 'Academic_Records_History', 'school_id', 'TEXT');
  await addColumnIfMissing(db, 'Academic_Records_History', 'subject_details', 'TEXT');
}

function subjectRows(rows) {
  return rows.map(([name, q1, q2, q3, q4, final_rating, remarks]) => ({
    name,
    q1,
    q2,
    q3,
    q4,
    final_rating,
    remarks
  }));
}

async function upsertTeacher(db) {
  const existing = await get(db, 'SELECT id FROM Teachers WHERE name = ?', [sample.teacher.name]);
  if (existing) {
    await run(
      db,
      `UPDATE Teachers
       SET school_name = ?, school_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [sample.teacher.school_name, sample.teacher.school_id, existing.id]
    );
    return existing.id;
  }

  const result = await run(
    db,
    `INSERT INTO Teachers (name, school_name, school_id, pin_hash)
     VALUES (?, ?, ?, ?)`,
    [sample.teacher.name, sample.teacher.school_name, sample.teacher.school_id, createPinHash(sample.teacher.pin)]
  );
  return result.id;
}

async function upsertClass(db, teacherId) {
  const existing = await get(
    db,
    `SELECT id
     FROM Classes
     WHERE teacher_id = ? AND grade_level = ? AND section = ? AND school_year = ?`,
    [teacherId, sample.classRecord.grade_level, sample.classRecord.section, sample.classRecord.school_year]
  );
  if (existing) return existing.id;

  const result = await run(
    db,
    `INSERT INTO Classes (teacher_id, grade_level, section, school_year, curriculum)
     VALUES (?, ?, ?, ?, ?)`,
    [
      teacherId,
      sample.classRecord.grade_level,
      sample.classRecord.section,
      sample.classRecord.school_year,
      sample.classRecord.curriculum
    ]
  );
  return result.id;
}

async function upsertStudent(db, classId) {
  await run(
    db,
    `INSERT INTO Students (
       class_id, lrn, last_name, first_name, middle_name, name_extn, sex, birthdate,
       eligibility_credential, eligibility_school_name, eligibility_school_id, eligibility_school_address,
       pept_rating, pept_date, als_rating, testing_center, other_credential, eligibility_remarks
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(class_id, lrn)
     DO UPDATE SET
       last_name = excluded.last_name,
       first_name = excluded.first_name,
       middle_name = excluded.middle_name,
       name_extn = excluded.name_extn,
       sex = excluded.sex,
       birthdate = excluded.birthdate,
       eligibility_credential = excluded.eligibility_credential,
       eligibility_school_name = excluded.eligibility_school_name,
       eligibility_school_id = excluded.eligibility_school_id,
       eligibility_school_address = excluded.eligibility_school_address,
       pept_rating = excluded.pept_rating,
       pept_date = excluded.pept_date,
       als_rating = excluded.als_rating,
       testing_center = excluded.testing_center,
       other_credential = excluded.other_credential,
       eligibility_remarks = excluded.eligibility_remarks,
       updated_at = CURRENT_TIMESTAMP`,
    [
      classId,
      sample.student.lrn,
      sample.student.last_name,
      sample.student.first_name,
      sample.student.middle_name,
      sample.student.name_extn || null,
      sample.student.sex,
      sample.student.birthdate,
      sample.student.eligibility_credential,
      sample.student.eligibility_school_name,
      sample.student.eligibility_school_id,
      sample.student.eligibility_school_address,
      sample.student.pept_rating,
      sample.student.pept_date,
      sample.student.als_rating,
      sample.student.testing_center,
      sample.student.other_credential,
      sample.student.eligibility_remarks
    ]
  );
  return (await get(db, 'SELECT id FROM Students WHERE class_id = ? AND lrn = ?', [classId, sample.student.lrn])).id;
}

async function seedHistory(db, studentId) {
  await run(db, 'DELETE FROM Academic_Records_History WHERE student_id = ?', [studentId]);
  for (const record of historyRecords) {
    await run(
      db,
      `INSERT INTO Academic_Records_History (
         student_id, school_year, grade_level, section, adviser, school_name, school_id,
         final_rating, action_taken, subject_details
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        record.school_year,
        record.grade_level,
        record.section,
        record.adviser,
        record.school_name,
        record.school_id,
        record.final_rating,
        record.action_taken,
        JSON.stringify(subjectRows(record.subjects))
      ]
    );
  }
}

async function seedCurrentGrades(db, classId, studentId) {
  for (const subject of currentSubjects) {
    await run(
      db,
      `INSERT INTO Subjects (class_id, name, written_work_weight, perf_task_weight, quarterly_weight)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(class_id, name)
       DO UPDATE SET
         written_work_weight = excluded.written_work_weight,
         perf_task_weight = excluded.perf_task_weight,
         quarterly_weight = excluded.quarterly_weight,
         updated_at = CURRENT_TIMESTAMP`,
      [classId, subject.name, subject.ww, subject.pt, subject.qa]
    );
    const subjectId = (await get(db, 'SELECT id FROM Subjects WHERE class_id = ? AND name = ?', [classId, subject.name])).id;

    for (let quarter = 1; quarter <= 4; quarter += 1) {
      const assessments = [
        { type: 'WW', name: `SF10 Q${quarter} Written Work`, max: 20 },
        { type: 'PT', name: `SF10 Q${quarter} Performance Task`, max: 30 },
        { type: 'QA', name: `SF10 Q${quarter} Quarterly Assessment`, max: 50 }
      ];

      for (const assessment of assessments) {
        await run(
          db,
          `INSERT INTO Assessments (subject_id, quarter, type, max_score, name)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT DO NOTHING`,
          [subjectId, quarter, assessment.type, assessment.max, assessment.name]
        );
        const assessmentId = (await get(
          db,
          'SELECT id FROM Assessments WHERE subject_id = ? AND quarter = ? AND type = ? AND name = ?',
          [subjectId, quarter, assessment.type, assessment.name]
        )).id;
        const score = Math.min(assessment.max, Math.round(assessment.max * (subject.base + quarter * 0.005)));
        await run(
          db,
          `INSERT INTO Grades (student_id, assessment_id, raw_score)
           VALUES (?, ?, ?)
           ON CONFLICT(student_id, assessment_id)
           DO UPDATE SET raw_score = excluded.raw_score, updated_at = CURRENT_TIMESTAMP`,
          [studentId, assessmentId, score]
        );
      }
    }
  }
}

async function seed() {
  fs.mkdirSync(userDataPath, { recursive: true });
  const db = new sqlite3.Database(dbPath);
  try {
    await exec(db, 'PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
    await exec(db, fs.readFileSync(schemaPath, 'utf8'));
    await ensureSf10Columns(db);
    await run(db, 'BEGIN TRANSACTION');
    const teacherId = await upsertTeacher(db);
    const classId = await upsertClass(db, teacherId);
    const studentId = await upsertStudent(db, classId);
    await seedHistory(db, studentId);
    await seedCurrentGrades(db, classId, studentId);
    await run(db, 'COMMIT');

    console.log(`Seeded SF10 sample data in: ${dbPath}`);
    console.log(`Teacher: ${sample.teacher.name} | PIN: ${sample.teacher.pin}`);
    console.log(`Class: ${sample.classRecord.grade_level} - ${sample.classRecord.section} (${sample.classRecord.school_year})`);
    console.log(`Learner: ${sample.student.last_name}, ${sample.student.first_name} ${sample.student.middle_name} | LRN: ${sample.student.lrn}`);
    console.log(`Student ID: ${studentId}`);
    console.log('Scholastic history: Grade 1, Grade 2, Grade 3; current Grade 4 scores included.');
  } catch (error) {
    try {
      await run(db, 'ROLLBACK');
    } catch {
      // No active transaction.
    }
    throw error;
  } finally {
    db.close();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
