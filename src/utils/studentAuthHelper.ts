// Robust helper for parsing and matching student names and birth dates

export const MONTH_MAP: Record<string, string> = {
  'jan': '01', 'januari': '01', 'january': '01',
  'feb': '02', 'februari': '02', 'february': '02', 'peb': '02', 'pebruari': '02',
  'mar': '03', 'maret': '03', 'march': '03',
  'apr': '04', 'april': '04',
  'mei': '05', 'may': '05',
  'jun': '06', 'juni': '06', 'june': '06',
  'jul': '07', 'juli': '07', 'july': '07',
  'agu': '08', 'agust': '08', 'agustus': '08', 'aug': '08', 'august': '08',
  'sep': '09', 'sept': '09', 'september': '09',
  'okt': '10', 'oktober': '10', 'oct': '10', 'october': '10',
  'nov': '11', 'nop': '11', 'nopember': '11', 'november': '11',
  'des': '12', 'desember': '12', 'dec': '12', 'december': '12'
};

/**
 * Normalizes any date representation (ISO, YYYY-MM-DD, DD/MM/YYYY, Indonesian text month, Excel serial)
 * into a canonical "YYYY-MM-DD" format for strict, reliable comparison.
 */
export function normalizeDateToYMD(dateStr?: any): string {
  if (!dateStr) return '';
  let str = String(dateStr).trim();
  if (!str || str === '-' || str === 'null' || str === 'undefined') return '';

  // Handle Excel serial date numbers (e.g. 39550 = 2008-04-12)
  if (/^\d{4,6}(\.\d+)?$/.test(str) && Number(str) > 10000 && Number(str) < 60000) {
    try {
      const serial = parseFloat(str);
      const utc_days = Math.floor(serial - 25569);
      const utc_value = utc_days * 86400;
      const date_info = new Date(utc_value * 1000);
      const year = date_info.getUTCFullYear();
      const month = String(date_info.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date_info.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {}
  }

  // Handle ISO string with T or space (e.g. "2008-04-12T00:00:00.000Z" or "2008-04-12 00:00:00")
  if (str.includes('T') || str.includes(' ')) {
    const datePart = str.split(/[T\s]/)[0];
    if (/^\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2}$/.test(datePart)) {
      str = datePart;
    }
  }

  // Standard YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = str.match(/^(\d{4})[\-\/\.](\d{1,2})[\-\/\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Text month: e.g. "12 April 2008", "12-April-2008", "12-Apr-2008", "April 12, 2008"
  const cleanText = str.toLowerCase().replace(/[\,\.\-]/g, ' ').replace(/\s+/g, ' ').trim();
  const textParts = cleanText.split(' ');
  if (textParts.length >= 3) {
    // Pattern A: Day Month Year (e.g. 12 april 2008)
    if (/^\d{1,2}$/.test(textParts[0]) && /^\d{4}$/.test(textParts[2])) {
      const day = textParts[0].padStart(2, '0');
      const mKey = textParts[1];
      const month = MONTH_MAP[mKey];
      const year = textParts[2];
      if (month) return `${year}-${month}-${day}`;
    }
    // Pattern B: Month Day Year (e.g. april 12 2008)
    if (/^\d{1,2}$/.test(textParts[1]) && /^\d{4}$/.test(textParts[2])) {
      const day = textParts[1].padStart(2, '0');
      const mKey = textParts[0];
      const month = MONTH_MAP[mKey];
      const year = textParts[2];
      if (month) return `${year}-${month}-${day}`;
    }
  }

  // Fallback to JS Date parsing
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  } catch {}

  return str;
}

/**
 * Normalizes a name by lowercasing, stripping punctuation, diacritics, and collapsing spaces.
 */
export function normalizeNameForComparison(name?: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9\s]/g, ' ') // replace punctuation (dots, hyphens, commas, apostrophes) with spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Matches student name flexibly against database name.
 * Handles:
 * - Exact normalized match
 * - Substring match ("Ahmad Fauzan" vs "Ahmad Fauzan Ridwan")
 * - Compact match ignoring spaces ("Aisyah Az-Zahra" vs "Aisyah Az Zahra" or "Aisyah Azzahra")
 * - Word token match (all words in input are present in database record)
 * - Abbreviation matching ("M. Farhan" / "Muh. Farhan" vs "Muhammad Farhan")
 */
export function isStudentNameMatch(dbName?: string, inputName?: string): boolean {
  if (!dbName || !inputName) return false;

  const normDb = normalizeNameForComparison(dbName);
  const normInput = normalizeNameForComparison(inputName);

  if (!normDb || !normInput) return false;

  // 1. Exact match
  if (normDb === normInput) return true;

  // 2. Substring match
  if (normDb.includes(normInput) || normInput.includes(normDb)) return true;

  // 3. Compact string match (no spaces)
  const compactDb = normDb.replace(/\s/g, '');
  const compactInput = normInput.replace(/\s/g, '');
  if (compactDb === compactInput || compactDb.includes(compactInput) || compactInput.includes(compactDb)) {
    return true;
  }

  // 4. Token/word match: all input words exist in database name
  const inputWords = normInput.split(' ').filter(w => w.length >= 2);
  const dbWords = normDb.split(' ').filter(w => w.length >= 2);

  if (inputWords.length > 0) {
    const allInputWordsInDb = inputWords.every(iw =>
      dbWords.some(dw => dw === iw || dw.startsWith(iw) || iw.startsWith(dw) || dw.includes(iw))
    );
    if (allInputWordsInDb) return true;
  }

  // 5. Abbreviation matching (e.g. "M. Farhan" / "Muh. Farhan" vs "Muhammad Farhan")
  const firstInputWord = normInput.split(' ')[0];
  const firstDbWord = normDb.split(' ')[0];
  const commonPrefixes = ['m', 'muh', 'md', 'moch', 'muhammad', 'mohammad'];
  if (commonPrefixes.includes(firstInputWord) && commonPrefixes.includes(firstDbWord)) {
    const restInput = normInput.split(' ').slice(1).join(' ').trim();
    const restDb = normDb.split(' ').slice(1).join(' ').trim();
    if (restInput && restDb && (restDb.includes(restInput) || restInput.includes(restDb))) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if database birth date matches user input birth date.
 */
export function isStudentBirthDateMatch(dbBirthDate?: string, inputBirthDate?: string): boolean {
  if (!dbBirthDate || !inputBirthDate) return false;

  const normDb = normalizeDateToYMD(dbBirthDate);
  const normInput = normalizeDateToYMD(inputBirthDate);

  if (!normDb || !normInput) return false;
  if (normDb === normInput) return true;

  // Check swapped MM-DD vs DD-MM with identical year
  const pDb = normDb.split('-');
  const pInput = normInput.split('-');
  if (pDb.length === 3 && pInput.length === 3 && pDb[0] === pInput[0]) {
    if (pDb[1] === pInput[2] && pDb[2] === pInput[1]) {
      return true;
    }
  }

  return false;
}
