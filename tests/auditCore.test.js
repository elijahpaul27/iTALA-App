import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { assertAllowedAuditChannel, validateGradeBatchPayload, validateGradeTemplate } from '../electron/auditCore.js';

function exec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (error) => (error ? reject(error) : resolve()));
  });
}

describe('audit IPC validation', () => {
  it('accepts whitelisted channels and rejects unknown channels', () => {
    expect(() => assertAllowedAuditChannel('mutate:gradesBatch')).not.toThrow();
    expect(() => assertAllowedAuditChannel('raw:sql')).toThrow(/Forbidden IPC channel/);
  });

  it('strictly validates grade batch payloads', () => {
    const updates = validateGradeBatchPayload({
      classId: 1,
      quarter: 2,
      updates: [{ studentId: 3, assessmentId: 4, value: 18.5 }]
    });

    expect(updates).toEqual([{ studentId: 3, assessmentId: 4, value: 18.5, userId: null }]);
    expect(() => validateGradeBatchPayload({ classId: 1, quarter: 5, updates: [] })).toThrow();
    expect(() => validateGradeBatchPayload({ classId: 1, quarter: 1, updates: [{ studentId: 1, assessmentId: 2, value: -1 }] })).toThrow();
  });
});

describe('audit migration', () => {
  it('is idempotent on a SQLite database', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'itala-migration-'));
    const dbPath = path.join(tempDir, 'test.sqlite3');
    const db = new sqlite3.Database(dbPath);
    const migration = fs.readFileSync(path.join(process.cwd(), 'migrations', '2026-05-apply-audit-and-indexes.sql'), 'utf8');

    await exec(db, `
      CREATE TABLE Teachers (id INTEGER PRIMARY KEY);
      CREATE TABLE Classes (id INTEGER PRIMARY KEY);
      CREATE TABLE Students (id INTEGER PRIMARY KEY);
      CREATE TABLE Assessments (id INTEGER PRIMARY KEY, subject_id INTEGER, quarter INTEGER, type TEXT);
      CREATE TABLE Grades (id INTEGER PRIMARY KEY, student_id INTEGER, assessment_id INTEGER);
    `);
    await exec(db, migration);
    await exec(db, migration);

    await new Promise((resolve, reject) => db.get(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'grade_audit'",
      (error, row) => {
        if (error) reject(error);
        else {
          expect(row.name).toBe('grade_audit');
          resolve();
        }
      }
    ));
    await new Promise((resolve) => db.close(resolve));
  });
});

describe('template validation', () => {
  it('accepts a valid grade template and rejects malformed files', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'itala-template-'));
    const validPath = path.join(tempDir, 'valid.xlsx');
    const invalidPath = path.join(tempDir, 'invalid.xlsx');

    const validWorkbook = new ExcelJS.Workbook();
    const validSheet = validWorkbook.addWorksheet('Grades');
    validSheet.addRow(['LRN', 'Learner', 'FinalGrade']);
    validSheet.addRow(['123456789012', 'Learner One', 90]);
    await validWorkbook.xlsx.writeFile(validPath);

    const invalidWorkbook = new ExcelJS.Workbook();
    const invalidSheet = invalidWorkbook.addWorksheet('Grades');
    invalidSheet.addRow(['LRN', 'Learner']);
    invalidSheet.addRow(['123', 'Learner One']);
    await invalidWorkbook.xlsx.writeFile(invalidPath);

    await expect(validateGradeTemplate(validPath)).resolves.toEqual({ ok: true, errors: [] });
    const invalid = await validateGradeTemplate(invalidPath);
    expect(invalid.ok).toBe(false);
    expect(invalid.errors.some((error) => error.message.includes('Missing header'))).toBe(true);
  });
});
