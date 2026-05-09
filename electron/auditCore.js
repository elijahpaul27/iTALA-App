import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

export const allowedAuditChannels = new Set([
  'get:classes',
  'get:students',
  'get:grades',
  'mutate:gradesBatch',
  'import:students',
  'export:grades',
  'validate:template',
  'backup:create',
  'backup:restore',
  'admin:rollover'
]);

export function assertAllowedAuditChannel(channel) {
  if (!allowedAuditChannels.has(channel)) {
    const error = new Error(`Forbidden IPC channel: ${channel}`);
    error.code = 403;
    throw error;
  }
}

export function assertInteger(value, name, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
}

export function assertSafeFilePath(filePath, allowedExtensions = []) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new Error('File path is required.');
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error('File does not exist.');
  }

  if (allowedExtensions.length > 0 && !allowedExtensions.includes(path.extname(resolved).toLowerCase())) {
    throw new Error(`File must use one of these extensions: ${allowedExtensions.join(', ')}.`);
  }

  return resolved;
}

export function validateGradeBatchPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Payload is required.');
  assertInteger(payload.classId, 'classId');
  assertInteger(payload.quarter, 'quarter', { min: 1, max: 4 });
  if (!Array.isArray(payload.updates)) throw new Error('updates must be an array.');
  if (payload.updates.length === 0) throw new Error('updates must not be empty.');
  if (payload.updates.length > 1000) throw new Error('updates cannot exceed 1000 rows per batch.');

  return payload.updates.map((update, index) => {
    if (!update || typeof update !== 'object') throw new Error(`updates[${index}] must be an object.`);
    assertInteger(update.studentId, `updates[${index}].studentId`);
    assertInteger(update.assessmentId, `updates[${index}].assessmentId`);
    const value = Number(update.value);
    if (!Number.isFinite(value) || value < 0 || value > 1000) {
      throw new Error(`updates[${index}].value must be a non-negative number.`);
    }
    if (update.userId != null) assertInteger(update.userId, `updates[${index}].userId`);
    return {
      studentId: update.studentId,
      assessmentId: update.assessmentId,
      value,
      userId: update.userId ?? null
    };
  });
}

export async function validateGradeTemplate(filePath) {
  const resolved = assertSafeFilePath(filePath, ['.xlsx']);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(resolved);
  const sheet = workbook.worksheets[0];
  const errors = [];

  if (!sheet) {
    return { ok: false, errors: [{ message: 'Workbook does not contain a worksheet.' }] };
  }

  const requiredHeaders = ['LRN', 'Learner', 'FinalGrade'];
  const headerRow = sheet.getRow(1);
  const headers = new Map();
  headerRow.eachCell((cell, colNumber) => {
    headers.set(String(cell.value ?? '').trim(), colNumber);
  });

  for (const header of requiredHeaders) {
    if (!headers.has(header)) errors.push({ row: 1, col: header, message: `Missing header: ${header}` });
  }

  const lrnColumn = headers.get('LRN');
  const finalGradeColumn = headers.get('FinalGrade');
  const seenLrns = new Set();
  if (lrnColumn) {
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const lrn = String(row.getCell(lrnColumn).value ?? '').trim();
      if (!lrn) continue;
      if (!/^\d{12}$/.test(lrn)) errors.push({ row: rowNumber, col: 'LRN', message: 'LRN must be 12 digits.' });
      if (seenLrns.has(lrn)) errors.push({ row: rowNumber, col: 'LRN', message: 'Duplicate student LRN.' });
      seenLrns.add(lrn);

      if (finalGradeColumn) {
        const finalGrade = row.getCell(finalGradeColumn).value;
        if (finalGrade !== null && finalGrade !== undefined && finalGrade !== '') {
          const numeric = Number(finalGrade);
          if (!Number.isFinite(numeric)) errors.push({ row: rowNumber, col: 'FinalGrade', message: 'FinalGrade must be numeric.' });
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
