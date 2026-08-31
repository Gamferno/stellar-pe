import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

const ROOT_DIR = path.resolve('..');
const CSV_PATH = path.join(ROOT_DIR, 'docs/user-onboarding-feedback.csv');
const XLSX_PATH = path.join(ROOT_DIR, 'docs/user-onboarding-feedback.xlsx');
const RESPONSES_XLSX_PATH = path.join(ROOT_DIR, 'docs/user-feedback-responses.xlsx');

function convertCsvToXlsx() {
  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  const workbook = xlsx.read(csvContent, { type: 'string' });
  
  xlsx.writeFile(workbook, XLSX_PATH);
  xlsx.writeFile(workbook, RESPONSES_XLSX_PATH);
  console.log(`✅ Successfully generated Excel sheets:`);
  console.log(` - ${XLSX_PATH}`);
  console.log(` - ${RESPONSES_XLSX_PATH}`);
}

convertCsvToXlsx();
