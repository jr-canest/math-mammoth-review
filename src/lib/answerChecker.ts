export interface NumberAnswer {
  type: 'number';
  value: number;
  tolerance?: number;
}

export interface FractionAnswer {
  type: 'fraction';
  value: string;
  decimal: number;
  tolerance?: number;
}

export interface TextAnswer {
  type: 'text';
  value: string;
}

export interface WorkbookAnswer {
  type: 'workbook';
  hint?: string;
}

export interface MultiselectAnswer {
  type: 'multiselect';
  options: string[];
  correct: string[];
}

export interface DualField {
  label: string;
  value: string;
  inputType: 'text' | 'number';
  decimal?: number;      // If present, use fraction checking instead of number
  tolerance?: number;    // For fraction comparison (default 0.001)
}

export interface DualAnswer {
  type: 'dual';
  layout?: 'table';
  fields: DualField[];
}

export interface MeasureAnswer {
  type: 'measure';
  value: string;       // e.g. "11 m 4.5 cm"
  units: string[];     // e.g. ["m", "cm"] — determines builder buttons
  tolerance?: number;  // base-unit tolerance, default 0.01
}

export interface GapField {
  value: string;
  inputType: 'number' | 'text';
  decimal?: number;      // If present, use fraction checking instead of number
  tolerance?: number;    // For fraction comparison (default 0.001)
}

export interface GapAnswer {
  type: 'gap';
  template: string;       // e.g. "{0}(x + 2) = 3x + 6" — {n} marks gap positions
  gaps: GapField[];       // one per {n} placeholder
  validSets?: string[][]; // alternative valid answer combinations
  layout?: 'table';       // render as a grid table instead of inline equation
  tableRows?: string[][]; // rows of cells; cells matching {n} become gap inputs
}

export type Answer = NumberAnswer | FractionAnswer | TextAnswer | WorkbookAnswer | MultiselectAnswer | DualAnswer | MeasureAnswer | GapAnswer;

function parseNumber(input: string): number | null {
  const cleaned = input.replace(/,/g, '').replace(/\s/g, '');
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

function parseFraction(input: string): number | null {
  const trimmed = input.trim();

  // Try as a plain number first
  const asNum = parseNumber(trimmed);
  if (asNum !== null) return asNum;

  // Mixed number: "4 1/5"
  const mixedMatch = trimmed.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const num = parseInt(mixedMatch[2]);
    const den = parseInt(mixedMatch[3]);
    if (den === 0) return null;
    const sign = whole < 0 ? -1 : 1;
    return whole + sign * (num / den);
  }

  // Simple fraction: "21/5"
  const fracMatch = trimmed.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (fracMatch) {
    const num = parseInt(fracMatch[1]);
    const den = parseInt(fracMatch[2]);
    if (den === 0) return null;
    return num / den;
  }

  return null;
}

/** Convert caret exponent notation (e.g. x^2, w^4) to Unicode superscripts */
function caretToSuperscript(s: string): string {
  const superDigits: Record<string, string> = {
    '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3',
    '4': '\u2074', '5': '\u2075', '6': '\u2076', '7': '\u2077',
    '8': '\u2078', '9': '\u2079',
  };
  return s.replace(/\^(\d+)/g, (_, digits: string) =>
    [...digits].map(d => superDigits[d] ?? d).join('')
  );
}

/**
 * Check if two algebraic expressions are equivalent by comparing
 * their terms as sorted sets (handles commutative addition and
 * alphabetical reordering of variables within products).
 */
function areExpressionsEquivalent(a: string, b: string): boolean {
  const termsA = parseExpressionTerms(a);
  const termsB = parseExpressionTerms(b);
  if (termsA.length !== termsB.length) return false;
  return termsA.join('\0') === termsB.join('\0');
}

function parseExpressionTerms(expr: string): string[] {
  const s = caretToSuperscript(expr).toLowerCase()
    .replace(/[\u2212\u2013\u2014\u2010]/g, '-')
    .replace(/÷/g, '/')
    .replace(/\s+/g, '');

  // Split at top-level '+' and '-', respecting parentheses depth
  const terms: string[] = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    if (s[i] === ')') depth--;

    if (depth === 0 && i > 0 && (s[i] === '+' || s[i] === '-')) {
      if (current) terms.push(current);
      current = s[i] === '-' ? '-' : '';
    } else {
      current += s[i];
    }
  }
  if (current) terms.push(current);

  return terms.map(normalizeTerm).sort();
}

/**
 * Extract multiplicative factors from an expression string.
 * Factors are: numbers, variables (letter + optional superscripts),
 * or parenthesized groups. × · * are treated as separators.
 */
function extractFactors(expr: string): string[] {
  const factors: string[] = [];
  let i = 0;
  while (i < expr.length) {
    // Skip multiplication signs (treated as implicit multiplication)
    if (expr[i] === '\u00D7' || expr[i] === '\u00B7' || expr[i] === '\u22C5' || expr[i] === '*') {
      i++;
      continue;
    }
    if (expr[i] === '(') {
      let depth = 1;
      let j = i + 1;
      while (j < expr.length && depth > 0) {
        if (expr[j] === '(') depth++;
        if (expr[j] === ')') depth--;
        j++;
      }
      factors.push(expr.slice(i, j));
      i = j;
    } else if (/\d/.test(expr[i])) {
      let j = i;
      while (j < expr.length && /[\d.]/.test(expr[j])) j++;
      factors.push(expr.slice(i, j));
      i = j;
    } else if (/[a-z]/.test(expr[i])) {
      let j = i + 1;
      while (j < expr.length && /[\u00B2\u00B3\u00B9\u2070\u2074-\u2079]/.test(expr[j])) j++;
      factors.push(expr.slice(i, j));
      i = j;
    } else {
      i++;
    }
  }
  return factors;
}

/** Normalize content inside parenthesized groups by sorting their additive terms */
function normalizeFactorContent(factor: string): string {
  if (factor.startsWith('(') && factor.endsWith(')')) {
    const inner = factor.slice(1, -1);
    const terms = parseExpressionTerms(inner);
    let result = '';
    for (const t of terms) {
      if (result && !t.startsWith('-')) {
        result += '+';
      }
      result += t;
    }
    return '(' + result + ')';
  }
  return factor;
}

/** Sort factors: numbers first, then variables, then parenthesized groups */
function factorCompare(a: string, b: string): number {
  const typeOf = (s: string) => s.startsWith('(') ? 2 : /^\d/.test(s) ? 0 : 1;
  const aType = typeOf(a);
  const bType = typeOf(b);
  if (aType !== bType) return aType - bType;
  if (aType === 0) return parseFloat(a) - parseFloat(b);
  return a < b ? -1 : a > b ? 1 : 0;
}

function normalizeTerm(term: string): string {
  let sign = '';
  let rest = term;
  if (rest.startsWith('-')) {
    sign = '-';
    rest = rest.slice(1);
  }

  // Find top-level '/' to separate numerator and denominator
  let slashIdx = -1;
  let depth = 0;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '(') depth++;
    if (rest[i] === ')') depth--;
    if (depth === 0 && rest[i] === '/') {
      slashIdx = i;
      break;
    }
  }

  let numerator: string;
  let denominator: string | null = null;

  if (slashIdx >= 0) {
    numerator = rest.slice(0, slashIdx);
    denominator = rest.slice(slashIdx + 1);
  } else {
    numerator = rest;
  }

  const numFactors = extractFactors(numerator).map(normalizeFactorContent);
  numFactors.sort(factorCompare);

  let result = sign + numFactors.join('');

  if (denominator !== null) {
    const denFactors = extractFactors(denominator).map(normalizeFactorContent);
    denFactors.sort(factorCompare);
    result += '/' + denFactors.join('');
  }

  return result;
}

// ── Measure (compound unit) helpers ──

const UNIT_CONVERSIONS: Record<string, { base: string; factor: number }> = {
  // Length → base: mm
  km:  { base: 'mm', factor: 1_000_000 },
  m:   { base: 'mm', factor: 1_000 },
  cm:  { base: 'mm', factor: 10 },
  mm:  { base: 'mm', factor: 1 },
  // Weight → base: g
  kg:  { base: 'g', factor: 1_000 },
  g:   { base: 'g', factor: 1 },
  // Volume → base: mL
  L:   { base: 'mL', factor: 1_000 },
  mL:  { base: 'mL', factor: 1 },
};

interface UnitPair { value: number; unit: string; }

function parseMeasure(input: string): UnitPair[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const pairs: UnitPair[] = [];
  // Order: longest-first to avoid 'm' matching before 'mm'/'mL'
  const regex = /(-?\d+(?:\.\d+)?)\s*(km|cm|mm|kg|mL|m|g|L)\b/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(trimmed)) !== null) {
    pairs.push({ value: parseFloat(match[1]), unit: match[2] });
  }

  return pairs.length > 0 ? pairs : null;
}

function measureToBase(pairs: UnitPair[]): { base: string; total: number } | null {
  if (pairs.length === 0) return null;

  const firstConv = UNIT_CONVERSIONS[pairs[0].unit];
  if (!firstConv) return null;
  const base = firstConv.base;

  let total = 0;
  for (const pair of pairs) {
    const conv = UNIT_CONVERSIONS[pair.unit];
    if (!conv || conv.base !== base) return null; // mismatched unit groups
    total += pair.value * conv.factor;
  }

  return { base, total };
}

export function checkAnswer(input: string, answer: Answer): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  switch (answer.type) {
    case 'number': {
      const parsed = parseNumber(trimmed);
      if (parsed === null) return false;
      const tolerance = answer.tolerance ?? 0;
      return Math.abs(parsed - answer.value) <= tolerance;
    }

    case 'fraction': {
      const parsed = parseFraction(trimmed);
      if (parsed === null) return false;
      const tolerance = answer.tolerance ?? 0.001;
      return Math.abs(parsed - answer.decimal) <= tolerance;
    }

    case 'workbook':
      return true;

    case 'multiselect':
      // Not checked via checkAnswer — handled by MultiSelectRow component
      return false;

    case 'dual':
      // Not checked via checkAnswer — handled by DualAnswerRow component
      return false;

    case 'gap':
      // Not checked via checkAnswer — handled by GapRow component
      return false;

    case 'measure': {
      const inputPairs = parseMeasure(trimmed);
      if (!inputPairs) return false;
      const expectedPairs = parseMeasure(answer.value);
      if (!expectedPairs) return false;
      const inputBase = measureToBase(inputPairs);
      const expectedBase = measureToBase(expectedPairs);
      if (!inputBase || !expectedBase) return false;
      if (inputBase.base !== expectedBase.base) return false;
      const tolerance = answer.tolerance ?? 0.01;
      return Math.abs(inputBase.total - expectedBase.total) <= tolerance;
    }

    case 'text': {
      // Normalize both sides: collapse whitespace, unify dash characters, caret → superscript
      const normalize = (s: string) =>
        caretToSuperscript(s)
          .toLowerCase()
          .replace(/[\u2212\u2013\u2014\u2010]/g, '-') // minus sign, en/em dash, hyphen → ASCII hyphen
          .replace(/÷/g, '/')                           // ÷ → / (treat as equivalent)
          .replace(/>=/g, '≥')                          // ASCII >= → Unicode ≥
          .replace(/<=/g, '≤')                          // ASCII <= → Unicode ≤
          .replace(/\s+/g, ' ')                         // collapse whitespace
          .replace(/\s*([+\-*/=()÷×·⋅<>≤≥])\s*/g, '$1') // strip spaces around operators
          .trim();

      // Exact match after normalization
      if (normalize(trimmed) === normalize(answer.value)) return true;

      // Fallback: expression equivalence (commutative reordering of terms)
      return areExpressionsEquivalent(trimmed, answer.value);
    }
  }
}
