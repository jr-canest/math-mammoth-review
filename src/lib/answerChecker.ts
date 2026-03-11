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

export type Answer = NumberAnswer | FractionAnswer | TextAnswer;

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

    case 'text': {
      return trimmed.toLowerCase() === answer.value.toLowerCase();
    }
  }
}
