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

export type Answer = NumberAnswer | FractionAnswer | TextAnswer | WorkbookAnswer;

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
  let s = expr.toLowerCase()
    .replace(/[\u2212\u2013\u2014\u2010]/g, '-')
    .replace(/\s+/g, '');

  // Convert subtraction to addition of negative terms: "a-b" → "a+-b"
  s = s.replace(/-/g, '+-');

  const rawTerms = s.split('+').filter(t => t !== '');
  return rawTerms.map(normalizeTerm).sort();
}

function normalizeTerm(term: string): string {
  // Match: optional sign, optional numeric coefficient, then variable part
  const match = term.match(/^(-?)(\d*\.?\d*)(.*)$/);
  if (!match) return term;

  const sign = match[1];
  const coefStr = match[2];
  const varPart = match[3];

  let coef: number;
  if (!coefStr) {
    coef = sign === '-' ? -1 : 1;
  } else {
    coef = parseFloat(sign + coefStr);
  }

  // Sort variable groups: each letter + optional superscript(s)
  const sortedVar = sortVariableLetters(varPart);

  if (sortedVar === '') return coef.toString();
  if (coef === 1) return sortedVar;
  if (coef === -1) return '-' + sortedVar;
  return coef + sortedVar;
}

function sortVariableLetters(varPart: string): string {
  // Match each letter followed by optional superscript digits (²³⁴ etc.)
  const re = /[a-z][\u00B2\u00B3\u00B9\u2070\u2074-\u2079]*/g;
  const groups = varPart.match(re);
  if (!groups || groups.length <= 1) return varPart;
  return groups.sort().join('');
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

    case 'text': {
      // Normalize both sides: collapse whitespace, unify dash characters
      const normalize = (s: string) =>
        s.toLowerCase()
          .replace(/[\u2212\u2013\u2014\u2010]/g, '-') // minus sign, en/em dash, hyphen → ASCII hyphen
          .replace(/\s+/g, ' ')                         // collapse whitespace
          .replace(/\s*([+\-*/=()÷×·])\s*/g, '$1')      // strip spaces around operators
          .trim();

      // Exact match after normalization
      if (normalize(trimmed) === normalize(answer.value)) return true;

      // Fallback: expression equivalence (commutative reordering of terms)
      return areExpressionsEquivalent(trimmed, answer.value);
    }
  }
}
