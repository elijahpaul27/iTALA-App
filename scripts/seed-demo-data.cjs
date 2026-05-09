const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();

const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const userDataPath = path.join(appData, 'iTALA');
const dbPath = path.join(userDataPath, 'itala.sqlite3');
const schemaPath = path.join(__dirname, '..', 'src', 'db', 'schema.sql');

const school = {
  name: 'TR Yangco Elementary School',
  id: '136666',
  schoolYear: '2025-2026',
  curriculum: 'MATATAG'
};

const credentials = [
  { key: 'admin', name: 'Maestro Admin', pin: '1234', school_name: school.name, school_id: school.id },
  { key: 'grade1', name: 'Teacher Grade 1', pin: '1111', school_name: school.name, school_id: school.id },
  { key: 'grade2', name: 'Teacher Grade 2', pin: '2222', school_name: school.name, school_id: school.id },
  { key: 'grade3', name: 'Teacher Grade 3', pin: '3333', school_name: school.name, school_id: school.id },
  { key: 'grade4', name: 'Teacher Grade 4', pin: '4444', school_name: school.name, school_id: school.id },
  { key: 'grade5', name: 'Teacher Grade 5', pin: '5555', school_name: school.name, school_id: school.id },
  { key: 'grade6', name: 'Teacher Grade 6', pin: '6666', school_name: school.name, school_id: school.id }
];

const classes = [
  { grade: 'Grade 1', section: 'Rizal', teacherKey: 'grade1' },
  { grade: 'Grade 2', section: 'Bonifacio', teacherKey: 'grade2' },
  { grade: 'Grade 3', section: 'Mabini', teacherKey: 'grade3' },
  { grade: 'Grade 4', section: 'Luna', teacherKey: 'grade4' },
  { grade: 'Grade 5', section: 'Del Pilar', teacherKey: 'grade5' },
  { grade: 'Grade 6', section: 'Aguinaldo', teacherKey: 'grade6' }
];

const subjects = [
  { name: 'Filipino', ww: 0.3, pt: 0.5, qa: 0.2 },
  { name: 'English', ww: 0.3, pt: 0.5, qa: 0.2 },
  { name: 'Mathematics', ww: 0.4, pt: 0.4, qa: 0.2 },
  { name: 'Science', ww: 0.4, pt: 0.4, qa: 0.2 },
  { name: 'Araling Panlipunan', ww: 0.3, pt: 0.5, qa: 0.2 },
  { name: 'GMRC (Good Manners and Right Conduct)', ww: 0.3, pt: 0.5, qa: 0.2 },
  { name: 'MAPEH', ww: 0.2, pt: 0.6, qa: 0.2 }
];

const firstNames = ['Juan', 'Maria', 'Pedro', 'Ana', 'Jose', 'Luz', 'Carlos', 'Elena', 'Miguel', 'Rosa'];
const middleNames = ['Santos', 'Reyes', 'Cruz', 'Garcia', 'Mendoza', 'Torres', 'Ramos', 'Flores', 'Aquino', 'Dela Cruz'];
const lastNames = ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Torres', 'Tomas', 'Villanueva'];

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

function seededScore(maxScore, gradeIndex, studentIndex, quarter, assessmentIndex) {
  const percent = 0.72 + (((gradeIndex * 11 + studentIndex * 7 + quarter * 5 + assessmentIndex * 3) % 27) / 100);
  return Math.min(maxScore, Math.round(maxScore * percent));
}

function birthdateFor(gradeIndex, studentIndex) {
  const year = 2018 - gradeIndex;
  const month = String((studentIndex % 12) + 1).padStart(2, '0');
  const day = String(((studentIndex * 2) % 27) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function learner(gradeIndex, studentIndex) {
  const index = studentIndex - 1;
  return {
    lrn: `136666${gradeIndex}${String(studentIndex).padStart(5, '0')}`,
    last_name: lastNames[index],
    first_name: firstNames[index],
    middle_name: middleNames[(index + gradeIndex) % middleNames.length],
    name_extn: null,
    sex: studentIndex % 2 === 0 ? 'F' : 'M',
    birthdate: birthdateFor(gradeIndex, studentIndex),
    eligibility_credential: 'Kinder Progress Report'
  };
}

async function seed() {
  fs.mkdirSync(userDataPath, { recursive: true });
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const db = new sqlite3.Database(dbPath);

  try {
    await run(db, 'PRAGMA foreign_keys = ON;');
    await new Promise((resolve, reject) => {
      db.exec(schema, (error) => (error ? reject(error) : resolve()));
    });

    await run(db, 'DELETE FROM Grades;');
    await run(db, 'DELETE FROM Assessments;');
    await run(db, 'DELETE FROM Academic_Records_History;');
    await run(db, 'DELETE FROM Attendance_Logs;');
    await run(db, 'DELETE FROM Subjects;');
    await run(db, 'DELETE FROM Students;');
    await run(db, 'DELETE FROM Classes;');
    await run(db, 'DELETE FROM Teachers;');
    await run(db, "DELETE FROM sqlite_sequence WHERE name IN ('Teachers','Classes','Students','Subjects','Assessments','Grades','Attendance_Logs');");

    const teacherIds = new Map();
    for (const credential of credentials) {
      const result = await run(
        db,
        `INSERT INTO Teachers (name, school_name, school_id, pin_hash)
         VALUES (?, ?, ?, ?)`,
        [credential.name, credential.school_name, credential.school_id, createPinHash(credential.pin)]
      );
      teacherIds.set(credential.key, result.id);
    }

    for (const [classIndex, classRecord] of classes.entries()) {
      const gradeIndex = classIndex + 1;
      const teacherId = teacherIds.get(classRecord.teacherKey);
      const classResult = await run(
        db,
        `INSERT INTO Classes (teacher_id, grade_level, section, school_year, curriculum)
         VALUES (?, ?, ?, ?, ?)`,
        [teacherId, classRecord.grade, classRecord.section, school.schoolYear, school.curriculum]
      );
      const classId = classResult.id;

      const studentIds = [];
      for (let studentIndex = 1; studentIndex <= 10; studentIndex += 1) {
        const student = learner(gradeIndex, studentIndex);
        const studentResult = await run(
          db,
          `INSERT INTO Students
           (class_id, lrn, last_name, first_name, middle_name, name_extn, sex, birthdate, eligibility_credential)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            classId,
            student.lrn,
            student.last_name,
            student.first_name,
            student.middle_name,
            student.name_extn,
            student.sex,
            student.birthdate,
            student.eligibility_credential
          ]
        );
        studentIds.push(studentResult.id);
      }

      for (const subject of subjects) {
        const subjectResult = await run(
          db,
          `INSERT INTO Subjects (class_id, name, written_work_weight, perf_task_weight, quarterly_weight)
           VALUES (?, ?, ?, ?, ?)`,
          [classId, subject.name, subject.ww, subject.pt, subject.qa]
        );
        const subjectId = subjectResult.id;

        for (let quarter = 1; quarter <= 4; quarter += 1) {
          const assessments = [
            { type: 'WW', name: `Q${quarter} Written Work 1`, max: 20 },
            { type: 'WW', name: `Q${quarter} Written Work 2`, max: 20 },
            { type: 'PT', name: `Q${quarter} Performance Task 1`, max: 25 },
            { type: 'PT', name: `Q${quarter} Performance Task 2`, max: 25 },
            { type: 'QA', name: `Q${quarter} Quarterly Assessment`, max: 50 }
          ];

          for (const [assessmentIndex, assessment] of assessments.entries()) {
            const assessmentResult = await run(
              db,
              `INSERT INTO Assessments (subject_id, quarter, type, max_score, name)
               VALUES (?, ?, ?, ?, ?)`,
              [subjectId, quarter, assessment.type, assessment.max, assessment.name]
            );
            const assessmentId = assessmentResult.id;

            for (const [studentOffset, studentId] of studentIds.entries()) {
              await run(
                db,
                `INSERT INTO Grades (student_id, assessment_id, raw_score)
                 VALUES (?, ?, ?)`,
                [studentId, assessmentId, seededScore(assessment.max, gradeIndex, studentOffset + 1, quarter, assessmentIndex + 1)]
              );
            }
          }
        }
      }
    }

    const counts = {};
    for (const table of ['Teachers', 'Classes', 'Students', 'Subjects', 'Assessments', 'Grades']) {
      counts[table] = (await get(db, `SELECT COUNT(*) AS count FROM ${table}`)).count;
    }

    console.log(`Seeded Electron database: ${dbPath}`);
    for (const [table, count] of Object.entries(counts)) {
      console.log(`${table}: ${count}`);
    }
    console.log('\nLogin credentials:');
    for (const credential of credentials) {
      console.log(`${credential.name} | PIN: ${credential.pin}`);
    }
  } finally {
    db.close();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
