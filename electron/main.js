import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sqlite3 from 'sqlite3';
import {
  assertInteger,
  assertSafeFilePath,
  validateGradeBatchPayload,
  validateGradeTemplate
} from './auditCore.js';
import { createExportService } from '../src/utils/exportService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

let db;
let databasePath;
let exportService;
const gradeChangeTargets = new Set();

const templateDefinitions = {
  sf5: {
    label: 'SF5',
    fileName: 'School Form 5 Report on Promotion and Learning Progress Achievement.xlsx'
  },
  sf10: {
    label: 'SF10',
    fileName: 'School-Form-10-ES-Learners-Academic Permanent-Record_26March2025.xlsx'
  }
};

const depedSubjectWeightTemplates = {
  elementary: [
    ['Filipino', 0.3, 0.5, 0.2],
    ['English', 0.3, 0.5, 0.2],
    ['Mathematics', 0.4, 0.4, 0.2],
    ['Science', 0.4, 0.4, 0.2],
    ['Araling Panlipunan', 0.3, 0.5, 0.2],
    ['GMRC', 0.3, 0.5, 0.2],
    ['MAPEH', 0.2, 0.6, 0.2],
    ['EPP/TLE', 0.2, 0.6, 0.2]
  ],
  juniorHigh: [
    ['Filipino', 0.3, 0.5, 0.2],
    ['English', 0.3, 0.5, 0.2],
    ['Mathematics', 0.4, 0.4, 0.2],
    ['Science', 0.4, 0.4, 0.2],
    ['Araling Panlipunan', 0.3, 0.5, 0.2],
    ['EsP', 0.3, 0.5, 0.2],
    ['MAPEH', 0.2, 0.6, 0.2],
    ['TLE', 0.2, 0.6, 0.2]
  ]
};

function standardSubjectTemplateForGrade(gradeLevel) {
  const gradeNumber = Number(String(gradeLevel ?? '').match(/\d+/)?.[0] ?? 0);
  return gradeNumber >= 7 ? depedSubjectWeightTemplates.juniorHigh : depedSubjectWeightTemplates.elementary;
}

function createPinHash(pin) {
  if (typeof pin !== 'string' || pin.length < 4) {
    throw new Error('PIN must contain at least 4 characters.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pin, salt, 120000, 64, 'sha512').toString('hex');
  return `pbkdf2_sha512$120000$${salt}$${hash}`;
}

function verifyPinHash(pin, storedHash) {
  if (!pin || !storedHash) return false;

  const [algorithm, iterationsValue, salt, originalHash] = storedHash.split('$');
  if (algorithm !== 'pbkdf2_sha512' || !iterationsValue || !salt || !originalHash) {
    return false;
  }

  const iterations = Number.parseInt(iterationsValue, 10);
  const candidate = crypto.pbkdf2Sync(String(pin), salt, iterations, 64, 'sha512');
  const original = Buffer.from(originalHash, 'hex');

  return original.length === candidate.length && crypto.timingSafeEqual(original, candidate);
}

function assertTwelveDigitLrn(lrn) {
  if (!/^\d{12}$/.test(String(lrn ?? ''))) {
    throw new Error('LRN must contain exactly 12 digits.');
  }
}

function assertValidRawScore(rawScore, maxScore) {
  const score = Number(rawScore);
  const maximum = Number(maxScore);

  if (!Number.isFinite(score) || score < 0) {
    throw new Error('Raw score must be a non-negative number.');
  }

  if (!Number.isFinite(maximum) || maximum <= 0) {
    throw new Error('Assessment maximum score is invalid.');
  }

  if (score > maximum) {
    throw new Error(`Raw score cannot exceed the assessment maximum of ${maximum}.`);
  }
}

function nullableText(value) {
  const text = String(value ?? '').trim();
  return text === '' ? null : text;
}

function nullableGradeValue(value, fieldName) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw new Error(`${fieldName} must be a number from 0 to 100.`);
  }
  return number;
}

function normalizeSf10Subject(subject) {
  return {
    name: nullableText(subject?.name) ?? 'Learning Area',
    q1: nullableGradeValue(subject?.q1, 'Quarter 1 rating'),
    q2: nullableGradeValue(subject?.q2, 'Quarter 2 rating'),
    q3: nullableGradeValue(subject?.q3, 'Quarter 3 rating'),
    q4: nullableGradeValue(subject?.q4, 'Quarter 4 rating'),
    final_rating: nullableGradeValue(subject?.final_rating, 'Final rating'),
    remarks: nullableText(subject?.remarks)
  };
}

function parseSubjectDetails(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildSf10Eligibility(student) {
  return {
    credential: student.eligibility_credential ?? 'kinder_progress_report',
    school_name: student.eligibility_school_name ?? '',
    school_id: student.eligibility_school_id ?? '',
    school_address: student.eligibility_school_address ?? '',
    pept_rating: student.pept_rating ?? '',
    assessment_date: student.pept_date ?? '',
    testing_center: student.testing_center ?? '',
    als_rating: student.als_rating ?? '',
    other_credential: student.other_credential ?? '',
    remarks: student.eligibility_remarks ?? ''
  };
}

function mapSf10HistoryRow(row) {
  const subjects = parseSubjectDetails(row.subject_details);
  return {
    ...row,
    general_average: row.final_rating,
    subjects
  };
}

async function getSf10Draft(studentId) {
  assertInteger(studentId, 'studentId');
  const student = await get('SELECT * FROM Students WHERE id = ?', [studentId]);
  if (!student) throw new Error('Learner not found.');

  const records = await all(
    `SELECT *
     FROM Academic_Records_History
     WHERE student_id = ?
     ORDER BY school_year, grade_level`,
    [studentId]
  );

  return {
    student,
    eligibility: buildSf10Eligibility(student),
    records: records.map(mapSf10HistoryRow)
  };
}

async function saveSf10Draft(payload) {
  const personalInfo = payload?.personalInfo;
  const eligibility = payload?.eligibility ?? {};
  const records = Array.isArray(payload?.records) ? payload.records : [];
  assertInteger(personalInfo?.id, 'studentId');
  assertInteger(personalInfo?.class_id, 'classId');
  assertTwelveDigitLrn(personalInfo.lrn);

  if (!['M', 'F'].includes(personalInfo.sex)) {
    throw new Error('Sex must be M or F.');
  }

  const normalizedRecords = records.map((record, index) => {
    const schoolYear = nullableText(record?.school_year);
    const gradeLevel = nullableText(record?.grade_level);
    if (!schoolYear || !gradeLevel) {
      throw new Error(`Record ${index + 1} requires School Year and Grade Level.`);
    }

    return {
      student_id: personalInfo.id,
      school_year: schoolYear,
      grade_level: gradeLevel,
      section: nullableText(record?.section) ?? '',
      adviser: nullableText(record?.adviser),
      school_name: nullableText(record?.school_name),
      school_id: nullableText(record?.school_id),
      final_rating: nullableGradeValue(record?.general_average ?? record?.final_rating, 'General average') ?? 0,
      action_taken: nullableText(record?.action_taken) ?? 'PROMOTED',
      subject_details: JSON.stringify((record?.subjects ?? []).map(normalizeSf10Subject))
    };
  });

  await run('BEGIN TRANSACTION');
  try {
    await run(
      `UPDATE Students
       SET class_id = ?,
           lrn = ?,
           last_name = ?,
           first_name = ?,
           middle_name = ?,
           name_extn = ?,
           sex = ?,
           birthdate = ?,
           eligibility_credential = ?,
           eligibility_school_name = ?,
           eligibility_school_id = ?,
           eligibility_school_address = ?,
           pept_rating = ?,
           pept_date = ?,
           als_rating = ?,
           testing_center = ?,
           other_credential = ?,
           eligibility_remarks = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        personalInfo.class_id,
        personalInfo.lrn,
        nullableText(personalInfo.last_name),
        nullableText(personalInfo.first_name),
        nullableText(personalInfo.middle_name),
        nullableText(personalInfo.name_extn),
        personalInfo.sex,
        nullableText(personalInfo.birthdate),
        nullableText(eligibility.credential),
        nullableText(eligibility.school_name),
        nullableText(eligibility.school_id),
        nullableText(eligibility.school_address),
        nullableGradeValue(eligibility.pept_rating, 'PEPT rating'),
        nullableText(eligibility.assessment_date),
        nullableGradeValue(eligibility.als_rating, 'ALS A&E rating'),
        nullableText(eligibility.testing_center),
        nullableText(eligibility.other_credential),
        nullableText(eligibility.remarks),
        personalInfo.id
      ]
    );

    await run('DELETE FROM Academic_Records_History WHERE student_id = ?', [personalInfo.id]);
    for (const record of normalizedRecords) {
      await run(
        `INSERT INTO Academic_Records_History
         (student_id, school_year, grade_level, section, adviser, school_name, school_id, final_rating, action_taken, subject_details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.student_id,
          record.school_year,
          record.grade_level,
          record.section,
          record.adviser,
          record.school_name,
          record.school_id,
          record.final_rating,
          record.action_taken,
          record.subject_details
        ]
      );
    }

    await run('COMMIT');
    return { ok: true, savedRecords: normalizedRecords.length };
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

function normalizeCsvHeader(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function valueFromCsv(row, headerIndexes, names, fallback = '') {
  for (const name of names) {
    const index = headerIndexes.get(name);
    if (index !== undefined) return String(row[index] ?? '').trim();
  }
  return fallback;
}

function lisValue(row, headerIndexes, names, fallback = '') {
  const aliases = names.flatMap((name) => {
    const normalized = normalizeCsvHeader(name);
    return [
      normalized,
      normalized.replace(/^learner_/, ''),
      normalized.replace(/^learners_/, ''),
      normalized.replace(/^pupil_/, ''),
      normalized.replace(/^student_/, '')
    ];
  });
  return valueFromCsv(row, headerIndexes, aliases, fallback);
}

function normalizeSex(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'M' || normalized === 'MALE') return 'M';
  if (normalized === 'F' || normalized === 'FEMALE') return 'F';
  return '';
}

async function importRosterCsv(classId) {
  const result = await dialog.showOpenDialog({
    title: 'Import learner roster CSV',
    buttonLabel: 'Import roster',
    properties: ['openFile'],
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const sourcePath = result.filePaths[0];
  const rows = parseCsv(fs.readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, ''));
  if (rows.length < 2) {
    throw new Error('CSV must include a header row and at least one learner row.');
  }

  const headers = rows[0].map(normalizeCsvHeader);
  const headerIndexes = new Map(headers.map((header, index) => [header, index]));
  const requiredHeaders = ['lrn', 'last_name', 'first_name', 'sex', 'birthdate'];
  const missingHeaders = requiredHeaders.filter((header) => !headerIndexes.has(header));
  if (missingHeaders.length > 0) {
    throw new Error(`CSV is missing required columns: ${missingHeaders.join(', ')}.`);
  }

  const report = { canceled: false, imported: 0, skipped: 0, errors: [], filePath: sourcePath };
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const lineNumber = index + 1;
    const student = {
      class_id: classId,
      lrn: lisValue(row, headerIndexes, ['lrn', 'learner reference number', 'learner_reference_number']),
      last_name: lisValue(row, headerIndexes, ['last name', 'last_name', 'lastname', 'surname', 'learner last name']),
      first_name: lisValue(row, headerIndexes, ['first name', 'first_name', 'firstname', 'given name', 'learner first name']),
      middle_name: lisValue(row, headerIndexes, ['middle name', 'middle_name', 'middlename', 'middle initial', 'learner middle name']),
      name_extn: lisValue(row, headerIndexes, ['extension name', 'name extn', 'name_extn', 'ext name', 'extension', 'ext']),
      sex: normalizeSex(lisValue(row, headerIndexes, ['sex', 'gender'])),
      birthdate: lisValue(row, headerIndexes, ['birthdate', 'birth date', 'date of birth', 'birth_date', 'date_of_birth', 'dob']),
      eligibility_credential: lisValue(row, headerIndexes, ['eligibility credential', 'eligibility_credential', 'eligibility', 'credential'])
    };

    try {
      assertTwelveDigitLrn(student.lrn);
      if (!student.last_name || !student.first_name || !student.sex || !student.birthdate) {
        throw new Error('Required learner fields are incomplete.');
      }

      await run(
        `INSERT INTO Students
         (class_id, lrn, last_name, first_name, middle_name, name_extn, sex, birthdate, eligibility_credential)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(class_id, lrn)
         DO UPDATE SET
           last_name = excluded.last_name,
           first_name = excluded.first_name,
           middle_name = excluded.middle_name,
           name_extn = excluded.name_extn,
           sex = excluded.sex,
           birthdate = excluded.birthdate,
           eligibility_credential = excluded.eligibility_credential,
           updated_at = CURRENT_TIMESTAMP`,
        [
          student.class_id,
          student.lrn,
          student.last_name,
          student.first_name,
          student.middle_name || null,
          student.name_extn || null,
          student.sex,
          student.birthdate,
          student.eligibility_credential || null
        ]
      );
      report.imported += 1;
    } catch (error) {
      report.skipped += 1;
      report.errors.push(`Line ${lineNumber}: ${error.message}`);
    }
  }

  return report;
}

function timestampForFileName() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sanitizeFilePart(value) {
  return String(value ?? '')
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^-+|-+$/g, '') || 'Export';
}

function incrementSchoolYear(schoolYear) {
  const match = String(schoolYear ?? '').match(/(\d{4})\D+(\d{4})/);
  if (!match) return schoolYear;
  return `${Number(match[1]) + 1}-${Number(match[2]) + 1}`;
}

function incrementGradeLevel(gradeLevel) {
  const match = String(gradeLevel ?? '').match(/(.*?)(\d+)(.*)/);
  if (!match) return gradeLevel;
  return `${match[1]}${Number(match[2]) + 1}${match[3]}`.trim();
}

function gradeDistributionBucket(grade) {
  const numericGrade = toNumber(grade);
  if (numericGrade === null) return null;
  if (numericGrade < 75) return '<75';
  if (numericGrade <= 79) return '75-79';
  if (numericGrade <= 84) return '80-84';
  if (numericGrade <= 89) return '85-89';
  if (numericGrade <= 94) return '90-94';
  return '95-100';
}

function summarizeFinalSubjectGrades(gradeRows) {
  const byStudent = new Map();

  for (const row of gradeRows) {
    if (!byStudent.has(row.student_id)) {
      byStudent.set(row.student_id, {
        student: {
          id: row.student_id,
          lrn: row.lrn,
          last_name: row.last_name,
          first_name: row.first_name,
          middle_name: row.middle_name,
          name_extn: row.name_extn,
          sex: row.sex,
          birthdate: row.birthdate,
          eligibility_credential: row.eligibility_credential
        },
        subjects: new Map()
      });
    }

    const entry = byStudent.get(row.student_id);
    if (!entry.subjects.has(row.subject_id)) {
      entry.subjects.set(row.subject_id, {
        subject_id: row.subject_id,
        subject_name: row.subject_name,
        quarters: []
      });
    }
    const grade = toNumber(row.transmuted_grade);
    if (grade !== null) entry.subjects.get(row.subject_id).quarters.push(grade);
  }

  return [...byStudent.values()].map((entry) => {
    const subjects = [...entry.subjects.values()].map((subject) => {
      const finalRating = subject.quarters.length
        ? Math.round(subject.quarters.reduce((sum, grade) => sum + grade, 0) / subject.quarters.length)
        : null;
      return { ...subject, finalRating };
    });
    const ratedSubjects = subjects.filter((subject) => subject.finalRating !== null);
    const generalAverage = ratedSubjects.length
      ? Math.round(ratedSubjects.reduce((sum, subject) => sum + subject.finalRating, 0) / ratedSubjects.length)
      : null;
    const failingSubjects = ratedSubjects.filter((subject) => subject.finalRating < 75);

    return {
      student: entry.student,
      subjects,
      generalAverage,
      failingSubjects,
      status: generalAverage !== null && generalAverage >= 75 && failingSubjects.length === 0 ? 'PROMOTED' : 'RETAINED'
    };
  });
}

async function getClassGradeRows(classId) {
  return all(
    `SELECT
       v.*,
       s.name_extn,
       s.birthdate,
       s.eligibility_credential
     FROM v_quarterly_grade_summary v
     JOIN Students s ON s.id = v.student_id
     WHERE v.class_id = ?
     ORDER BY v.last_name, v.first_name, v.subject_name, v.quarter`,
    [classId]
  );
}

async function getRolloverCandidates(classId) {
  const classRecord = await get('SELECT * FROM Classes WHERE id = ?', [classId]);
  if (!classRecord) throw new Error('Class not found.');

  const gradeRows = await getClassGradeRows(classId);
  const summaries = summarizeFinalSubjectGrades(gradeRows);
  return {
    nextClass: {
      grade_level: incrementGradeLevel(classRecord.grade_level),
      section: classRecord.section,
      school_year: incrementSchoolYear(classRecord.school_year),
      curriculum: classRecord.curriculum
    },
    learners: summaries.map((entry) => ({
      student_id: entry.student.id,
      lrn: entry.student.lrn,
      last_name: entry.student.last_name,
      first_name: entry.student.first_name,
      middle_name: entry.student.middle_name,
      general_average: entry.generalAverage,
      status: entry.status,
      failing_subjects: entry.failingSubjects.map((subject) => subject.subject_name)
    }))
  };
}

async function exportRawGradeGrid({ classId, subjectId }) {
  const [classRecord, assessments, students, gradeRows, summaryRows] = await Promise.all([
    getClassWithTeacher(classId),
    all('SELECT * FROM Assessments WHERE subject_id = ? ORDER BY quarter, type, id', [subjectId]),
    all('SELECT * FROM Students WHERE class_id = ? ORDER BY sex, last_name, first_name, middle_name', [classId]),
    all(
      `SELECT g.student_id, g.assessment_id, g.raw_score
       FROM Grades g
       JOIN Assessments a ON a.id = g.assessment_id
       JOIN Students s ON s.id = g.student_id
       WHERE s.class_id = ? AND a.subject_id = ?`,
      [classId, subjectId]
    ),
    all(
      `SELECT *
       FROM v_quarterly_grade_summary
       WHERE class_id = ? AND subject_id = ?
       ORDER BY student_id, quarter`,
      [classId, subjectId]
    )
  ]);
  if (!classRecord) throw new Error('Class not found.');

  const subjectName = summaryRows[0]?.subject_name ?? 'Subject';
  const scores = new Map(gradeRows.map((grade) => [`${grade.student_id}:${grade.assessment_id}`, grade.raw_score]));
  const summaryByStudent = new Map();
  for (const row of summaryRows) {
    if (!summaryByStudent.has(row.student_id)) summaryByStudent.set(row.student_id, []);
    summaryByStudent.get(row.student_id).push(row);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'iTALA';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('Raw Gradebook', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  worksheet.addRow(['iTALA Raw Gradebook Export']);
  worksheet.addRow([`${classRecord.grade_level} - ${classRecord.section}`, subjectName, classRecord.school_year]);
  worksheet.addRow([]);
  const assessmentHeaders = assessments.map((assessment) => `${assessment.name} (${assessment.type} Q${assessment.quarter} /${assessment.max_score})`);
  const header = ['LRN', 'Learner', ...assessmentHeaders, 'WW Total', 'PT Total', 'QA Total', 'Final Grade'];
  worksheet.addRow(header);

  for (const student of students) {
    const assessmentValues = assessments.map((assessment) => scores.get(`${student.id}:${assessment.id}`) ?? '');
    const totals = { WW: 0, PT: 0, QA: 0 };
    assessments.forEach((assessment) => {
      totals[assessment.type] += Number(scores.get(`${student.id}:${assessment.id}`) ?? 0);
    });
    const studentSummary = summaryByStudent.get(student.id) ?? [];
    const transmuted = studentSummary.map((row) => toNumber(row.transmuted_grade)).filter((grade) => grade !== null);
    const finalGrade = transmuted.length ? Math.round(transmuted.reduce((sum, grade) => sum + grade, 0) / transmuted.length) : '';
    worksheet.addRow([
      student.lrn,
      formatLearnerName(student),
      ...assessmentValues,
      totals.WW,
      totals.PT,
      totals.QA,
      finalGrade
    ]);
  }

  worksheet.mergeCells(1, 1, 1, header.length);
  worksheet.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF2D3748' } };
  worksheet.getRow(2).font = { italic: true, color: { argb: 'FF64748B' } };
  worksheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C5FBD' } };
  worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 4 }];
  worksheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: header.length } };
  worksheet.columns.forEach((column, index) => {
    column.width = index === 1 ? 28 : 16;
  });
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  });

  const documentsPath = app.getPath('documents');
  fs.mkdirSync(documentsPath, { recursive: true });
  const fileName = `RawGradebook_${sanitizeFilePart(classRecord.grade_level)}_${sanitizeFilePart(classRecord.section)}_${sanitizeFilePart(subjectName)}.xlsx`;
  const filePath = path.join(documentsPath, fileName);
  await workbook.xlsx.writeFile(filePath);
  return { canceled: false, filePath };
}

async function applyDepEdStandardWeights(classId) {
  assertInteger(classId, 'classId');
  const classRecord = await get('SELECT * FROM Classes WHERE id = ?', [classId]);
  if (!classRecord) throw new Error('Class not found.');
  const subjects = standardSubjectTemplateForGrade(classRecord.grade_level);

  await run('BEGIN TRANSACTION');
  try {
    for (const [name, written, performance, quarterly] of subjects) {
      await run(
        `INSERT INTO Subjects (class_id, name, written_work_weight, perf_task_weight, quarterly_weight)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(class_id, name)
         DO UPDATE SET
           written_work_weight = excluded.written_work_weight,
           perf_task_weight = excluded.perf_task_weight,
           quarterly_weight = excluded.quarterly_weight,
           updated_at = CURRENT_TIMESTAMP`,
        [classId, name, written, performance, quarterly]
      );
    }
    await run('COMMIT');
    return { ok: true, count: subjects.length };
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }
    db.close((error) => {
      if (error) reject(error);
      else {
        db = null;
        resolve();
      }
    });
  });
}

function getTemplatesPath() {
  const templatesPath = path.join(app.getPath('userData'), 'templates');
  fs.mkdirSync(templatesPath, { recursive: true });
  return templatesPath;
}

function createGhostBackup() {
  if (!databasePath || !fs.existsSync(databasePath)) return null;
  const backupDir = path.join(app.getPath('userData'), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  try {
    if (process.platform === 'win32') {
      fs.closeSync(fs.openSync(path.join(backupDir, '.hidden'), 'a'));
    }
  } catch {
    // Hidden-folder marker is best effort only.
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(backupDir, `itala-${timestamp}.sqlite3`);
  fs.copyFileSync(databasePath, target);
  return target;
}

function getTemplateDefinition(templateType) {
  const definition = templateDefinitions[String(templateType ?? '').toLowerCase()];
  if (!definition) {
    throw new Error('Unsupported template type.');
  }
  return definition;
}

function listTemplates() {
  const templatesPath = getTemplatesPath();
  return Object.entries(templateDefinitions).map(([type, definition]) => {
    const filePath = path.join(templatesPath, definition.fileName);
    const exists = fs.existsSync(filePath);
    const stat = exists ? fs.statSync(filePath) : null;
    return {
      type,
      label: definition.label,
      fileName: definition.fileName,
      filePath: exists ? filePath : '',
      exists,
      updatedAt: stat ? stat.mtime.toISOString() : null
    };
  });
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatLearnerName(student) {
  return [student.last_name, student.first_name, student.middle_name].filter(Boolean).join(', ');
}

function awardCategoryFromAverage(average) {
  if (average >= 98) return 'With Highest Honors';
  if (average >= 95) return 'With High Honors';
  if (average >= 90) return 'With Honors';
  return '';
}

function buildHonorRoll(gradeRows) {
  const byStudent = new Map();

  for (const row of gradeRows) {
    if (!byStudent.has(row.student_id)) {
      byStudent.set(row.student_id, {
        student_id: row.student_id,
        lrn: row.lrn,
        last_name: row.last_name,
        first_name: row.first_name,
        middle_name: row.middle_name,
        sex: row.sex,
        subjectAverages: new Map(),
        hasGradeBelow75: false
      });
    }

    const entry = byStudent.get(row.student_id);
    const grade = toNumber(row.transmuted_grade_decimal ?? row.transmuted_grade);
    if (grade === null) continue;
    if (grade < 75) entry.hasGradeBelow75 = true;

    if (!entry.subjectAverages.has(row.subject_id)) {
      entry.subjectAverages.set(row.subject_id, {
        subject_id: row.subject_id,
        subject_name: row.subject_name,
        grades: []
      });
    }

    entry.subjectAverages.get(row.subject_id).grades.push(grade);
  }

  return [...byStudent.values()]
    .map((entry) => {
      const subjectFinals = [...entry.subjectAverages.values()]
        .map((subject) => {
          if (subject.grades.length !== 4) return null;
          return subject.grades.reduce((sum, grade) => sum + grade, 0) / subject.grades.length;
        })
        .filter((grade) => grade !== null);
      const finalGeneralAverage = subjectFinals.length
        ? subjectFinals.reduce((sum, grade) => sum + grade, 0) / subjectFinals.length
        : null;
      const displayAverage = finalGeneralAverage === null ? null : Math.round(finalGeneralAverage);
      const hasIncompleteSubjects = [...entry.subjectAverages.values()].some((subject) => subject.grades.length !== 4);
      const category = displayAverage !== null && !entry.hasGradeBelow75 && !hasIncompleteSubjects
        ? awardCategoryFromAverage(displayAverage)
        : '';

      return {
        student_id: entry.student_id,
        lrn: entry.lrn,
        last_name: entry.last_name,
        first_name: entry.first_name,
        middle_name: entry.middle_name,
        sex: entry.sex,
        final_general_average: displayAverage,
        final_general_average_decimal: finalGeneralAverage === null ? null : Number(finalGeneralAverage.toFixed(3)),
        award_category: category,
        disqualified: entry.hasGradeBelow75,
        incomplete: hasIncompleteSubjects,
        completed_subjects: subjectFinals.length
      };
    })
    .filter((entry) => entry.award_category)
    .sort((left, right) =>
      right.final_general_average_decimal - left.final_general_average_decimal ||
      String(left.last_name).localeCompare(String(right.last_name)) ||
      String(left.first_name).localeCompare(String(right.first_name))
    );
}

async function getHonorRoll(classId) {
  const gradeRows = await all(
    `SELECT *
     FROM v_quarterly_grade_summary
     WHERE class_id = ?
     ORDER BY last_name, first_name, subject_name, quarter`,
    [classId]
  );

  return buildHonorRoll(gradeRows);
}

async function getClassWithTeacher(classId) {
  return get(
    `SELECT
       c.*,
       t.name AS teacher_name,
       t.school_name,
       t.school_id
     FROM Classes c
     JOIN Teachers t ON t.id = c.teacher_id
     WHERE c.id = ?`,
    [classId]
  );
}

async function generateHonorCertificates(classId) {
  const [classRecord, honorRoll] = await Promise.all([getClassWithTeacher(classId), getHonorRoll(classId)]);
  if (!classRecord) throw new Error('Class not found.');
  if (honorRoll.length === 0) throw new Error('No qualified honor roll learners found.');

  const pdf = await PDFDocument.create();
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);

  for (const learner of honorRoll) {
    const page = pdf.addPage([842, 595]);
    const { width, height } = page.getSize();
    page.drawRectangle({
      x: 32,
      y: 32,
      width: width - 64,
      height: height - 64,
      borderColor: rgb(0.1, 0.22, 0.45),
      borderWidth: 3
    });
    page.drawRectangle({
      x: 48,
      y: 48,
      width: width - 96,
      height: height - 96,
      borderColor: rgb(0.78, 0.63, 0.22),
      borderWidth: 1
    });

    page.drawText(classRecord.school_name ?? 'School', {
      x: 70,
      y: height - 92,
      size: 16,
      font: sans,
      color: rgb(0.1, 0.1, 0.1)
    });
    page.drawText('Certificate of Recognition', {
      x: 185,
      y: height - 178,
      size: 36,
      font: serifBold,
      color: rgb(0.08, 0.18, 0.38)
    });
    page.drawText('is proudly presented to', {
      x: 333,
      y: height - 238,
      size: 15,
      font: serif,
      color: rgb(0.2, 0.2, 0.2)
    });
    page.drawText(`${learner.first_name} ${learner.middle_name ?? ''} ${learner.last_name}`.replace(/\s+/g, ' ').trim(), {
      x: 130,
      y: height - 292,
      size: 30,
      font: serifBold,
      color: rgb(0.04, 0.12, 0.28)
    });
    page.drawText(`for academic excellence as ${learner.award_category}`, {
      x: 210,
      y: height - 340,
      size: 16,
      font: serif,
      color: rgb(0.18, 0.18, 0.18)
    });
    page.drawText(`Final General Average: ${learner.final_general_average}`, {
      x: 326,
      y: height - 372,
      size: 14,
      font: serifBold,
      color: rgb(0.18, 0.18, 0.18)
    });
    page.drawText(`${classRecord.grade_level} - ${classRecord.section} | School Year ${classRecord.school_year}`, {
      x: 267,
      y: height - 418,
      size: 12,
      font: sans,
      color: rgb(0.25, 0.25, 0.25)
    });
    page.drawText(classRecord.teacher_name ?? '', {
      x: 120,
      y: 118,
      size: 13,
      font: sans,
      color: rgb(0.1, 0.1, 0.1)
    });
    page.drawLine({ start: { x: 90, y: 108 }, end: { x: 300, y: 108 }, thickness: 1, color: rgb(0.1, 0.1, 0.1) });
    page.drawText('Class Adviser', {
      x: 155,
      y: 88,
      size: 11,
      font: sans,
      color: rgb(0.25, 0.25, 0.25)
    });
  }

  const documentsPath = app.getPath('documents');
  fs.mkdirSync(documentsPath, { recursive: true });
  const safeSection = String(classRecord.section ?? 'Class').replace(/[<>:"/\\|?*\s]+/g, '_');
  const filePath = path.join(documentsPath, `Honor_Certificates_${safeSection}.pdf`);
  fs.writeFileSync(filePath, await pdf.save());
  return { canceled: false, filePath, count: honorRoll.length };
}

async function exportAtRiskNotices({ classId, quarter }) {
  assertInteger(classId, 'classId');
  assertInteger(quarter, 'quarter', { min: 1, max: 4 });
  const [classRecord, learners] = await Promise.all([
    getClassWithTeacher(classId),
    all(
      `SELECT *
       FROM v_quarterly_grade_summary
       WHERE class_id = ?
         AND quarter = ?
         AND transmuted_grade < 75
       ORDER BY last_name, first_name, subject_name`,
      [classId, quarter]
    )
  ]);
  if (!classRecord) throw new Error('Class not found.');
  if (learners.length === 0) throw new Error('No at-risk learners for this quarter.');

  const grouped = new Map();
  for (const row of learners) {
    if (!grouped.has(row.student_id)) {
      grouped.set(row.student_id, {
        learner: row,
        subjects: []
      });
    }
    grouped.get(row.student_id).subjects.push(`${row.subject_name} (${row.transmuted_grade})`);
  }

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const entry of grouped.values()) {
    const page = pdf.addPage([612, 792]);
    const { height } = page.getSize();
    page.drawText('Academic Intervention Notice', { x: 72, y: height - 72, size: 18, font: bold, color: rgb(0.12, 0.16, 0.24) });
    page.drawText(`${classRecord.school_name} | ${classRecord.grade_level} - ${classRecord.section} | Q${quarter}`, {
      x: 72,
      y: height - 98,
      size: 10,
      font: regular,
      color: rgb(0.35, 0.4, 0.48)
    });
    page.drawText(`Learner: ${entry.learner.last_name}, ${entry.learner.first_name}`, { x: 72, y: height - 142, size: 12, font: bold });
    page.drawText(`LRN: ${entry.learner.lrn}`, { x: 72, y: height - 160, size: 10, font: regular });
    page.drawText('The learner currently needs support in the following subject(s):', { x: 72, y: height - 202, size: 11, font: regular });
    entry.subjects.forEach((subject, index) => {
      page.drawText(`- ${subject}`, { x: 92, y: height - 228 - index * 18, size: 11, font: regular, color: rgb(0.7, 0.1, 0.1) });
    });
    page.drawText('Please coordinate with the adviser for intervention activities and follow-up monitoring.', {
      x: 72,
      y: 180,
      size: 11,
      font: regular
    });
    page.drawText(`Teacher: ${classRecord.teacher_name}`, { x: 72, y: 118, size: 11, font: regular });
    page.drawLine({ start: { x: 72, y: 104 }, end: { x: 260, y: 104 }, thickness: 1, color: rgb(0.5, 0.5, 0.5) });
  }

  const documentsPath = app.getPath('documents');
  fs.mkdirSync(documentsPath, { recursive: true });
  const filePath = path.join(documentsPath, `At_Risk_Notices_Q${quarter}_${sanitizeFilePart(classRecord.section)}.pdf`);
  fs.writeFileSync(filePath, await pdf.save());
  return { canceled: false, filePath, count: grouped.size };
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row ?? null);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function tableColumns(tableName) {
  const rows = await all(`PRAGMA table_info(${tableName})`);
  return new Set(rows.map((row) => row.name));
}

async function addColumnIfMissing(tableName, existingColumns, columnName, definition) {
  if (existingColumns.has(columnName)) return;
  await exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  existingColumns.add(columnName);
}

async function ensureSf10Schema() {
  const studentColumns = await tableColumns('Students');
  await addColumnIfMissing('Students', studentColumns, 'eligibility_school_name', 'TEXT');
  await addColumnIfMissing('Students', studentColumns, 'eligibility_school_id', 'TEXT');
  await addColumnIfMissing('Students', studentColumns, 'eligibility_school_address', 'TEXT');
  await addColumnIfMissing('Students', studentColumns, 'pept_rating', 'REAL CHECK (pept_rating IS NULL OR (pept_rating BETWEEN 0 AND 100))');
  await addColumnIfMissing('Students', studentColumns, 'pept_date', 'TEXT');
  await addColumnIfMissing('Students', studentColumns, 'als_rating', 'REAL CHECK (als_rating IS NULL OR (als_rating BETWEEN 0 AND 100))');
  await addColumnIfMissing('Students', studentColumns, 'testing_center', 'TEXT');
  await addColumnIfMissing('Students', studentColumns, 'other_credential', 'TEXT');
  await addColumnIfMissing('Students', studentColumns, 'eligibility_remarks', 'TEXT');

  const historyColumns = await tableColumns('Academic_Records_History');
  await addColumnIfMissing('Academic_Records_History', historyColumns, 'adviser', 'TEXT');
  await addColumnIfMissing('Academic_Records_History', historyColumns, 'school_name', 'TEXT');
  await addColumnIfMissing('Academic_Records_History', historyColumns, 'school_id', 'TEXT');
  await addColumnIfMissing('Academic_Records_History', historyColumns, 'subject_details', 'TEXT');
  await exec('CREATE INDEX IF NOT EXISTS idx_history_student_year_grade ON Academic_Records_History(student_id, school_year, grade_level);');
}

async function ensureGradeSummaryView(schema) {
  const marker = 'CREATE VIEW IF NOT EXISTS v_quarterly_grade_summary AS';
  const start = schema.indexOf(marker);
  if (start === -1) return;
  const viewSql = schema.slice(start).trim();
  await exec('DROP VIEW IF EXISTS v_quarterly_grade_summary;');
  await exec(viewSql);
}

async function applyMigrations() {
  const migrationsPath = path.join(__dirname, '..', 'migrations');
  await exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`
  );

  if (!fs.existsSync(migrationsPath)) return;
  const files = fs.readdirSync(migrationsPath).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const applied = await get('SELECT id FROM schema_migrations WHERE id = ?', [file]);
    if (applied) continue;
    const sql = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
    await exec(sql);
    await run('INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)', [file]);
  }
}

async function initializeDatabase() {
  const userDataPath = app.getPath('userData');
  fs.mkdirSync(userDataPath, { recursive: true });
  getTemplatesPath();

  const dbPath = path.join(userDataPath, 'itala.sqlite3');
  databasePath = dbPath;
  const schemaPath = path.join(__dirname, '..', 'src', 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  if (db) await closeDatabase();
  db = new sqlite3.Database(dbPath);
  await exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  await exec(schema);
  await ensureSf10Schema();
  await ensureGradeSummaryView(schema);
  await applyMigrations();

  exportService = createExportService({ app, db: { get, all } });
}

async function backupDatabase() {
  if (!databasePath || !fs.existsSync(databasePath)) {
    throw new Error('Database file was not found.');
  }

  const downloadsPath = app.getPath('downloads');
  fs.mkdirSync(downloadsPath, { recursive: true });
  const backupPath = path.join(downloadsPath, `itala-backup-${timestampForFileName()}.sqlite3`);
  fs.copyFileSync(databasePath, backupPath);
  return { canceled: false, filePath: backupPath };
}

async function restoreDatabase() {
  const result = await dialog.showOpenDialog({
    title: 'Restore iTALA database backup',
    buttonLabel: 'Restore backup',
    properties: ['openFile'],
    filters: [{ name: 'SQLite Database', extensions: ['sqlite3', 'db', 'sqlite'] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const sourcePath = result.filePaths[0];
  if (!fs.existsSync(sourcePath)) {
    throw new Error('Selected backup file was not found.');
  }

  await closeDatabase();
  fs.copyFileSync(sourcePath, databasePath);
  await initializeDatabase();
  return { canceled: false, filePath: databasePath };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  gradeChangeTargets.add(win.webContents);
  win.on('closed', () => gradeChangeTargets.delete(win.webContents));

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function emitGradesChanged(payload) {
  for (const target of gradeChangeTargets) {
    if (!target.isDestroyed()) target.send('grades:changed', payload);
  }
}

async function importStudentsFromFile(filePath) {
  const sourcePath = assertSafeFilePath(filePath, ['.csv']);
  const rows = parseCsv(fs.readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, ''));
  if (rows.length < 2) return { ok: false, errors: ['CSV must include a header row and at least one learner row.'] };

  const headers = rows[0].map(normalizeCsvHeader);
  const headerIndexes = new Map(headers.map((header, index) => [header, index]));
  const requiredHeaders = ['class_id', 'lrn', 'last_name', 'first_name', 'sex', 'birthdate'];
  const missingHeaders = requiredHeaders.filter((header) => !headerIndexes.has(header));
  if (missingHeaders.length > 0) return { ok: false, errors: [`CSV is missing required columns: ${missingHeaders.join(', ')}.`] };

  const errors = [];
  await run('BEGIN TRANSACTION');
  try {
    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      const lineNumber = index + 1;
      const classId = Number(valueFromCsv(row, headerIndexes, ['class_id']));
      const student = {
        class_id: classId,
        lrn: valueFromCsv(row, headerIndexes, ['lrn']),
        last_name: valueFromCsv(row, headerIndexes, ['last_name', 'lastname', 'surname']),
        first_name: valueFromCsv(row, headerIndexes, ['first_name', 'firstname', 'given_name']),
        middle_name: valueFromCsv(row, headerIndexes, ['middle_name', 'middlename', 'middle_initial']),
        name_extn: valueFromCsv(row, headerIndexes, ['name_extn', 'extension', 'ext']),
        sex: normalizeSex(valueFromCsv(row, headerIndexes, ['sex', 'gender'])),
        birthdate: valueFromCsv(row, headerIndexes, ['birthdate', 'birth_date', 'date_of_birth', 'dob']),
        eligibility_credential: valueFromCsv(row, headerIndexes, ['eligibility_credential', 'eligibility', 'credential'])
      };

      try {
        assertInteger(student.class_id, 'class_id');
        assertTwelveDigitLrn(student.lrn);
        if (!student.last_name || !student.first_name || !student.sex || !student.birthdate) {
          throw new Error('Required learner fields are incomplete.');
        }
        await run(
          `INSERT INTO Students
           (class_id, lrn, last_name, first_name, middle_name, name_extn, sex, birthdate, eligibility_credential)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(class_id, lrn)
           DO UPDATE SET
             last_name = excluded.last_name,
             first_name = excluded.first_name,
             middle_name = excluded.middle_name,
             name_extn = excluded.name_extn,
             sex = excluded.sex,
             birthdate = excluded.birthdate,
             eligibility_credential = excluded.eligibility_credential,
             updated_at = CURRENT_TIMESTAMP`,
          [
            student.class_id,
            student.lrn,
            student.last_name,
            student.first_name,
            student.middle_name || null,
            student.name_extn || null,
            student.sex,
            student.birthdate,
            student.eligibility_credential || null
          ]
        );
      } catch (error) {
        errors.push(`Line ${lineNumber}: ${error.message}`);
      }
    }
    if (errors.length > 0) throw new Error('Student import validation failed.');
    await run('COMMIT');
    emitGradesChanged({ imported: true });
    return { ok: true, errors: [] };
  } catch (_error) {
    await run('ROLLBACK');
    return { ok: false, errors };
  }
}

async function exportSf2Attendance({ classId, month }) {
  assertInteger(classId, 'classId');
  if (!/^\d{4}-\d{2}$/.test(String(month ?? ''))) {
    throw new Error('Month must use YYYY-MM format.');
  }

  const [classRecord, rows] = await Promise.all([
    getClassWithTeacher(classId),
    all(
      `SELECT id, lrn, last_name, first_name, middle_name, sex
       FROM Students
       WHERE class_id = ?
       ORDER BY sex, last_name, first_name, middle_name`,
      [classId]
    )
  ]);
  if (!classRecord) throw new Error('Class not found.');

  const logs = await all(
    `SELECT student_id, date, status
     FROM Attendance_Logs
     WHERE substr(date, 1, 7) = ?
       AND student_id IN (SELECT id FROM Students WHERE class_id = ?)`,
    [month, classId]
  );
  const [year, monthNumber] = month.split('-').map(Number);
  const dayCount = new Date(year, monthNumber, 0).getDate();
  const days = Array.from({ length: dayCount }, (_value, index) => index + 1);
  const statusByStudent = new Map(rows.map((student) => [student.id, {}]));
  for (const log of logs) {
    statusByStudent.get(log.student_id)[log.date] = log.status;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'iTALA';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('SF2 Attendance', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  worksheet.addRow(['School Form 2 (SF2) Daily Attendance Report']);
  worksheet.addRow([`${classRecord.grade_level} - ${classRecord.section}`, classRecord.school_year, month]);
  worksheet.addRow([]);
  const header = ['LRN', 'Learner', ...days.map(String), 'P', 'A', 'T'];
  worksheet.addRow(header);

  for (const student of rows) {
    const statuses = statusByStudent.get(student.id) ?? {};
    const counts = { Present: 0, Absent: 0, Tardy: 0 };
    const dayValues = days.map((day) => {
      const date = `${month}-${String(day).padStart(2, '0')}`;
      const status = statuses[date] ?? '';
      if (status) counts[status] += 1;
      return status === 'Present' ? 'P' : status === 'Absent' ? 'A' : status === 'Tardy' ? 'T' : '';
    });
    worksheet.addRow([
      student.lrn,
      formatLearnerName(student),
      ...dayValues,
      counts.Present,
      counts.Absent,
      counts.Tardy
    ]);
  }

  worksheet.mergeCells(1, 1, 1, header.length);
  worksheet.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF2D3748' } };
  worksheet.getRow(2).font = { italic: true, color: { argb: 'FF64748B' } };
  worksheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C5FBD' } };
  worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 4 }];
  worksheet.columns.forEach((column, index) => {
    column.width = index === 0 ? 16 : index === 1 ? 28 : 5;
  });
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
  });

  const documentsPath = app.getPath('documents');
  fs.mkdirSync(documentsPath, { recursive: true });
  const fileName = `SF2_${sanitizeFilePart(classRecord.grade_level)}_${sanitizeFilePart(classRecord.section)}_${sanitizeFilePart(month)}.xlsx`;
  const filePath = path.join(documentsPath, fileName);
  await workbook.xlsx.writeFile(filePath);
  return { canceled: false, filePath };
}

async function mutateGradesBatch(event, payload) {
  const updates = validateGradeBatchPayload(payload);
  const failed = [];

  await run('BEGIN TRANSACTION');
  try {
    for (let index = 0; index < updates.length; index += 1) {
      const update = updates[index];
      try {
        const context = await get(
          `SELECT
             s.class_id,
             a.quarter,
             a.max_score,
             g.id AS grade_id,
             g.raw_score AS old_value
           FROM Students s
           JOIN Assessments a ON a.id = ?
           LEFT JOIN Grades g ON g.student_id = s.id AND g.assessment_id = a.id
           WHERE s.id = ?`,
          [update.assessmentId, update.studentId]
        );

        if (!context) throw new Error('Student or assessment not found.');
        if (context.class_id !== payload.classId) throw new Error('Student does not belong to class.');
        if (context.quarter !== payload.quarter) throw new Error('Assessment does not belong to quarter.');
        assertValidRawScore(update.value, context.max_score);

        await run(
          `INSERT INTO Grades (student_id, assessment_id, raw_score)
           VALUES (?, ?, ?)
           ON CONFLICT(student_id, assessment_id)
           DO UPDATE SET raw_score = excluded.raw_score, updated_at = CURRENT_TIMESTAMP`,
          [update.studentId, update.assessmentId, update.value]
        );

        const saved = await get('SELECT id FROM Grades WHERE student_id = ? AND assessment_id = ?', [update.studentId, update.assessmentId]);
        await run(
          `INSERT INTO grade_audit (grade_id, student_id, class_id, user_id, old_value, new_value, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            saved.id,
            update.studentId,
            payload.classId,
            update.userId,
            context.old_value ?? null,
            update.value,
            'batch_edit'
          ]
        );
      } catch (error) {
        failed.push({ index, studentId: update.studentId, assessmentId: update.assessmentId, reason: error.message });
        throw error;
      }
    }
    await run('COMMIT');
    emitGradesChanged({ classId: payload.classId, quarter: payload.quarter });
    return { ok: true, failed: [] };
  } catch (_error) {
    await run('ROLLBACK');
    return { ok: false, failed };
  }
}

function registerIpcHandlers() {
  ipcMain.handle('get:classes', async () => {
    return all(
      `SELECT
         c.id,
         c.grade_level || ' - ' || c.section AS name,
         COALESCE(MIN(s.name), '') AS subject,
         c.school_year AS year,
         c.teacher_id AS teacherId
       FROM Classes c
       LEFT JOIN Subjects s ON s.class_id = c.id
       GROUP BY c.id
       ORDER BY c.school_year DESC, c.grade_level, c.section`
    );
  });

  ipcMain.handle('get:students', (_event, classId) => {
    assertInteger(classId, 'classId');
    return all(
      `SELECT *
       FROM Students
       WHERE class_id = ?
       ORDER BY sex, last_name, first_name, middle_name`,
      [classId]
    );
  });

  ipcMain.handle('get:grades', (_event, { classId, quarter }) => {
    assertInteger(classId, 'classId');
    assertInteger(quarter, 'quarter', { min: 1, max: 4 });
    return all(
      `SELECT
         g.id AS gradeId,
         s.id AS studentId,
         a.id AS assessmentId,
         g.raw_score AS value,
         a.max_score AS maxScore,
         a.name AS assessmentName,
         a.type AS assessmentType,
         a.quarter
       FROM Students s
       JOIN Subjects subj ON subj.class_id = s.class_id
       JOIN Assessments a ON a.subject_id = subj.id AND a.quarter = ?
       LEFT JOIN Grades g ON g.student_id = s.id AND g.assessment_id = a.id
       WHERE s.class_id = ?
       ORDER BY s.sex, s.last_name, s.first_name, a.type, a.id`,
      [quarter, classId]
    );
  });

  ipcMain.handle('mutate:gradesBatch', mutateGradesBatch);

  ipcMain.handle('import:students', (_event, filePath) => {
    return importStudentsFromFile(filePath);
  });

  ipcMain.handle('validate:template', (_event, filePath) => {
    return validateGradeTemplate(filePath);
  });

  ipcMain.handle('export:grades', async (_event, { classId, quarter, templateId }) => {
    assertInteger(classId, 'classId');
    assertInteger(quarter, 'quarter', { min: 1, max: 4 });
    if (typeof templateId !== 'string' || templateId.trim() === '') throw new Error('templateId is required.');
    if (templateId.toLowerCase().endsWith('.xlsx')) {
      const validation = await validateGradeTemplate(templateId);
      if (!validation.ok) return { ok: false, path: '', errors: validation.errors };
    }
    const subject = await get('SELECT id FROM Subjects WHERE class_id = ? ORDER BY name LIMIT 1', [classId]);
    if (!subject) throw new Error('Class has no subjects to export.');
    const result = await exportRawGradeGrid({ classId, subjectId: subject.id, quarter });
    return { ok: true, path: result.filePath };
  });

  ipcMain.handle('backup:create', () => backupDatabase());
  ipcMain.handle('backup:restore', () => restoreDatabase());
  ipcMain.handle('admin:rollover', (_event, payload) => {
    if (!payload?.classId) throw new Error('classId is required.');
    return getRolloverCandidates(payload.classId);
  });

  ipcMain.handle('teachers:list', () => {
    return all(
      `SELECT id, name, school_name, school_id, created_at
       FROM Teachers
       ORDER BY name`
    );
  });

  ipcMain.handle('teachers:create', async (_event, teacher) => {
    const pinHash = createPinHash(teacher.pin);
    return run(
      `INSERT INTO Teachers (name, school_name, school_id, pin_hash)
       VALUES (?, ?, ?, ?)`,
      [teacher.name, teacher.school_name, teacher.school_id, pinHash]
    );
  });

  ipcMain.handle('teachers:save', (_event, teacher) => {
    if (teacher.id) {
      return run(
        `UPDATE Teachers
         SET name = ?, school_name = ?, school_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [teacher.name, teacher.school_name, teacher.school_id, teacher.id]
      );
    }

    const pinHash = createPinHash(teacher.pin);
    return run(
      `INSERT INTO Teachers (name, school_name, school_id, pin_hash)
       VALUES (?, ?, ?, ?)`,
      [teacher.name, teacher.school_name, teacher.school_id, pinHash]
    );
  });

  ipcMain.handle('teachers:delete', (_event, teacherId) => {
    return run('DELETE FROM Teachers WHERE id = ?', [teacherId]);
  });

  ipcMain.handle('teachers:resetPin', (_event, { teacherId, pin }) => {
    const pinHash = createPinHash(pin);
    return run(
      `UPDATE Teachers
       SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [pinHash, teacherId]
    );
  });

  ipcMain.handle('admin:stats', async () => {
    const [teachers, classes, students, subjects, assessments, grades, attendanceLogs] = await Promise.all([
      get('SELECT COUNT(*) AS count FROM Teachers'),
      get('SELECT COUNT(*) AS count FROM Classes'),
      get('SELECT COUNT(*) AS count FROM Students'),
      get('SELECT COUNT(*) AS count FROM Subjects'),
      get('SELECT COUNT(*) AS count FROM Assessments'),
      get('SELECT COUNT(*) AS count FROM Grades'),
      get('SELECT COUNT(*) AS count FROM Attendance_Logs')
    ]);

    const recentTeachers = await all(
      `SELECT id, name, school_name, school_id, created_at
       FROM Teachers
       ORDER BY created_at DESC
       LIMIT 5`
    );

    return {
      teachers: teachers?.count ?? 0,
      classes: classes?.count ?? 0,
      students: students?.count ?? 0,
      subjects: subjects?.count ?? 0,
      assessments: assessments?.count ?? 0,
      grades: grades?.count ?? 0,
      attendanceLogs: attendanceLogs?.count ?? 0,
      recentTeachers
    };
  });

  ipcMain.handle('teachers:verifyPin', async (_event, { teacherId, pin }) => {
    const teacher = await get('SELECT id, pin_hash FROM Teachers WHERE id = ?', [teacherId]);
    return { verified: verifyPinHash(pin, teacher?.pin_hash) };
  });

  ipcMain.handle('classes:list', (_event, teacherId) => {
    return all(
      `SELECT * FROM Classes
       WHERE teacher_id = ?
       ORDER BY school_year DESC, grade_level, section`,
      [teacherId]
    );
  });

  ipcMain.handle('classes:save', (_event, classRecord) => {
    if (classRecord.id) {
      return run(
        `UPDATE Classes
         SET teacher_id = ?, grade_level = ?, section = ?, school_year = ?, curriculum = ?
         WHERE id = ?`,
        [
          classRecord.teacher_id,
          classRecord.grade_level,
          classRecord.section,
          classRecord.school_year,
          classRecord.curriculum,
          classRecord.id
        ]
      );
    }

    return run(
      `INSERT INTO Classes (teacher_id, grade_level, section, school_year, curriculum)
       VALUES (?, ?, ?, ?, ?)`,
      [
        classRecord.teacher_id,
        classRecord.grade_level,
        classRecord.section,
        classRecord.school_year,
        classRecord.curriculum
      ]
    );
  });

  ipcMain.handle('classes:delete', (_event, classId) => {
    return run('DELETE FROM Classes WHERE id = ?', [classId]);
  });

  ipcMain.handle('classes:applyStandardWeights', (_event, classId) => {
    return applyDepEdStandardWeights(classId);
  });

  ipcMain.handle('classes:rolloverCandidates', (_event, classId) => {
    return getRolloverCandidates(classId);
  });

  ipcMain.handle('classes:rolloverPromoted', async (_event, { classId, nextClass }) => {
    const classRecord = await get('SELECT * FROM Classes WHERE id = ?', [classId]);
    if (!classRecord) throw new Error('Class not found.');

    const candidates = await getRolloverCandidates(classId);
    const promoted = candidates.learners.filter((learner) => learner.status === 'PROMOTED');
    const targetClass = {
      grade_level: nextClass?.grade_level || candidates.nextClass.grade_level,
      section: nextClass?.section || candidates.nextClass.section,
      school_year: nextClass?.school_year || candidates.nextClass.school_year,
      curriculum: nextClass?.curriculum || candidates.nextClass.curriculum
    };

    await run('BEGIN TRANSACTION');
    try {
      const created = await run(
        `INSERT INTO Classes (teacher_id, grade_level, section, school_year, curriculum)
         VALUES (?, ?, ?, ?, ?)`,
        [
          classRecord.teacher_id,
          targetClass.grade_level,
          targetClass.section,
          targetClass.school_year,
          targetClass.curriculum
        ]
      );

      for (const learner of promoted) {
        const student = await get('SELECT * FROM Students WHERE id = ?', [learner.student_id]);
        await run(
          `INSERT INTO Students
           (class_id, lrn, last_name, first_name, middle_name, name_extn, sex, birthdate, eligibility_credential)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            created.id,
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
      }

      await run('COMMIT');
      return { canceled: false, classId: created.id, promotedCount: promoted.length };
    } catch (error) {
      await run('ROLLBACK');
      throw error;
    }
  });

  ipcMain.handle('students:list', (_event, classId) => {
    return all(
      `SELECT * FROM Students
       WHERE class_id = ?
       ORDER BY sex, last_name, first_name, middle_name`,
      [classId]
    );
  });

  ipcMain.handle('students:save', (_event, student) => {
    assertTwelveDigitLrn(student.lrn);

    const params = [
      student.class_id,
      student.lrn,
      student.last_name,
      student.first_name,
      student.middle_name ?? null,
      student.name_extn ?? null,
      student.sex,
      student.birthdate,
      student.eligibility_credential ?? null,
      student.eligibility_school_name ?? null,
      student.eligibility_school_id ?? null,
      student.eligibility_school_address ?? null,
      nullableGradeValue(student.pept_rating, 'PEPT rating'),
      student.pept_date ?? null,
      nullableGradeValue(student.als_rating, 'ALS A&E rating'),
      student.testing_center ?? null,
      student.other_credential ?? null,
      student.eligibility_remarks ?? null
    ];

    if (student.id) {
      return run(
        `UPDATE Students
         SET class_id = ?, lrn = ?, last_name = ?, first_name = ?, middle_name = ?,
             name_extn = ?, sex = ?, birthdate = ?, eligibility_credential = ?,
             eligibility_school_name = ?, eligibility_school_id = ?, eligibility_school_address = ?,
             pept_rating = ?, pept_date = ?, als_rating = ?, testing_center = ?,
             other_credential = ?, eligibility_remarks = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [...params, student.id]
      );
    }

    return run(
      `INSERT INTO Students
       (class_id, lrn, last_name, first_name, middle_name, name_extn, sex, birthdate,
        eligibility_credential, eligibility_school_name, eligibility_school_id, eligibility_school_address,
        pept_rating, pept_date, als_rating, testing_center, other_credential, eligibility_remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params
    );
  });

  ipcMain.handle('students:delete', (_event, studentId) => {
    return run('DELETE FROM Students WHERE id = ?', [studentId]);
  });

  ipcMain.handle('students:importCsv', (_event, classId) => {
    return importRosterCsv(classId);
  });

  ipcMain.handle('subjects:list', (_event, classId) => {
    return all('SELECT * FROM Subjects WHERE class_id = ? ORDER BY name', [classId]);
  });

  ipcMain.handle('subjects:save', (_event, subject) => {
    const params = [
      subject.class_id,
      subject.name,
      subject.written_work_weight,
      subject.perf_task_weight,
      subject.quarterly_weight
    ];

    if (subject.id) {
      return run(
        `UPDATE Subjects
         SET class_id = ?, name = ?, written_work_weight = ?, perf_task_weight = ?, quarterly_weight = ?
         WHERE id = ?`,
        [...params, subject.id]
      );
    }

    return run(
      `INSERT INTO Subjects
       (class_id, name, written_work_weight, perf_task_weight, quarterly_weight)
       VALUES (?, ?, ?, ?, ?)`,
      params
    );
  });

  ipcMain.handle('subjects:delete', (_event, subjectId) => {
    return run('DELETE FROM Subjects WHERE id = ?', [subjectId]);
  });

  ipcMain.handle('assessments:list', (_event, subjectId, quarter) => {
    return all(
      `SELECT * FROM Assessments
       WHERE subject_id = ? AND (? IS NULL OR quarter = ?)
       ORDER BY quarter, type, id`,
      [subjectId, quarter ?? null, quarter ?? null]
    );
  });

  ipcMain.handle('assessments:save', (_event, assessment) => {
    const params = [
      assessment.subject_id,
      assessment.quarter,
      assessment.type,
      assessment.max_score,
      assessment.name
    ];

    if (assessment.id) {
      return run(
        `UPDATE Assessments
         SET subject_id = ?, quarter = ?, type = ?, max_score = ?, name = ?
         WHERE id = ?`,
        [...params, assessment.id]
      );
    }

    return run(
      `INSERT INTO Assessments (subject_id, quarter, type, max_score, name)
       VALUES (?, ?, ?, ?, ?)`,
      params
    );
  });

  ipcMain.handle('assessments:delete', (_event, assessmentId) => {
    return run('DELETE FROM Assessments WHERE id = ?', [assessmentId]);
  });

  ipcMain.handle('grades:save', async (_event, grade) => {
    const assessment = await get('SELECT id, max_score, quarter FROM Assessments WHERE id = ?', [grade.assessment_id]);
    if (!assessment) {
      throw new Error('Assessment not found.');
    }
    assertValidRawScore(grade.raw_score, assessment.max_score);

    const student = await get('SELECT class_id FROM Students WHERE id = ?', [grade.student_id]);
    if (!student) throw new Error('Student not found.');
    const oldGrade = await get('SELECT id, raw_score FROM Grades WHERE student_id = ? AND assessment_id = ?', [grade.student_id, grade.assessment_id]);

    await run('BEGIN TRANSACTION');
    try {
      await run(
        `INSERT INTO Grades (student_id, assessment_id, raw_score)
         VALUES (?, ?, ?)
         ON CONFLICT(student_id, assessment_id)
         DO UPDATE SET raw_score = excluded.raw_score, updated_at = CURRENT_TIMESTAMP`,
        [grade.student_id, grade.assessment_id, grade.raw_score]
      );
      const saved = await get('SELECT id FROM Grades WHERE student_id = ? AND assessment_id = ?', [grade.student_id, grade.assessment_id]);
      await run(
        `INSERT INTO grade_audit (grade_id, student_id, class_id, user_id, old_value, new_value, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [saved.id, grade.student_id, student.class_id, grade.user_id ?? null, oldGrade?.raw_score ?? null, grade.raw_score, 'single_edit']
      );
      await run('COMMIT');
      emitGradesChanged({ classId: student.class_id, quarter: assessment.quarter });
      return { id: saved.id, changes: 1 };
    } catch (error) {
      await run('ROLLBACK');
      throw error;
    }
  });

  ipcMain.handle('grades:list', (_event, { classId, subjectId, quarter }) => {
    return all(
      `SELECT
         g.id,
         g.student_id,
         g.assessment_id,
         g.raw_score
       FROM Grades g
       JOIN Assessments a ON a.id = g.assessment_id
       JOIN Students s ON s.id = g.student_id
       WHERE s.class_id = ?
         AND a.subject_id = ?
         AND (? IS NULL OR a.quarter = ?)`,
      [classId, subjectId, quarter ?? null, quarter ?? null]
    );
  });

  ipcMain.handle('grades:summary', (_event, { classId, subjectId, quarter }) => {
    return all(
      `SELECT * FROM v_quarterly_grade_summary
       WHERE class_id = ?
         AND (? IS NULL OR subject_id = ?)
         AND (? IS NULL OR quarter = ?)
       ORDER BY last_name, first_name, subject_name, quarter`,
      [classId, subjectId ?? null, subjectId ?? null, quarter ?? null, quarter ?? null]
    );
  });

  ipcMain.handle('grades:exportRawGrid', (_event, filters) => {
    return exportRawGradeGrid(filters);
  });

  ipcMain.handle('analytics:gradeDistribution', async (_event, { classId }) => {
    const gradeRows = await getClassGradeRows(classId);
    const summaries = summarizeFinalSubjectGrades(gradeRows);
    const buckets = ['<75', '75-79', '80-84', '85-89', '90-94', '95-100'].map((range) => ({ range, count: 0 }));
    const bucketMap = new Map(buckets.map((bucket) => [bucket.range, bucket]));
    for (const summary of summaries) {
      const bucket = gradeDistributionBucket(summary.generalAverage);
      if (bucket) bucketMap.get(bucket).count += 1;
    }
    return buckets;
  });

  ipcMain.handle('analytics:atRisk', async (_event, { classId, quarter }) => {
    const rows = await all(
      `SELECT *
       FROM v_quarterly_grade_summary
       WHERE class_id = ?
         AND quarter = ?
         AND transmuted_grade < 75
       ORDER BY last_name, first_name, subject_name`,
      [classId, quarter]
    );
    const byStudent = new Map();
    for (const row of rows) {
      if (!byStudent.has(row.student_id)) {
        byStudent.set(row.student_id, {
          student_id: row.student_id,
          lrn: row.lrn,
          last_name: row.last_name,
          first_name: row.first_name,
          subjects: []
        });
      }
      byStudent.get(row.student_id).subjects.push({
        subject_name: row.subject_name,
        grade: row.transmuted_grade
      });
    }
    return [...byStudent.values()];
  });

  ipcMain.handle('analytics:exportAtRiskNotices', (_event, payload) => {
    return exportAtRiskNotices(payload);
  });

  ipcMain.handle('attendance:save', (_event, log) => {
    return run(
      `INSERT INTO Attendance_Logs (student_id, date, status)
       VALUES (?, ?, ?)
       ON CONFLICT(student_id, date)
       DO UPDATE SET status = excluded.status`,
      [log.student_id, log.date, log.status]
    );
  });

  ipcMain.handle('attendance:delete', (_event, { studentId, date }) => {
    return run('DELETE FROM Attendance_Logs WHERE student_id = ? AND date = ?', [studentId, date]);
  });

  ipcMain.handle('attendance:dailyGrid', async (_event, { classId, month }) => {
    const students = await all(
      `SELECT id, lrn, last_name, first_name, middle_name, sex
       FROM Students
       WHERE class_id = ?
       ORDER BY sex, last_name, first_name, middle_name`,
      [classId]
    );
    const logs = await all(
      `SELECT student_id, date, status
       FROM Attendance_Logs
       WHERE substr(date, 1, 7) = ?
         AND student_id IN (SELECT id FROM Students WHERE class_id = ?)`,
      [month, classId]
    );
    const statusesByStudent = new Map(students.map((student) => [student.id, {}]));
    for (const log of logs) {
      statusesByStudent.get(log.student_id)[`${log.student_id}:${log.date}`] = log.status;
    }
    return students.map((student) => ({ ...student, statuses: statusesByStudent.get(student.id) ?? {} }));
  });

  ipcMain.handle('attendance:monthlySummary', (_event, { classId, month }) => {
    return all(
      `SELECT
         s.id AS student_id,
         s.lrn,
         s.last_name,
         s.first_name,
         SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_days,
         SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) AS absent_days,
         SUM(CASE WHEN a.status = 'Tardy' THEN 1 ELSE 0 END) AS tardy_days
       FROM Students s
       LEFT JOIN Attendance_Logs a
         ON a.student_id = s.id
        AND substr(a.date, 1, 7) = ?
       WHERE s.class_id = ?
       GROUP BY s.id
       ORDER BY s.last_name, s.first_name`,
      [month, classId]
    );
  });

  ipcMain.handle('forms:exportSf5', (_event, classId) => {
    return exportService.generateSF5(classId);
  });

  ipcMain.handle('forms:exportSf10', (_event, payload) => {
    return exportService.generateSF10(payload);
  });

  ipcMain.handle('forms:exportSf9Batch', (_event, classId) => {
    return exportService.generateSF9Batch(classId);
  });

  ipcMain.handle('forms:exportSf2', (_event, payload) => {
    return exportSf2Attendance(payload);
  });

  ipcMain.handle('awards:listHonorRoll', (_event, classId) => {
    return getHonorRoll(classId);
  });

  ipcMain.handle('awards:generateCertificates', (_event, classId) => {
    return generateHonorCertificates(classId);
  });

  ipcMain.handle('history:list', (_event, studentId) => {
    return all(
      `SELECT *
       FROM Academic_Records_History
       WHERE student_id = ?
       ORDER BY school_year DESC, grade_level`,
      [studentId]
    );
  });

  ipcMain.handle('history:save', (_event, record) => {
    return run(
      `INSERT INTO Academic_Records_History
       (student_id, school_year, grade_level, section, adviser, school_name, school_id, final_rating, action_taken, subject_details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(student_id, school_year, grade_level)
       DO UPDATE SET
         section = excluded.section,
         adviser = excluded.adviser,
         school_name = excluded.school_name,
         school_id = excluded.school_id,
         final_rating = excluded.final_rating,
         action_taken = excluded.action_taken,
         subject_details = excluded.subject_details,
         updated_at = CURRENT_TIMESTAMP`,
      [
        record.student_id,
        record.school_year,
        record.grade_level,
        record.section,
        record.adviser ?? null,
        record.school_name ?? null,
        record.school_id ?? null,
        record.final_rating,
        record.action_taken,
        record.subject_details ?? null
      ]
    );
  });

  ipcMain.handle('sf10:getDraft', (_event, studentId) => {
    return getSf10Draft(studentId);
  });

  ipcMain.handle('sf10:saveDraft', (_event, payload) => {
    return saveSf10Draft(payload);
  });

  ipcMain.handle('history:delete', (_event, record) => {
    return run(
      `DELETE FROM Academic_Records_History
       WHERE student_id = ?
         AND school_year = ?
         AND grade_level = ?`,
      [record.student_id, record.school_year, record.grade_level]
    );
  });

  ipcMain.handle('templates:list', () => {
    return listTemplates();
  });

  ipcMain.handle('templates:upload', async (_event, templateType) => {
    const definition = getTemplateDefinition(templateType);
    const result = await dialog.showOpenDialog({
      title: `Upload ${definition.label} Excel template`,
      buttonLabel: 'Use template',
      properties: ['openFile'],
      filters: [{ name: 'Excel Workbooks', extensions: ['xlsx'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const sourcePath = result.filePaths[0];
    if (path.extname(sourcePath).toLowerCase() !== '.xlsx') {
      throw new Error('Template must be an .xlsx workbook.');
    }

    const targetPath = path.join(getTemplatesPath(), definition.fileName);
    fs.copyFileSync(sourcePath, targetPath);

    return {
      canceled: false,
      template: listTemplates().find((template) => template.type === String(templateType).toLowerCase())
    };
  });

  ipcMain.handle('settings:backupDatabase', () => {
    return backupDatabase();
  });

  ipcMain.handle('settings:restoreDatabase', () => {
    return restoreDatabase();
  });
}

app.whenReady().then(async () => {
  await initializeDatabase();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  try {
    createGhostBackup();
  } catch (error) {
    console.error('Ghost backup failed:', error);
  }
  if (db) db.close();
});
