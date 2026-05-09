import ExcelJS from 'exceljs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SF5_TEMPLATE_NAME = 'School Form 5 Report on Promotion and Learning Progress Achievement.xlsx';
const SF10_TEMPLATE_NAME = 'School-Form-10-ES-Learners-Academic Permanent-Record_26March2025.xlsx';

const SF5_SHEET_NAME = 'School Form 5 (SF5)';
const SF10_FRONT_SHEET_NAME = 'Front';
const SF10_BACK_SHEET_NAME = 'Back';

const SF5_STUDENT_START_ROW = 13;
const SF5_MAX_STUDENT_ROWS = 20;
const SF5_FIRST_ROW_AFTER_STUDENTS = SF5_STUDENT_START_ROW + SF5_MAX_STUDENT_ROWS;

const SF10_TEMPLATE_MAP = {
  front: {
    personal: {
      lastName: 'E9',
      firstName: 'R9',
      nameExtension: 'AD9',
      middleName: 'AQ9',
      lrn: 'J10',
      birthdate: 'V10',
      sex: 'AT10'
    },
    eligibility: {
      credential: 'F14',
      kinderProgressReport: 'L14',
      eccdChecklist: 'V14',
      kindergartenCertificate: 'AI14',
      schoolName: 'F15',
      schoolId: 'T15',
      schoolAddress: 'Z15',
      peptRating: 'J18',
      peptDate: 'W18',
      otherCredential: 'AQ18',
      testingCenter: 'L19',
      remarks: 'AJ19'
    }
  },
  records: [
  {
    sheet: 'Front',
    header: {
      school: 'D23',
      schoolId: 'S23',
      district: 'D24',
      division: 'I24',
      region: 'T24',
      gradeLevel: 'J25',
      section: 'S25',
      schoolYear: 'S25',
      adviser: 'H26',
      signature: 'R26'
    },
    learningAreaColumn: 'B',
    quarterColumns: ['K', 'L', 'N', 'O'],
    finalRatingColumn: 'P',
    remarksColumn: 'S',
    subjectStartRow: 30,
    subjectEndRow: 44,
    generalAverageRow: 45
  },
  {
    sheet: 'Front',
    header: {
      school: 'X23',
      schoolId: 'AW23',
      district: 'X24',
      division: 'AD24',
      region: 'AX24',
      gradeLevel: 'Z25',
      section: 'AE25',
      schoolYear: 'AU25',
      adviser: 'AC26',
      signature: 'AU26'
    },
    learningAreaColumn: 'V',
    quarterColumns: ['AJ', 'AM', 'AO', 'AR'],
    finalRatingColumn: 'AT',
    remarksColumn: 'AW',
    subjectStartRow: 30,
    subjectEndRow: 44,
    generalAverageRow: 45
  },
  {
    sheet: 'Front',
    header: {
      school: 'D52',
      schoolId: 'S52',
      district: 'D53',
      division: 'I53',
      region: 'T53',
      gradeLevel: 'J54',
      section: 'AE54',
      schoolYear: 'S54',
      adviser: 'H55',
      signature: 'R55'
    },
    learningAreaColumn: 'B',
    quarterColumns: ['K', 'L', 'N', 'O'],
    finalRatingColumn: 'P',
    remarksColumn: 'S',
    subjectStartRow: 59,
    subjectEndRow: 73,
    generalAverageRow: 74
  },
  {
    sheet: 'Front',
    header: {
      school: 'X52',
      schoolId: 'AW52',
      district: 'X53',
      division: 'AD53',
      region: 'AX53',
      gradeLevel: 'Z54',
      section: 'AE54',
      schoolYear: 'AU54',
      adviser: 'AC55',
      signature: 'AU55'
    },
    learningAreaColumn: 'V',
    quarterColumns: ['AJ', 'AM', 'AO', 'AR'],
    finalRatingColumn: 'AT',
    remarksColumn: 'AW',
    subjectStartRow: 59,
    subjectEndRow: 73,
    generalAverageRow: 74
  },
  {
    sheet: 'Back',
    header: {
      school: 'B3',
      schoolId: 'K3',
      district: 'B4',
      division: 'F4',
      region: 'N4',
      gradeLevel: 'B5',
      section: 'F5',
      schoolYear: 'K5',
      adviser: 'B6'
    },
    learningAreaColumn: 'B',
    quarterColumns: ['H', 'I', 'J', 'K'],
    finalRatingColumn: 'L',
    remarksColumn: 'O',
    subjectStartRow: 10,
    subjectEndRow: 24,
    generalAverageRow: 25
  },
  {
    sheet: 'Back',
    header: {
      school: 'S3',
      schoolId: 'AC3',
      district: 'S4',
      division: 'X4',
      region: 'AF4',
      gradeLevel: 'S5',
      section: 'X5',
      schoolYear: 'AC5',
      adviser: 'S6'
    },
    learningAreaColumn: 'S',
    quarterColumns: ['AB', 'AD', 'AE', 'AF'],
    finalRatingColumn: 'AG',
    remarksColumn: 'AH',
    subjectStartRow: 10,
    subjectEndRow: 24,
    generalAverageRow: 25
  },
  {
    sheet: 'Back',
    header: {
      school: 'B32',
      schoolId: 'K32',
      district: 'B33',
      division: 'F33',
      region: 'N33',
      gradeLevel: 'B34',
      section: 'F34',
      schoolYear: 'K34',
      adviser: 'B35'
    },
    learningAreaColumn: 'B',
    quarterColumns: ['H', 'I', 'J', 'K'],
    finalRatingColumn: 'L',
    remarksColumn: 'O',
    subjectStartRow: 39,
    subjectEndRow: 53,
    generalAverageRow: 54
  },
  {
    sheet: 'Back',
    header: {
      school: 'S32',
      schoolId: 'AC32',
      district: 'S33',
      division: 'X33',
      region: 'AF33',
      gradeLevel: 'S34',
      section: 'X34',
      schoolYear: 'AC34',
      adviser: 'S35'
    },
    learningAreaColumn: 'S',
    quarterColumns: ['AB', 'AD', 'AE', 'AF'],
    finalRatingColumn: 'AG',
    remarksColumn: 'AH',
    subjectStartRow: 39,
    subjectEndRow: 53,
    generalAverageRow: 54
  }
  ]
};

const SF10_RECORD_SLOTS = SF10_TEMPLATE_MAP.records;

function setCell(worksheet, address, value) {
  if (!worksheet || !address) return;
  const cell = worksheet.getCell(address);
  const target = cell.isMerged && cell.master ? cell.master : cell;
  target.value = value ?? '';
}

function setMappedCells(worksheet, mapping, values) {
  for (const [key, address] of Object.entries(mapping)) {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      setCell(worksheet, address, values[key]);
    }
  }
}

function getCellText(cell) {
  const value = cell?.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
    if ('text' in value) return String(value.text ?? '');
    if ('result' in value) return String(value.result ?? '');
  }
  return String(value);
}

function normalize(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatName(student) {
  const firstName = [student.first_name, student.name_extn].filter(Boolean).join(' ');
  return [student.last_name, firstName, student.middle_name].filter(Boolean).join(', ');
}

function sanitizeFilePart(value) {
  return String(value ?? '')
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^-+|-+$/g, '') || 'Export';
}

function extractGradeNumber(gradeLevel) {
  const match = String(gradeLevel ?? '').match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

function actionFromAverage(average) {
  const numericAverage = toNumber(average);
  if (numericAverage === null) return '';
  return numericAverage >= 75 ? 'PROMOTED' : 'RETAINED';
}

function remarksFromRating(rating) {
  const numericRating = toNumber(rating);
  if (numericRating === null) return '';
  return numericRating >= 75 ? 'PASSED' : 'FAILED';
}

function descriptorBucket(average) {
  const numericAverage = toNumber(average);
  if (numericAverage === null) return null;
  if (numericAverage <= 74) return 'dnme';
  if (numericAverage <= 79) return 'fs';
  if (numericAverage <= 84) return 's';
  if (numericAverage <= 89) return 'vs';
  return 'o';
}

function subjectNameMatches(templateSubject, databaseSubject) {
  const template = normalize(templateSubject);
  const subject = normalize(databaseSubject);
  return Boolean(template && subject && (template.includes(subject) || subject.includes(template)));
}

function parseSf10SubjectDetails(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sf10SubjectDetailToExportSubject(subject) {
  const quarters = new Map([
    [1, toNumber(subject.q1)],
    [2, toNumber(subject.q2)],
    [3, toNumber(subject.q3)],
    [4, toNumber(subject.q4)]
  ]);

  return {
    subjectName: subject.name,
    quarters,
    finalRating: toNumber(subject.final_rating),
    remarks: subject.remarks ?? ''
  };
}

function ensureWorksheet(workbook, sheetName) {
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new Error(`The template is missing the "${sheetName}" sheet.`);
  }
  return worksheet;
}

function candidateTemplatePaths(app, templateName) {
  const candidates = [];
  const push = (...parts) => candidates.push(path.join(...parts));

  if (app?.getPath) push(app.getPath('userData'), 'templates', templateName);
  if (process.resourcesPath) push(process.resourcesPath, 'templates', templateName);
  if (app?.getAppPath) {
    const appPath = app.getAppPath();
    push(appPath, 'templates', templateName);
    push(appPath, 'src', 'templates', templateName);
    push(appPath, 'assets', 'templates', templateName);
  }
  push(process.cwd(), 'templates', templateName);
  push(process.cwd(), 'src', 'templates', templateName);
  push(os.homedir(), 'Downloads', templateName);

  return [...new Set(candidates)];
}

function resolveTemplatePath(app, templateName) {
  const candidates = candidateTemplatePaths(app, templateName);
  const resolvedPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (resolvedPath) return resolvedPath;

  throw new Error(
    `Missing Excel template: ${templateName}. Place it in the app templates folder, for example "${path.join(process.cwd(), 'templates', templateName)}".`
  );
}

async function loadWorkbook(templatePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  return workbook;
}

function getDocumentsPath(app) {
  if (!app?.getPath) throw new Error('Electron app.getPath is required for exports.');
  const documentsPath = app.getPath('documents');
  fs.mkdirSync(documentsPath, { recursive: true });
  return documentsPath;
}

async function writeWorkbookToDocuments(app, workbook, fileName) {
  const outputPath = path.join(getDocumentsPath(app), fileName);
  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

function summarizeLearnerGrades(students, gradeRows) {
  const byStudent = new Map(students.map((student) => [student.id, { student, subjects: new Map() }]));

  for (const row of gradeRows) {
    const entry = byStudent.get(row.student_id);
    if (!entry) continue;

    if (!entry.subjects.has(row.subject_id)) {
      entry.subjects.set(row.subject_id, {
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        quarters: new Map()
      });
    }

    entry.subjects.get(row.subject_id).quarters.set(Number(row.quarter), toNumber(row.transmuted_grade));
  }

  return students.map((student) => {
    const entry = byStudent.get(student.id);
    const subjects = [...(entry?.subjects.values() ?? [])].map((subject) => {
      const ratings = [...subject.quarters.values()].filter((value) => value !== null);
      const finalRating = ratings.length
        ? Math.round(ratings.reduce((sum, value) => sum + value, 0) / ratings.length)
        : null;
      return { ...subject, finalRating };
    });
    const ratedSubjects = subjects.filter((subject) => subject.finalRating !== null);
    const generalAverage = ratedSubjects.length
      ? Math.round(ratedSubjects.reduce((sum, subject) => sum + subject.finalRating, 0) / ratedSubjects.length)
      : null;
    const failedSubjects = ratedSubjects
      .filter((subject) => subject.finalRating < 75)
      .map((subject) => subject.subjectName);

    return { student, subjects, generalAverage, failedSubjects, actionTaken: actionFromAverage(generalAverage) };
  });
}

function sortedStudentsForSf5(students) {
  return [...students].sort((a, b) => {
    const sexOrder = { M: 0, F: 1 };
    return (
      (sexOrder[a.sex] ?? 2) - (sexOrder[b.sex] ?? 2) ||
      String(a.last_name).localeCompare(String(b.last_name)) ||
      String(a.first_name).localeCompare(String(b.first_name)) ||
      String(a.middle_name ?? '').localeCompare(String(b.middle_name ?? ''))
    );
  });
}

async function getClassExportData(db, classId) {
  const classRecord = await db.get(
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

  if (!classRecord) throw new Error('Class not found.');

  const students = await db.all(
    `SELECT *
     FROM Students
     WHERE class_id = ?
     ORDER BY sex, last_name, first_name, middle_name`,
    [classId]
  );

  const gradeRows = await db.all(
    `SELECT *
     FROM v_quarterly_grade_summary
     WHERE class_id = ?
     ORDER BY last_name, first_name, subject_name, quarter`,
    [classId]
  );

  return { classRecord, students, gradeRows };
}

async function getStudentExportData(db, studentId) {
  const student = await db.get(
    `SELECT
       s.*,
       c.id AS current_class_id,
       c.grade_level AS current_grade_level,
       c.section AS current_section,
       c.school_year AS current_school_year,
       c.curriculum AS current_curriculum,
       t.name AS teacher_name,
       t.school_name,
       t.school_id
     FROM Students s
     JOIN Classes c ON c.id = s.class_id
     JOIN Teachers t ON t.id = c.teacher_id
     WHERE s.id = ?`,
    [studentId]
  );

  if (!student) throw new Error('Learner not found.');

  const currentGradeRows = await db.all(
    `SELECT *
     FROM v_quarterly_grade_summary
     WHERE student_id = ?
     ORDER BY subject_name, quarter`,
    [studentId]
  );

  const historyRows = await db.all(
    `SELECT *
     FROM Academic_Records_History
     WHERE student_id = ?
     ORDER BY school_year, grade_level`,
    [studentId]
  );

  return { student, currentGradeRows, historyRows };
}

function currentClassRecordFromStudent(student) {
  return {
    grade_level: student.current_grade_level,
    section: student.current_section,
    school_year: student.current_school_year,
    curriculum: student.current_curriculum,
    teacher_name: student.teacher_name,
    school_name: student.school_name,
    school_id: student.school_id
  };
}

function buildCurrentAcademicRecord(student, currentGradeRows) {
  const summary = summarizeLearnerGrades([student], currentGradeRows)[0];
  return {
    source: 'current',
    school_name: student.school_name,
    school_id: student.school_id,
    teacher_name: student.teacher_name,
    grade_level: student.current_grade_level,
    section: student.current_section,
    school_year: student.current_school_year,
    final_rating: summary.generalAverage,
    action_taken: summary.actionTaken,
    subjects: summary.subjects
  };
}

function buildHistoryAcademicRecords(student, historyRows) {
  return historyRows.map((history) => {
    const subjects = parseSf10SubjectDetails(history.subject_details).map(sf10SubjectDetailToExportSubject);

    return {
      source: 'history',
      school_name: history.school_name || student.school_name,
      school_id: history.school_id || student.school_id,
      teacher_name: history.adviser || student.teacher_name,
      grade_level: history.grade_level,
      section: history.section,
      school_year: history.school_year,
      final_rating: toNumber(history.final_rating),
      action_taken: history.action_taken,
      subjects
    };
  });
}

function mergeAcademicRecords(student, currentGradeRows, historyRows) {
  const recordsByKey = new Map();

  for (const record of buildHistoryAcademicRecords(student, historyRows)) {
    recordsByKey.set(`${record.school_year}:${record.grade_level}`, record);
  }

  const currentRecord = buildCurrentAcademicRecord(student, currentGradeRows);
  recordsByKey.set(`${currentRecord.school_year}:${currentRecord.grade_level}`, currentRecord);

  return [...recordsByKey.values()].sort((a, b) => {
    const gradeDifference = extractGradeNumber(a.grade_level) - extractGradeNumber(b.grade_level);
    if (gradeDifference !== 0) return gradeDifference;
    return String(a.school_year).localeCompare(String(b.school_year));
  });
}

function mapSf5Header(worksheet, classRecord, rowOffset = 0) {
  setCell(worksheet, 'C3', classRecord.region ?? '');
  setCell(worksheet, 'E3', classRecord.division ?? '');
  setCell(worksheet, 'J3', classRecord.district ?? '');
  setCell(worksheet, 'C5', classRecord.school_id);
  setCell(worksheet, 'G5', classRecord.school_year);
  setCell(worksheet, 'J5', classRecord.curriculum);
  setCell(worksheet, 'C7', classRecord.school_name);
  setCell(worksheet, 'J7', classRecord.grade_level);
  setCell(worksheet, 'M7', classRecord.section);
  setCell(worksheet, `L${36 + rowOffset}`, classRecord.teacher_name);
}

function prepareSf5StudentRows(worksheet, studentCount) {
  const rowOffset = Math.max(0, studentCount - SF5_MAX_STUDENT_ROWS);
  if (rowOffset > 0) {
    worksheet.duplicateRow(SF5_FIRST_ROW_AFTER_STUDENTS - 1, rowOffset, true);
  }
  return rowOffset;
}

function clearSf5StudentRows(worksheet, studentRowCount) {
  for (let index = 0; index < studentRowCount; index += 1) {
    const row = SF5_STUDENT_START_ROW + index;
    ['A', 'B', 'F', 'G', 'I'].forEach((column) => setCell(worksheet, `${column}${row}`, ''));
    if (row >= SF5_FIRST_ROW_AFTER_STUDENTS) {
      ['C', 'D', 'E', 'H', 'J', 'K', 'L', 'M', 'N', 'O'].forEach((column) => setCell(worksheet, `${column}${row}`, ''));
    }
  }
}

function mapSf5Students(worksheet, learnerSummaries) {
  const studentRowCount = Math.max(SF5_MAX_STUDENT_ROWS, learnerSummaries.length);
  const counts = {
    promoted: { M: 0, F: 0 },
    retained: { M: 0, F: 0 },
    descriptors: {
      dnme: { M: 0, F: 0 },
      fs: { M: 0, F: 0 },
      s: { M: 0, F: 0 },
      vs: { M: 0, F: 0 },
      o: { M: 0, F: 0 }
    }
  };

  clearSf5StudentRows(worksheet, studentRowCount);

  learnerSummaries.forEach((entry, index) => {
    const row = SF5_STUDENT_START_ROW + index;
    setCell(worksheet, `A${row}`, entry.student.lrn);
    setCell(worksheet, `B${row}`, formatName(entry.student));
    setCell(worksheet, `F${row}`, entry.generalAverage ?? '');
    setCell(worksheet, `G${row}`, entry.actionTaken);
    setCell(worksheet, `I${row}`, entry.failedSubjects.join(', '));

    if (entry.actionTaken === 'PROMOTED') counts.promoted[entry.student.sex] += 1;
    if (entry.actionTaken === 'RETAINED') counts.retained[entry.student.sex] += 1;

    const bucket = descriptorBucket(entry.generalAverage);
    if (bucket) counts.descriptors[bucket][entry.student.sex] += 1;
  });

  return counts;
}

function mapSf5Summary(worksheet, students, counts, rowOffset = 0) {
  const summaryRows = [
    ['promoted', 15],
    ['retained', 19]
  ];

  for (const [key, row] of summaryRows) {
    const male = counts[key].M;
    const female = counts[key].F;
    setCell(worksheet, `M${row}`, male);
    setCell(worksheet, `N${row}`, female);
    setCell(worksheet, `O${row}`, male + female);
  }

  const descriptorRows = { dnme: 24, fs: 26, s: 28, vs: 30, o: 32 };
  for (const [bucket, row] of Object.entries(descriptorRows)) {
    const male = counts.descriptors[bucket].M;
    const female = counts.descriptors[bucket].F;
    setCell(worksheet, `M${row}`, male);
    setCell(worksheet, `N${row}`, female);
    setCell(worksheet, `O${row}`, male + female);
  }

  const maleCount = students.filter((student) => student.sex === 'M').length;
  const femaleCount = students.filter((student) => student.sex === 'F').length;
  const totalRow = SF5_FIRST_ROW_AFTER_STUDENTS + rowOffset;
  setCell(worksheet, `F${totalRow}`, maleCount);
  setCell(worksheet, `F${totalRow + 1}`, femaleCount);
  setCell(worksheet, `F${totalRow + 2}`, maleCount + femaleCount);
}

function mapSf10PersonalInformation(front, student) {
  setMappedCells(front, SF10_TEMPLATE_MAP.front.personal, {
    lastName: student.last_name,
    firstName: student.first_name,
    nameExtension: student.name_extn,
    middleName: student.middle_name,
    lrn: student.lrn,
    birthdate: student.birthdate,
    sex: student.sex
  });
}

function mapSf10Eligibility(front, student, classRecord) {
  const credential = student.eligibility_credential ?? '';
  const normalizedCredential = normalize(credential);
  const eligibilityMap = SF10_TEMPLATE_MAP.front.eligibility;
  const knownCredentialCells = [
    [eligibilityMap.kinderProgressReport, 'kinderprogressreport'],
    [eligibilityMap.eccdChecklist, 'eccdchecklist'],
    [eligibilityMap.kindergartenCertificate, 'kindergartencertificateofcompletion']
  ];

  for (const [address, expected] of knownCredentialCells) {
    if (normalizedCredential.includes(expected)) setCell(front, address, `${getCellText(front.getCell(address))} /`);
  }

  if (credential && !knownCredentialCells.some(([, expected]) => normalizedCredential.includes(expected))) {
    setCell(front, eligibilityMap.otherCredential, credential);
  }

  setMappedCells(front, eligibilityMap, {
    credential,
    schoolName: student.eligibility_school_name ?? classRecord.school_name,
    schoolId: student.eligibility_school_id ?? classRecord.school_id,
    schoolAddress: student.eligibility_school_address ?? classRecord.school_address ?? '',
    peptRating: student.pept_rating ?? '',
    peptDate: student.pept_date ?? '',
    otherCredential: student.other_credential ?? '',
    testingCenter: student.testing_center ?? '',
    remarks: [student.als_rating ? `ALS A&E Rating: ${student.als_rating}` : '', student.eligibility_remarks ?? ''].filter(Boolean).join(' / ')
  });
}

function mapSf10RecordHeader(worksheet, slot, record) {
  if (slot.sheet === 'Back') {
    setCell(worksheet, slot.header.school, `School: ${record.school_name ?? ''}`);
    setCell(worksheet, slot.header.schoolId, `School ID: ${record.school_id ?? ''}`);
    setCell(worksheet, slot.header.district, `District: ${record.district ?? ''}  Division: ${record.division ?? ''}`);
    setCell(worksheet, slot.header.region, `Region: ${record.region ?? ''}`);
    setCell(worksheet, slot.header.gradeLevel, `Classified as Grade: ${record.grade_level ?? ''}  Section: ${record.section ?? ''}`);
    setCell(worksheet, slot.header.schoolYear, `School Year: ${record.school_year ?? ''}`);
    setCell(worksheet, slot.header.adviser, `Name of Adviser/Teacher: ${record.teacher_name ?? ''}`);
    return;
  }

  setMappedCells(worksheet, slot.header, {
    school: record.school_name ?? '',
    schoolId: record.school_id ?? '',
    district: record.district ?? '',
    division: record.division ?? '',
    region: record.region ?? '',
    gradeLevel: record.grade_level ?? '',
    section: record.section ?? '',
    schoolYear: record.school_year ?? '',
    adviser: record.teacher_name ?? '',
    signature: ''
  });
}

function mapSf10Subjects(worksheet, slot, record) {
  for (let row = slot.subjectStartRow; row <= slot.subjectEndRow; row += 1) {
    const templateSubject = getCellText(worksheet.getCell(`${slot.learningAreaColumn}${row}`));
    const subject = record.subjects.find((item) => subjectNameMatches(templateSubject, item.subjectName));
    if (!subject) continue;

    slot.quarterColumns.forEach((column, quarterIndex) => {
      setCell(worksheet, `${column}${row}`, subject.quarters.get(quarterIndex + 1) ?? '');
    });
    setCell(worksheet, `${slot.finalRatingColumn}${row}`, subject.finalRating ?? '');
    setCell(worksheet, `${slot.remarksColumn}${row}`, subject.remarks || remarksFromRating(subject.finalRating));
  }
}

function mapSf10GeneralAverage(worksheet, slot, record) {
  setCell(worksheet, `${slot.finalRatingColumn}${slot.generalAverageRow}`, record.final_rating ?? '');
  setCell(worksheet, `${slot.remarksColumn}${slot.generalAverageRow}`, record.action_taken ?? actionFromAverage(record.final_rating));
}

function mapSf10AcademicRecords(workbook, records) {
  records.slice(0, SF10_RECORD_SLOTS.length).forEach((record, index) => {
    const slot = SF10_RECORD_SLOTS[index];
    const worksheet = ensureWorksheet(workbook, slot.sheet);
    mapSf10RecordHeader(worksheet, slot, record);
    mapSf10Subjects(worksheet, slot, record);
    mapSf10GeneralAverage(worksheet, slot, record);
  });
}

export function createExportService({ app, db }) {
  if (!db?.get || !db?.all) {
    throw new Error('Export service requires database get() and all() helpers.');
  }

  async function generateSF5(classId) {
    const templatePath = resolveTemplatePath(app, SF5_TEMPLATE_NAME);
    const { classRecord, students, gradeRows } = await getClassExportData(db, classId);
    const sortedStudents = sortedStudentsForSf5(students);
    const sortedSummaries = summarizeLearnerGrades(sortedStudents, gradeRows);

    const workbook = await loadWorkbook(templatePath);
    const worksheet = ensureWorksheet(workbook, SF5_SHEET_NAME);
    const rowOffset = prepareSf5StudentRows(worksheet, sortedSummaries.length);

    mapSf5Header(worksheet, classRecord, rowOffset);
    const counts = mapSf5Students(worksheet, sortedSummaries);
    mapSf5Summary(worksheet, students, counts, rowOffset);

    const gradeLevel = String(classRecord.grade_level ?? '').replace(/^grade\s*/i, '');
    const fileName = `SF5_Grade${sanitizeFilePart(gradeLevel)}_${sanitizeFilePart(classRecord.section)}.xlsx`;
    const filePath = await writeWorkbookToDocuments(app, workbook, fileName);
    return { canceled: false, filePath };
  }

  async function generateSF10(studentIdOrPayload) {
    const studentId = typeof studentIdOrPayload === 'object' ? studentIdOrPayload.studentId : studentIdOrPayload;
    const templatePath = resolveTemplatePath(app, SF10_TEMPLATE_NAME);
    const { student, currentGradeRows, historyRows } = await getStudentExportData(db, studentId);
    const classRecord = currentClassRecordFromStudent(student);
    const records = mergeAcademicRecords(student, currentGradeRows, historyRows);

    const workbook = await loadWorkbook(templatePath);
    const front = ensureWorksheet(workbook, SF10_FRONT_SHEET_NAME);
    ensureWorksheet(workbook, SF10_BACK_SHEET_NAME);

    mapSf10PersonalInformation(front, student);
    mapSf10Eligibility(front, student, classRecord);
    mapSf10AcademicRecords(workbook, records);

    const fileName = `SF10_${sanitizeFilePart(student.last_name)}_${sanitizeFilePart(student.first_name)}.xlsx`;
    const filePath = await writeWorkbookToDocuments(app, workbook, fileName);
    return { canceled: false, filePath };
  }

  async function generateSF9Batch(classId) {
    const { classRecord, students, gradeRows } = await getClassExportData(db, classId);
    const summaries = summarizeLearnerGrades(students, gradeRows);
    const rowsByStudent = new Map();
    for (const row of gradeRows) {
      if (!rowsByStudent.has(row.student_id)) rowsByStudent.set(row.student_id, []);
      rowsByStudent.get(row.student_id).push(row);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'iTALA';
    workbook.created = new Date();

    for (const summary of summaries) {
      const student = summary.student;
      const title = `${student.last_name}_${student.first_name}`.slice(0, 31).replace(/[\\/?*[\]:]/g, '_');
      const worksheet = workbook.addWorksheet(title || `Learner_${student.id}`, {
        pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      });
      worksheet.columns = [
        { width: 28 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 12 },
        { width: 14 }
      ];
      worksheet.addRow(['School Form 9 - Learner Progress Report Card']);
      worksheet.addRow([classRecord.school_name, `School ID: ${classRecord.school_id}`, classRecord.school_year]);
      worksheet.addRow([`Learner: ${formatName(student)}`, `LRN: ${student.lrn}`, `${classRecord.grade_level} - ${classRecord.section}`]);
      worksheet.addRow([]);
      worksheet.addRow(['Learning Area', 'Q1', 'Q2', 'Q3', 'Q4', 'Final', 'Remarks']);

      const subjectRows = new Map();
      for (const row of rowsByStudent.get(student.id) ?? []) {
        if (!subjectRows.has(row.subject_id)) {
          subjectRows.set(row.subject_id, {
            subject: row.subject_name,
            quarters: new Map()
          });
        }
        subjectRows.get(row.subject_id).quarters.set(Number(row.quarter), toNumber(row.transmuted_grade));
      }

      for (const subject of subjectRows.values()) {
        const values = [1, 2, 3, 4].map((quarter) => subject.quarters.get(quarter) ?? '');
        const rated = values.filter((value) => value !== '');
        const finalRating = rated.length ? Math.round(rated.reduce((sum, value) => sum + value, 0) / rated.length) : '';
        worksheet.addRow([subject.subject, ...values, finalRating, remarksFromRating(finalRating)]);
      }

      worksheet.addRow([]);
      worksheet.addRow(['General Average', '', '', '', '', summary.generalAverage ?? '', summary.actionTaken]);
      worksheet.mergeCells(1, 1, 1, 7);
      worksheet.getRow(1).font = { bold: true, size: 16 };
      worksheet.getRow(5).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C5FBD' } };
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
    }

    const gradeLevel = String(classRecord.grade_level ?? '').replace(/^grade\s*/i, '');
    const fileName = `SF9_Batch_Grade${sanitizeFilePart(gradeLevel)}_${sanitizeFilePart(classRecord.section)}.xlsx`;
    const filePath = await writeWorkbookToDocuments(app, workbook, fileName);
    return { canceled: false, filePath, count: students.length };
  }

  return { generateSF5, generateSF9Batch, generateSF10 };
}
