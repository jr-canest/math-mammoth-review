import { useState, useRef, useEffect, useCallback } from 'react';
import { checkAnswer } from '../lib/answerChecker';
import type { TextAnswer } from '../lib/answerChecker';

interface ExpressionBuilderProps {
  variables: string[];
  expectedAnswer?: string;
  problemDisplay: string;
  problemLabel?: string;
  /** Pre-populate with an existing expression (for re-editing) */
  initialValue?: string;
  onCorrect?: (expression: string) => void;
  onIncorrect?: () => void;
  /** Capture mode: returns expression without checking. Overrides onCorrect/onIncorrect. */
  onDone?: (expression: string) => void;
  onClose: () => void;
  /** Show inequality symbol buttons (<, >, ≤, ≥) */
  showInequality?: boolean;
  /** Override the modal title label (default: "Build expression") */
  builderLabel?: string;
}

/** Tokenize an expression string back into individual tokens (respecting multi-char variables) */
function tokenize(value: string, variables: string[]): string[] {
  if (!value) return [];
  const sorted = [...variables].sort((a, b) => b.length - a.length); // longest first
  const tokens: string[] = [];
  let i = 0;
  while (i < value.length) {
    // Skip spaces
    if (value[i] === ' ') { i++; continue; }
    // Try to match a variable
    const matched = sorted.find(v => value.startsWith(v, i));
    if (matched) {
      tokens.push(matched);
      i += matched.length;
    } else {
      tokens.push(value[i]);
      i++;
    }
  }
  return tokens;
}

function CalcButton({
  label,
  onClick,
  className = '',
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-h-12 rounded-xl text-lg font-semibold
                  active:scale-95 transition-transform
                  disabled:opacity-40 disabled:cursor-not-allowed
                  ${className || 'bg-white border-2 border-gray-200 text-gray-800'}`}
      style={{ touchAction: 'manipulation' }}
    >
      {label}
    </button>
  );
}

const OPERATORS = new Set(['+', '\u2212', '÷', '\u22C5', '=', '<', '>', '≤', '≥']);

export default function ExpressionBuilder({
  variables,
  expectedAnswer,
  problemDisplay,
  problemLabel,
  initialValue,
  onCorrect,
  onIncorrect,
  onDone,
  onClose,
  showInequality = false,
  builderLabel = 'Build expression',
}: ExpressionBuilderProps) {
  const initialTokens = initialValue ? tokenize(initialValue, variables) : [];
  const [tokens, setTokens] = useState<string[]>(initialTokens);
  const [cursorPos, setCursorPos] = useState(initialTokens.length);
  const cursorRef = useRef(initialTokens.length);
  const [shaking, setShaking] = useState(false);
  const [showWrong, setShowWrong] = useState(false);

  // Lock body scroll while modal is open (prevents touch-through on iPad)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const rawExpression = tokens.join('');

  const moveCursor = (pos: number) => {
    cursorRef.current = pos;
    setCursorPos(pos);
  };

  const handleTap = (value: string) => {
    setShowWrong(false);
    const pos = cursorRef.current;
    setTokens(prev => [...prev.slice(0, pos), value, ...prev.slice(pos)]);
    cursorRef.current = pos + 1;
    setCursorPos(pos + 1);
  };

  const handleBackspace = useCallback(() => {
    const pos = cursorRef.current;
    if (pos === 0) return;
    setShowWrong(false);
    setTokens(prev => [...prev.slice(0, pos - 1), ...prev.slice(pos)]);
    cursorRef.current = pos - 1;
    setCursorPos(pos - 1);
  }, []);

  const handleCursorLeft = () => {
    if (cursorRef.current > 0) moveCursor(cursorRef.current - 1);
  };

  const handleCursorRight = () => {
    if (cursorRef.current < tokens.length) moveCursor(cursorRef.current + 1);
  };

  // Accelerating hold-to-delete: starts after a 500ms hold, then accelerates from 400ms down to 50ms
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteIntervalRef = useRef(400);
  const isTouchRef = useRef(false);

  const stopHoldDelete = useCallback(() => {
    if (deleteTimerRef.current !== null) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    deleteIntervalRef.current = 400;
    // Reset touch flag after a short delay so mouse events stay blocked for this gesture
    setTimeout(() => { isTouchRef.current = false; }, 100);
  }, []);

  const startHoldDelete = useCallback((fromTouch: boolean) => {
    // Prevent double-firing: if touch already started, block mouse
    if (!fromTouch && isTouchRef.current) return;
    if (fromTouch) isTouchRef.current = true;

    // Fire one immediate delete
    handleBackspace();
    // Wait 500ms before starting repeat-delete (so a quick tap only deletes one)
    const scheduleNext = () => {
      deleteTimerRef.current = setTimeout(() => {
        handleBackspace();
        // Accelerate: reduce interval by 30%, floor at 50ms
        deleteIntervalRef.current = Math.max(50, deleteIntervalRef.current * 0.7);
        scheduleNext();
      }, deleteIntervalRef.current);
    };
    deleteTimerRef.current = setTimeout(() => {
      scheduleNext();
    }, 500);
  }, [handleBackspace]);

  // Clean up on unmount
  useEffect(() => () => stopHoldDelete(), [stopHoldDelete]);

  const handleCheck = () => {
    if (!rawExpression) return;

    // Capture mode: just return the expression without checking
    if (onDone) {
      onDone(rawExpression);
      return;
    }

    const answer: TextAnswer = { type: 'text', value: expectedAnswer! };
    if (checkAnswer(rawExpression, answer)) {
      onCorrect?.(rawExpression);
    } else {
      setShowWrong(true);
      setShaking(true);
      onIncorrect?.();
      setTimeout(() => setShaking(false), 500);
    }
  };

  // Ensure cursor stays in bounds
  const safeCursor = Math.min(cursorPos, tokens.length);

  return (
    <div
      data-modal="expression-builder"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      style={{ overscrollBehavior: 'contain', touchAction: 'none' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl max-w-sm w-full p-4 animate-bounce-in
                    ${shaking ? 'animate-shake' : ''}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-500">{problemLabel ? `${problemLabel} ${builderLabel}` : builderLabel}</span>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Problem text */}
        <p className="text-base text-gray-700 mb-3 px-1 italic whitespace-pre-line">
          {problemDisplay}
        </p>

        {/* Display area with cursor */}
        <div className="flex items-center gap-2 mb-3">
          {/* Arrow buttons on the left — side by side, full height */}
          <div className="flex gap-0.5 shrink-0 self-stretch">
            <button
              onClick={handleCursorLeft}
              disabled={safeCursor === 0}
              className="px-1.5 rounded-md bg-indigo-50 text-indigo-500 text-xs font-bold
                         active:scale-95 transition-transform disabled:opacity-30"
              aria-label="Move cursor left"
              style={{ touchAction: 'manipulation' }}
            >
              ◀
            </button>
            <button
              onClick={handleCursorRight}
              disabled={safeCursor === tokens.length}
              className="px-1.5 rounded-md bg-indigo-50 text-indigo-500 text-xs font-bold
                         active:scale-95 transition-transform disabled:opacity-30"
              aria-label="Move cursor right"
              style={{ touchAction: 'manipulation' }}
            >
              ▶
            </button>
          </div>
          <div
            className={`flex-1 min-h-14 px-3 py-3 rounded-xl border-2 text-xl
                        font-mono tracking-wide flex items-center justify-end cursor-text
                        ${showWrong ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
            onClick={() => moveCursor(tokens.length)}
          >
            {tokens.length === 0 ? (
              <span className="text-gray-300 text-base font-sans">Tap to build</span>
            ) : (
              <span className="flex items-center flex-wrap justify-end">
                {/* Leading zone — click to position cursor at start */}
                <span
                  className="flex-1 self-stretch min-w-2"
                  onClick={(e) => { e.stopPropagation(); moveCursor(0); }}
                />
                {tokens.map((token, idx) => {
                  const isOp = OPERATORS.has(token);
                  return (
                    <span key={idx} className="flex items-center">
                      {safeCursor === idx && (
                        <span className="w-0.5 h-7 bg-indigo-500 rounded-full mx-px shrink-0"
                              style={{ animation: 'cursor-blink 1s step-end infinite' }} />
                      )}
                      <span
                        className={isOp ? 'mx-1' : ''}
                        onClick={(e) => { e.stopPropagation(); moveCursor(idx + 1); }}
                      >
                        {token}
                      </span>
                    </span>
                  );
                })}
                {safeCursor === tokens.length && (
                  <span className="w-0.5 h-7 bg-indigo-500 rounded-full mx-px shrink-0"
                        style={{ animation: 'cursor-blink 1s step-end infinite' }} />
                )}
              </span>
            )}
          </div>
          {/* Backspace on the right */}
          <button
            onTouchStart={(e) => { e.preventDefault(); startHoldDelete(true); }}
            onTouchEnd={stopHoldDelete}
            onTouchCancel={stopHoldDelete}
            onMouseDown={() => startHoldDelete(false)}
            onMouseUp={stopHoldDelete}
            onMouseLeave={stopHoldDelete}
            disabled={safeCursor === 0}
            className="px-3 py-3 rounded-xl bg-gray-100 text-gray-600 text-xl
                       active:scale-95 transition-transform disabled:opacity-30"
            aria-label="Backspace (hold to delete faster)"
          >
            ⌫
          </button>
        </div>

        {/* Cursor blink animation */}
        <style>{`@keyframes cursor-blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>

        {/* Error message */}
        {showWrong && (
          <p className="text-red-500 text-sm font-medium text-center mb-2">
            Not quite, try again!
          </p>
        )}

        {/* Top row: variables, exponents, parens (flex-wrap) */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {variables.map(v => (
            <CalcButton
              key={v}
              label={v}
              onClick={() => handleTap(v)}
              className="bg-indigo-100 border-2 border-indigo-200 text-indigo-700 font-bold flex-1 !min-h-10 !text-base"
            />
          ))}
          <CalcButton
            label="²"
            onClick={() => handleTap('²')}
            className="bg-amber-100 text-amber-700 flex-1 !min-h-10 !text-base"
          />
          <CalcButton
            label="³"
            onClick={() => handleTap('³')}
            className="bg-amber-100 text-amber-700 flex-1 !min-h-10 !text-base"
          />
          <CalcButton
            label="⁴"
            onClick={() => handleTap('⁴')}
            className="bg-amber-100 text-amber-700 flex-1 !min-h-10 !text-base"
          />
          <CalcButton
            label="("
            onClick={() => handleTap('(')}
            className="bg-slate-100 border-2 border-slate-200 text-slate-700 flex-1 !min-h-10 !text-base"
          />
          <CalcButton
            label=")"
            onClick={() => handleTap(')')}
            className="bg-slate-100 border-2 border-slate-200 text-slate-700 flex-1 !min-h-10 !text-base"
          />
        </div>

        {/* Inequality symbols row (conditional) */}
        {showInequality && (
          <div className="flex gap-2 mb-2">
            <CalcButton
              label="<"
              onClick={() => handleTap('<')}
              className="bg-teal-50 border-2 border-teal-200 text-teal-700 flex-1"
            />
            <CalcButton
              label=">"
              onClick={() => handleTap('>')}
              className="bg-teal-50 border-2 border-teal-200 text-teal-700 flex-1"
            />
            <CalcButton
              label="≤"
              onClick={() => handleTap('≤')}
              className="bg-teal-50 border-2 border-teal-200 text-teal-700 flex-1"
            />
            <CalcButton
              label="≥"
              onClick={() => handleTap('≥')}
              className="bg-teal-50 border-2 border-teal-200 text-teal-700 flex-1"
            />
          </div>
        )}

        {/* Number + Operator grid (4 columns) */}
        <div className="grid grid-cols-4 gap-2">
          <CalcButton label="7" onClick={() => handleTap('7')} />
          <CalcButton label="8" onClick={() => handleTap('8')} />
          <CalcButton label="9" onClick={() => handleTap('9')} />
          <CalcButton
            label="÷ /"
            onClick={() => handleTap('/')}
            className="bg-slate-100 border-2 border-slate-200 text-slate-700"
          />

          <CalcButton label="4" onClick={() => handleTap('4')} />
          <CalcButton label="5" onClick={() => handleTap('5')} />
          <CalcButton label="6" onClick={() => handleTap('6')} />
          <CalcButton
            label="× ·"
            onClick={() => handleTap('\u22C5')}
            className="bg-slate-100 border-2 border-slate-200 text-slate-700"
          />

          <CalcButton label="1" onClick={() => handleTap('1')} />
          <CalcButton label="2" onClick={() => handleTap('2')} />
          <CalcButton label="3" onClick={() => handleTap('3')} />
          <CalcButton
            label="−"
            onClick={() => handleTap('\u2212')}
            className="bg-slate-100 border-2 border-slate-200 text-slate-700"
          />

          <CalcButton label="0" onClick={() => handleTap('0')} />
          <CalcButton
            label="."
            onClick={() => handleTap('.')}
            className="bg-slate-100 border-2 border-slate-200 text-slate-700"
          />
          <CalcButton
            label="="
            onClick={() => handleTap('=')}
            className="bg-slate-100 border-2 border-slate-200 text-slate-700"
          />
          <CalcButton
            label="+"
            onClick={() => handleTap('+')}
            className="bg-slate-100 border-2 border-slate-200 text-slate-700"
          />
        </div>

        {/* Check button - full width */}
        <div className="mt-2">
          <button
            onClick={handleCheck}
            disabled={tokens.length === 0}
            className="w-full min-h-12 rounded-xl text-lg font-bold
                       bg-emerald-500 text-white
                       active:scale-95 transition-transform
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {onDone ? 'Done ✓' : 'Check ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}
