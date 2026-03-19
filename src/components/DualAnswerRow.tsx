import { useState, useEffect, useRef } from 'react';
import { checkAnswer } from '../lib/answerChecker';
import type { DualAnswer } from '../lib/answerChecker';
import ExpressionBuilder from './ExpressionBuilder';

interface DualAnswerRowProps {
  problem: {
    id: string;
    label: string;
    display: string;
    group?: string;
    answer: DualAnswer;
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

export default function DualAnswerRow({
  problem,
  isCorrect: initialCorrect,
  previousAttempts,
  savedAnswer,
  onCorrect,
  onIncorrect,
  playCorrect,
  playIncorrect,
}: DualAnswerRowProps) {
  const fields = problem.answer.fields;
  const isTableLayout = problem.answer.layout === 'table';
  const builderLabel = (problem.display + ' ' + (problem.group || '')).toLowerCase().includes('equation')
    ? 'Build equation' : 'Build expression';

  // Initialize field values from saved answer
  const [values, setValues] = useState<string[]>(() => {
    if (savedAnswer) {
      try {
        const parsed = JSON.parse(savedAnswer) as string[];
        if (Array.isArray(parsed) && parsed.length === fields.length) return parsed;
      } catch { /* ignore */ }
    }
    return fields.map(() => '');
  });

  const [isCorrect, setIsCorrect] = useState(initialCorrect);
  const [attempts, setAttempts] = useState(previousAttempts);
  const [showWrong, setShowWrong] = useState(false);
  const [wrongFields, setWrongFields] = useState<boolean[]>(fields.map(() => false));
  const [shaking, setShaking] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderFieldIdx, setBuilderFieldIdx] = useState(0);
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

  const updateField = (idx: number, val: string) => {
    setValues(prev => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
    setShowWrong(false);
    setWrongFields(fields.map(() => false));
  };

  const openBuilder = (idx: number) => {
    if (document.querySelector('[data-modal="expression-builder"]')) return;
    setBuilderFieldIdx(idx);
    setShowBuilder(true);
  };

  const allFilled = values.every(v => v.trim() !== '');

  const handleCheck = () => {
    if (isCorrect || !allFilled) return;

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    // Check each field
    const results = fields.map((field, idx) => {
      const input = values[idx].trim();
      if (field.inputType === 'number') {
        if (field.decimal !== undefined) {
          return checkAnswer(input, {
            type: 'fraction',
            value: field.value,
            decimal: field.decimal,
            tolerance: field.tolerance ?? 0.001,
          });
        }
        return checkAnswer(input, { type: 'number', value: Number(field.value) });
      } else {
        return checkAnswer(input, { type: 'text', value: field.value });
      }
    });

    const allCorrectResult = results.every(Boolean);

    if (allCorrectResult) {
      setIsCorrect(true);
      setShowWrong(false);
      setWrongFields(fields.map(() => false));
      playCorrect();
      onCorrect(newAttempts, JSON.stringify(values.map(v => v.trim())));
    } else {
      setShowWrong(true);
      setWrongFields(results.map(r => !r));
      setShaking(true);
      playIncorrect();
      onIncorrect(newAttempts);
      setTimeout(() => setShaking(false), 500);
      // Focus first wrong number field (expression fields use builder)
      const firstWrongNumberIdx = results.findIndex((r, i) => !r && fields[i].inputType === 'number');
      if (firstWrongNumberIdx >= 0) {
        inputRefs.current[firstWrongNumberIdx]?.select();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCheck();
    }
  };

  // Render an expression field (tappable → opens builder)
  const renderExpressionField = (idx: number, compact: boolean) => {
    const hasValue = values[idx].trim() !== '';
    return (
      <button
        onClick={() => openBuilder(idx)}
        className={`${compact ? 'flex-1 min-w-0 px-2 py-1.5' : 'flex-1 min-w-0 px-3 py-2'}
                   rounded-lg border-2 font-medium truncate text-left
                   active:scale-[0.98] transition-all
                   ${hasValue
                     ? compact ? 'text-sm' : 'text-base'
                     : compact ? 'text-base' : 'text-lg'
                   }
                   ${wrongFields[idx]
                     ? 'border-red-400 bg-red-50 text-red-700'
                     : hasValue
                     ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                     : 'border-gray-200 bg-gray-50 text-gray-400'
                   }`}
      >
        {hasValue ? values[idx] : builderLabel}
      </button>
    );
  };

  // Render a number input field
  const renderNumberField = (idx: number, compact: boolean) => (
    <input
      ref={el => { inputRefs.current[idx] = el; }}
      type="text"
      inputMode={fields[idx].decimal !== undefined ? 'text' : 'decimal'}
      value={values[idx]}
      onChange={e => updateField(idx, e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={multiField ? '' : fields[idx].label}
      className={`${compact ? 'flex-1 min-w-0 px-2 py-1.5 text-base' : 'flex-1 min-w-0 px-3 py-2 text-lg'}
                 rounded-lg border-2 text-center
                 focus:outline-none focus:border-indigo-400 transition-colors
                 ${wrongFields[idx] ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
    />
  );

  // Use multi-field card layout when >2 fields, or when 2 fields don't follow
  // the typical "expression = value" pattern (e.g. number + equation combos)
  const isTypicalExprValue = fields.length === 2
    && fields[0].inputType === 'text'
    && fields[1].inputType === 'number';
  const multiField = fields.length > 2 || (fields.length === 2 && !isTypicalExprValue);

  // ── MULTI-FIELD TABLE LAYOUT (4+ fields, e.g. sum/difference/product/quotient) ──
  if (isTableLayout && multiField) {
    return (
      <div
        className={`p-3 rounded-xl transition-colors duration-300 ${
          isCorrect
            ? attempts <= 1
              ? 'bg-emerald-50 border-2 border-emerald-200'
              : 'bg-amber-50 border-2 border-amber-200'
            : 'bg-white border-2 border-gray-100'
        } ${shaking ? 'animate-shake' : ''}`}
      >
        {/* Header: label + display text */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold text-indigo-600 shrink-0">
            {problem.label}
          </span>
          <span className="flex-1 text-base font-medium text-gray-700">
            {problem.display}
          </span>
          {isCorrect && (
            <div className="flex items-center gap-1 shrink-0">
              {attempts > 1 && (
                <span className="text-[10px] text-amber-500 font-medium">
                  {attempts} tries
                </span>
              )}
              <span className={`text-2xl animate-pop ${attempts > 1 ? 'opacity-70' : ''}`}>
                ✅
              </span>
            </div>
          )}
        </div>

        {/* Input fields or answered values */}
        {!isCorrect ? (
          <div className="ml-6 space-y-2">
            {fields.map((field, idx) => (
              <div key={idx} className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-gray-500 w-24 shrink-0">
                  {field.label}:
                </span>
                {field.inputType === 'text'
                  ? renderExpressionField(idx, true)
                  : renderNumberField(idx, true)
                }
                {wrongFields[idx] && (
                  <span className="text-red-400 text-sm shrink-0">✗</span>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleCheck}
                disabled={!allFilled}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-semibold
                           disabled:opacity-40 disabled:cursor-not-allowed
                           active:scale-95 transition-transform text-sm"
              >
                Check
              </button>
              {showWrong && (
                <span className="text-red-500 text-sm font-medium whitespace-nowrap">
                  Not quite!
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="ml-6 flex flex-wrap gap-x-4 gap-y-1">
            {fields.map((field, idx) => (
              <span key={idx} className="text-sm text-gray-500">
                <span className="font-medium">{field.label}:</span>{' '}
                <span className={`font-semibold ${attempts <= 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {values[idx]}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Expression Builder Modal */}
        {showBuilder && (
          <ExpressionBuilder
            variables={problem.variables || []}
            problemLabel={problem.label}
            builderLabel={builderLabel}
            initialValue={values[builderFieldIdx]}
            problemDisplay={
              (problem.group ? `${problem.group}\n` : '') +
              `${problem.display}: ${fields[builderFieldIdx].label}`
            }
            onDone={(expression) => {
              updateField(builderFieldIdx, expression);
              setShowBuilder(false);
              // Focus next empty number field after builder field
              setTimeout(() => {
                const nextEmpty = fields.findIndex(
                  (f, i) => i > builderFieldIdx && f.inputType === 'number' && !values[i]?.trim()
                );
                if (nextEmpty >= 0) inputRefs.current[nextEmpty]?.focus();
              }, 100);
            }}
            onClose={() => setShowBuilder(false)}
          />
        )}
      </div>
    );
  }

  // ── TABLE LAYOUT (2-field, for problem 2-style) ──
  if (isTableLayout) {
    return (
      <div
        className={`p-3 rounded-xl transition-colors duration-300 ${
          isCorrect
            ? attempts <= 1
              ? 'bg-emerald-50 border-2 border-emerald-200'
              : 'bg-amber-50 border-2 border-amber-200'
            : 'bg-white border-2 border-gray-100'
        } ${shaking ? 'animate-shake' : ''}`}
      >
        <div className="flex items-center gap-2">
          {/* Label */}
          <span className="text-sm font-bold text-indigo-600 shrink-0 w-10">
            {problem.label}
          </span>

          {/* Variable (display) */}
          <span className="text-base font-medium text-gray-700 shrink-0 w-14">
            {problem.display}
          </span>

          {isCorrect ? (
            <>
              {/* Show answers inline: expression = value */}
              <div className="flex-1 flex items-center gap-1">
                <span className={`text-base font-semibold ${
                  attempts <= 1 ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {values[0]}
                </span>
                <span className="text-base text-gray-400">=</span>
                <span className={`text-base font-semibold ${
                  attempts <= 1 ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {values[1]}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {attempts > 1 && (
                  <span className="text-[10px] text-amber-500 font-medium">
                    {attempts} tries
                  </span>
                )}
                <span className={`text-2xl animate-pop ${attempts > 1 ? 'opacity-70' : ''}`}>
                  ✅
                </span>
              </div>
            </>
          ) : (
            <>
              {/* Expression field (tappable → builder) */}
              {renderExpressionField(0, true)}

              {/* Equals sign */}
              <span className="text-base text-gray-400 shrink-0">=</span>

              {/* Value field (number input) */}
              {renderNumberField(1, true)}

              <button
                onClick={handleCheck}
                disabled={!allFilled}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm
                           disabled:opacity-40 disabled:cursor-not-allowed
                           active:scale-95 transition-transform shrink-0"
              >
                Check
              </button>
            </>
          )}
        </div>
        {showWrong && (
          <div className="ml-24 mt-1">
            <span className="text-red-500 text-sm font-medium">Not quite!</span>
          </div>
        )}

        {/* Expression Builder Modal */}
        {showBuilder && (
          <ExpressionBuilder
            variables={problem.variables || []}
            problemLabel={problem.label}
            builderLabel={builderLabel}
            initialValue={values[builderFieldIdx]}
            problemDisplay={problem.group ? `${problem.group}\n${problem.display}` : problem.display}
            onDone={(expression) => {
              updateField(builderFieldIdx, expression);
              setShowBuilder(false);
              // Focus value input after closing builder
              setTimeout(() => {
                const valueIdx = fields.findIndex(f => f.inputType === 'number');
                if (valueIdx >= 0) inputRefs.current[valueIdx]?.focus();
              }, 100);
            }}
            onClose={() => setShowBuilder(false)}
          />
        )}
      </div>
    );
  }

  // ── STACKED LAYOUT (for problem 5-style) ──
  return (
    <div
      className={`p-3 rounded-xl transition-colors duration-300 ${
        isCorrect
          ? attempts <= 1
            ? 'bg-emerald-50 border-2 border-emerald-200'
            : 'bg-amber-50 border-2 border-amber-200'
          : 'bg-white border-2 border-gray-100'
      } ${shaking ? 'animate-shake' : ''}`}
    >
      {/* Top row: label + problem text */}
      <div className="flex items-start gap-2 mb-2">
        <span className="text-sm font-bold text-indigo-600 shrink-0 mt-0.5">
          {problem.label}
        </span>
        <span className="flex-1 text-lg text-gray-800">
          {problem.display}
        </span>
        {isCorrect && (
          <div className="flex items-center gap-1 shrink-0">
            {attempts > 1 && (
              <span className="text-[10px] text-amber-500 font-medium">
                {attempts} tries
              </span>
            )}
            <span className={`text-2xl animate-pop ${attempts > 1 ? 'opacity-70' : ''}`}>
              ✅
            </span>
          </div>
        )}
      </div>

      {/* Answer fields */}
      {!isCorrect ? (
        <div className="ml-6 mr-0 space-y-2">
          {fields.map((field, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500 shrink-0">
                {field.label}:
              </span>
              {field.inputType === 'text'
                ? renderExpressionField(idx, false)
                : renderNumberField(idx, false)
              }
              {wrongFields[idx] && (
                <span className="text-red-400 text-sm shrink-0">✗</span>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleCheck}
              disabled={!allFilled}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-semibold
                         disabled:opacity-40 disabled:cursor-not-allowed
                         active:scale-95 transition-transform text-base"
            >
              Check
            </button>
            {showWrong && (
              <span className="text-red-500 text-sm font-medium whitespace-nowrap">
                Not quite!
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="ml-6 flex flex-wrap gap-x-4 gap-y-1">
          {fields.map((field, idx) => (
            <span key={idx} className="text-sm text-gray-500">
              <span className="font-medium">{field.label}:</span>{' '}
              <span className={`font-semibold ${attempts <= 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {values[idx]}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Expression Builder Modal */}
      {showBuilder && (
        <ExpressionBuilder
          variables={problem.variables || []}
          problemLabel={problem.label}
          builderLabel={builderLabel}
          initialValue={values[builderFieldIdx]}
          problemDisplay={problem.display}
          onDone={(expression) => {
            updateField(builderFieldIdx, expression);
            setShowBuilder(false);
            // Focus next empty number input after builder field
            setTimeout(() => {
              const nextEmpty = fields.findIndex(
                (f, i) => i > builderFieldIdx && f.inputType === 'number' && !values[i]?.trim()
              );
              if (nextEmpty >= 0) inputRefs.current[nextEmpty]?.focus();
            }, 100);
          }}
          onClose={() => setShowBuilder(false)}
        />
      )}
    </div>
  );
}
