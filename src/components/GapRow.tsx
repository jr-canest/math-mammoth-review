import { useState, useEffect, useRef } from 'react';
import { checkAnswer } from '../lib/answerChecker';
import type { GapAnswer } from '../lib/answerChecker';
import ExpressionBuilder from './ExpressionBuilder';

interface GapRowProps {
  problem: {
    id: string;
    label: string;
    display: string;
    group?: string;
    answer: GapAnswer;
    variables?: string[];
  };
  isCorrect: boolean;
  previousAttempts: number;
  savedAnswer?: string;
  onCorrect: (attemptCount: number, answer: string) => void;
  onIncorrect: (attemptCount: number) => void;
  playCorrect: () => void;
  playIncorrect: () => void;
}

// Parse template "{0}(x + 2) = 3x + 6" into segments
type Segment = { type: 'text'; text: string } | { type: 'gap'; index: number };

function parseTemplate(template: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /\{(\d+)\}/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(template)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ type: 'text', text: template.slice(lastIdx, match.index) });
    }
    segments.push({ type: 'gap', index: parseInt(match[1]) });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < template.length) {
    segments.push({ type: 'text', text: template.slice(lastIdx) });
  }

  return segments;
}

export default function GapRow({
  problem,
  isCorrect: initialCorrect,
  previousAttempts,
  savedAnswer,
  onCorrect,
  onIncorrect,
  playCorrect,
  playIncorrect,
}: GapRowProps) {
  const { template, gaps, validSets, layout, tableRows } = problem.answer;
  const segments = parseTemplate(template);
  const builderLabel = (problem.display + ' ' + (problem.group || '')).toLowerCase().includes('equation')
    ? 'Build equation' : 'Build expression';
  // If any gap needs the expression builder, route number gaps through it too
  // so the student gets a single consistent input mechanism per problem.
  const hasTextGap = gaps.some(g => g.inputType === 'text');

  // Initialize gap values from saved answer
  const [values, setValues] = useState<string[]>(() => {
    if (savedAnswer) {
      try {
        const parsed = JSON.parse(savedAnswer) as string[];
        if (Array.isArray(parsed) && parsed.length === gaps.length) return parsed;
      } catch { /* ignore */ }
    }
    return gaps.map(() => '');
  });

  const [isCorrect, setIsCorrect] = useState(initialCorrect);
  const [attempts, setAttempts] = useState(previousAttempts);
  const [showWrong, setShowWrong] = useState(false);
  const [wrongGaps, setWrongGaps] = useState<boolean[]>(gaps.map(() => false));
  const [shaking, setShaking] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [activeGap, setActiveGap] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setIsCorrect(initialCorrect);
    setAttempts(previousAttempts);
    if (initialCorrect && savedAnswer) {
      try {
        const parsed = JSON.parse(savedAnswer) as string[];
        if (Array.isArray(parsed)) setValues(parsed);
      } catch { /* ignore */ }
    }
  }, [initialCorrect, previousAttempts, savedAnswer]);

  const openBuilder = (idx: number) => {
    if (isCorrect) return;
    if (document.querySelector('[data-modal="expression-builder"]')) return;
    setActiveGap(idx);
    setShowBuilder(true);
  };

  const updateValue = (idx: number, val: string) => {
    setValues(prev => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
    setShowWrong(false);
    setWrongGaps(gaps.map(() => false));
  };

  const allFilled = values.every(v => v.trim() !== '');

  // Check a single gap value against its expected value
  const checkGap = (input: string, gapIdx: number, expectedOverride?: string): boolean => {
    const trimmed = input.trim();
    if (!trimmed) return false;
    const gap = gaps[gapIdx];
    const expected = expectedOverride ?? gap.value;
    if (gap.inputType === 'number') {
      if (gap.decimal !== undefined) {
        return checkAnswer(trimmed, {
          type: 'fraction',
          value: expected,
          decimal: gap.decimal,
          tolerance: gap.tolerance ?? 0.001,
        });
      }
      return checkAnswer(trimmed, { type: 'number', value: Number(expected) });
    }
    return checkAnswer(trimmed, { type: 'text', value: expected });
  };

  const handleCheck = () => {
    if (isCorrect || !allFilled) return;

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    let correct = false;

    if (validSets && validSets.length > 0) {
      // Check against any valid set
      correct = validSets.some(set =>
        set.every((expected, idx) => checkGap(values[idx], idx, expected))
      );
    } else {
      // Check each gap individually
      const results = gaps.map((_, idx) => checkGap(values[idx], idx));
      correct = results.every(Boolean);

      if (!correct) {
        setWrongGaps(results.map(r => !r));
      }
    }

    if (correct) {
      setIsCorrect(true);
      setShowWrong(false);
      setWrongGaps(gaps.map(() => false));
      playCorrect();
      onCorrect(newAttempts, JSON.stringify(values.map(v => v.trim())));
    } else {
      setShowWrong(true);
      // For validSets, we can't mark individual gaps wrong — mark all
      if (validSets) setWrongGaps(gaps.map(() => true));
      setShaking(true);
      playIncorrect();
      onIncorrect(newAttempts);
      setTimeout(() => setShaking(false), 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCheck();
  };

  // Display text (e.g., "See workbook." or "24y + 8 =")
  const hasDisplay = problem.display && problem.display !== '';

  const isTableLayout = layout === 'table' && tableRows;

  // ── TABLE LAYOUT ──
  if (isTableLayout) {
    // Collect all gap indices from the table to order input refs
    const gapOrder: number[] = [];
    for (const row of tableRows) {
      for (const cell of row) {
        const m = cell.match(/^\{(\d+)\}$/);
        if (m) gapOrder.push(parseInt(m[1]));
      }
    }

    const focusNextGap = (currentGapIdx: number) => {
      const pos = gapOrder.indexOf(currentGapIdx);
      if (pos >= 0 && pos < gapOrder.length - 1) {
        const nextGap = gapOrder[pos + 1];
        inputRefs.current[nextGap]?.focus();
      }
    };

    return (
      <div className={`rounded-xl border-2 transition-colors
                       ${isCorrect ? 'bg-emerald-50 border-emerald-200'
                         : shaking ? 'animate-shake border-red-300'
                         : 'bg-white border-gray-100'}`}>
        <div className="p-3 sm:p-4">
          {/* Label + display row */}
          <div className="flex items-start gap-2 mb-3">
            <span className="font-mono font-bold text-indigo-600 text-lg shrink-0">
              {problem.label}
            </span>
            <span className="flex-1 text-lg text-gray-800">
              {hasDisplay ? problem.display : ''}
            </span>
            {isCorrect && (
              <span className={`text-2xl animate-pop shrink-0 ${attempts > 1 ? 'opacity-70' : ''}`}>✅</span>
            )}
          </div>

          {/* Table grid */}
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="border-collapse text-center text-sm sm:text-base">
              <tbody>
                {tableRows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, colIdx) => {
                      const gapMatch = cell.match(/^\{(\d+)\}$/);
                      const isHeaderCol = colIdx === 0;
                      const isHeaderRow = rowIdx === 0;
                      const isHeader = isHeaderCol || isHeaderRow;

                      if (gapMatch) {
                        const gapIdx = parseInt(gapMatch[1]);
                        const gap = gaps[gapIdx];
                        const filled = values[gapIdx]?.trim();
                        const isWrong = wrongGaps[gapIdx];

                        return (
                          <td key={colIdx} className="border border-gray-200 p-0">
                            {isCorrect ? (
                              <span className="block px-2 py-1.5 font-semibold text-emerald-700 bg-emerald-50">
                                {filled}
                              </span>
                            ) : gap.inputType === 'text' ? (
                              <button
                                onClick={() => openBuilder(gapIdx)}
                                className={`block w-full min-w-12 px-2 py-1.5 font-medium transition-colors
                                           ${filled
                                             ? isWrong
                                               ? 'bg-red-50 text-red-600'
                                               : 'bg-indigo-50 text-indigo-700'
                                             : 'bg-gray-50 text-gray-400'
                                           }`}
                              >
                                {filled || '___'}
                              </button>
                            ) : (
                              <input
                                ref={el => { inputRefs.current[gapIdx] = el; }}
                                type="text"
                                inputMode={gap.decimal !== undefined ? 'text' : 'decimal'}
                                value={values[gapIdx]}
                                onChange={e => updateValue(gapIdx, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Tab' && !e.shiftKey) {
                                    e.preventDefault();
                                    focusNextGap(gapIdx);
                                  }
                                  handleKeyDown(e);
                                }}
                                className={`w-full min-w-12 px-1 py-1.5 text-center outline-none transition-colors
                                           ${isWrong
                                             ? 'bg-red-50 text-red-600'
                                             : filled
                                             ? 'bg-amber-50 text-amber-800 font-medium'
                                             : 'bg-gray-50 text-gray-700 border-b-2 border-dashed border-gray-300'
                                           }`}
                              />
                            )}
                          </td>
                        );
                      }

                      // Static cell
                      return (
                        <td
                          key={colIdx}
                          className={`border border-gray-200 px-2 py-1.5 whitespace-nowrap
                                     ${isHeader
                                       ? 'bg-indigo-50 font-semibold text-indigo-700'
                                       : 'text-gray-700'
                                     }`}
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Error message */}
          {showWrong && (
            <p className="text-red-500 text-sm font-medium mt-2 px-1">
              Not quite, try again!
            </p>
          )}

          {/* Check button */}
          {!isCorrect && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleCheck}
                disabled={!allFilled}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold
                           active:scale-95 transition-transform
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Check
              </button>
              {attempts > 0 && !showWrong && (
                <span className="text-gray-400 text-sm">({attempts} tries)</span>
              )}
            </div>
          )}

          {/* Correct state: show attempts */}
          {isCorrect && attempts > 1 && (
            <span className="text-amber-500 text-sm font-medium mt-1 block px-1">
              ({attempts} tries)
            </span>
          )}
        </div>

        {/* Expression Builder modal (for text gaps in table) */}
        {showBuilder && (
          <ExpressionBuilder
            variables={problem.variables || []}
            builderLabel={builderLabel}
            initialValue={values[activeGap]}
            problemDisplay={
              problem.group
                ? `${problem.group}\n${problem.display || template}`
                : problem.display || template
            }
            problemLabel={problem.label}
            onDone={(expression) => {
              updateValue(activeGap, expression);
              setShowBuilder(false);
            }}
            onClose={() => setShowBuilder(false)}
          />
        )}
      </div>
    );
  }

  // ── INLINE EQUATION LAYOUT (original) ──
  return (
    <div className={`rounded-xl border-2 transition-colors
                     ${isCorrect ? 'bg-emerald-50 border-emerald-200'
                       : shaking ? 'animate-shake border-red-300'
                       : 'bg-white border-gray-100'}`}>
      <div className="p-3 sm:p-4">
        {/* Label + display row */}
        <div className="flex items-start gap-2 mb-2">
          <span className="text-sm font-bold text-indigo-600 shrink-0">
            {problem.label}
          </span>
          <span className="flex-1 text-lg text-gray-800">
            {hasDisplay ? problem.display : ''}
          </span>
          {isCorrect && (
            <span className={`text-2xl animate-pop shrink-0 ${attempts > 1 ? 'opacity-70' : ''}`}>✅</span>
          )}
        </div>

        {/* Equation with inline gaps */}
        <div className="flex items-center flex-wrap gap-y-1 px-1 text-lg leading-relaxed">
          {segments.flatMap((seg, i): React.ReactElement[] => {
            if (seg.type === 'text') {
              // Support \n in templates as line breaks
              const lines = seg.text.split('\n');
              if (lines.length > 1) {
                const els: React.ReactElement[] = [];
                lines.forEach((line, li) => {
                  if (li > 0) els.push(<div key={`${i}-br-${li}`} className="basis-full h-1" />);
                  if (line) els.push(<span key={`${i}-${li}`} className="whitespace-pre text-gray-800">{line}</span>);
                });
                return els;
              }
              return [
                <span key={i} className="whitespace-pre text-gray-800">
                  {seg.text}
                </span>
              ];
            }

            const gapIdx = seg.index;
            const gap = gaps[gapIdx];
            const filled = values[gapIdx]?.trim();
            const isWrong = wrongGaps[gapIdx];

            // Number gaps render as inline inputs unless the problem also has a
            // text gap — in that case route them through the builder too for consistency.
            if (gap.inputType === 'number' && !isCorrect && !hasTextGap) {
              return [
                <input
                  key={i}
                  ref={el => { inputRefs.current[gapIdx] = el; }}
                  type="text"
                  inputMode={gap.decimal !== undefined ? 'text' : 'decimal'}
                  value={values[gapIdx]}
                  onChange={e => updateValue(gapIdx, e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="___"
                  className={`inline-flex items-center justify-center min-w-14 max-w-20 px-2 py-0.5
                             rounded-lg border-2 border-dashed transition-all text-lg text-center
                             ${isWrong
                               ? 'border-red-400 bg-red-50 text-red-600'
                               : filled
                                 ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                 : 'border-gray-300 bg-gray-50 text-gray-400'
                             }`}
                />
              ];
            }

            return [
              <button
                key={i}
                onClick={() => openBuilder(gapIdx)}
                disabled={isCorrect}
                className={`inline-flex items-center justify-center min-w-10 px-2 py-0.5
                           rounded-lg border-2 border-dashed transition-all text-lg
                           ${isCorrect
                             ? 'border-emerald-300 bg-emerald-100 text-emerald-700 cursor-default'
                             : filled
                               ? isWrong
                                 ? 'border-red-400 bg-red-50 text-red-600'
                                 : 'border-indigo-300 bg-indigo-50 text-indigo-700'
                               : 'border-gray-300 bg-gray-50 text-gray-400 active:scale-95'
                           }`}
              >
                {filled || '___'}
              </button>
            ];
          })}
        </div>

        {/* Error message */}
        {showWrong && (
          <p className="text-red-500 text-sm font-medium mt-2 px-1">
            Not quite, try again!
          </p>
        )}

        {/* Check button */}
        {!isCorrect && (
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleCheck}
              disabled={!allFilled}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold
                         active:scale-95 transition-transform
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Check
            </button>
            {attempts > 0 && !showWrong && (
              <span className="text-gray-400 text-sm">({attempts} tries)</span>
            )}
          </div>
        )}

        {/* Correct state: show attempts */}
        {isCorrect && attempts > 1 && (
          <span className="text-amber-500 text-sm font-medium mt-1 block px-1">
            ({attempts} tries)
          </span>
        )}
      </div>

      {/* Expression Builder modal */}
      {showBuilder && (
        <ExpressionBuilder
          variables={problem.variables || []}
          builderLabel={builderLabel}
          initialValue={values[activeGap]}
          problemDisplay={
            problem.group
              ? `${problem.group}\n${problem.display || template}`
              : problem.display || template
          }
          problemLabel={problem.label}
          onDone={(expression) => {
            updateValue(activeGap, expression);
            setShowBuilder(false);
          }}
          onClose={() => setShowBuilder(false)}
        />
      )}
    </div>
  );
}
