import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

const templateFileName = 'School-Form-10-ES-Learners-Academic Permanent-Record_26March2025.xlsx';

function getCandidatePaths() {
  const explicitPath = process.argv.slice(2).join(' ').trim();
  const candidates = [];
  if (explicitPath) candidates.push(path.resolve(explicitPath));

  candidates.push(
    path.resolve(templateFileName),
    path.resolve('templates', templateFileName),
    path.resolve('resources', templateFileName),
    path.join(os.homedir(), 'AppData', 'Roaming', 'itala', 'templates', templateFileName),
    path.join(os.homedir(), 'AppData', 'Roaming', 'iTALA', 'templates', templateFileName)
  );

  return [...new Set(candidates)];
}

function cellValueToText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text ?? '').join('');
  if (value.text) return String(value.text);
  if (value.result != null) return String(value.result);
  if (value.formula) return `=${value.formula}`;
  return JSON.stringify(value);
}

function getMergeModels(worksheet) {
  if (worksheet.model?.merges?.length) {
    return worksheet.model.merges.map((range) => ({ range }));
  }

  // ExcelJS keeps merge internals private, but this fallback works across common versions.
  const merges = worksheet._merges ? Object.values(worksheet._merges) : [];
  return merges.map((merge) => ({ range: merge.range }));
}

function topLeftAddress(range) {
  const start = String(range).split(':')[0];
  return start.trim();
}

async function main() {
  const candidates = getCandidatePaths();
  const workbookPath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!workbookPath) {
    console.error('SF10 template was not found.');
    console.error('Tried these paths:');
    for (const candidate of candidates) console.error(`- ${candidate}`);
    console.error('');
    console.error('Usage:');
    console.error('  node scripts/debug-sf10-merged-cells.mjs "C:\\full\\path\\to\\School-Form-10-ES-Learners-Academic Permanent-Record_26March2025.xlsx"');
    process.exit(1);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);

  console.log(`Workbook: ${workbookPath}`);
  console.log(`Worksheets: ${workbook.worksheets.map((sheet) => sheet.name).join(', ')}`);
  console.log('');

  for (const worksheet of workbook.worksheets) {
    const merges = getMergeModels(worksheet);
    console.log(`=== Sheet: ${worksheet.name} ===`);
    console.log(`Dimensions: rows=${worksheet.rowCount}, columns=${worksheet.columnCount}`);
    console.log(`Merged Cell Ranges: ${merges.length}`);

    for (const merge of merges) {
      const address = topLeftAddress(merge.range);
      const cell = worksheet.getCell(address);
      const text = cellValueToText(cell.value).replace(/\s+/g, ' ').trim();
      const styleBits = [];
      if (cell.font?.underline) styleBits.push('underline');
      if (cell.font?.bold) styleBits.push('bold');
      if (cell.alignment?.horizontal) styleBits.push(`align=${cell.alignment.horizontal}`);
      console.log(`${merge.range} | topLeft=${address} | value="${text}" | style=${styleBits.join(',') || 'none'}`);
    }

    console.log('');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
