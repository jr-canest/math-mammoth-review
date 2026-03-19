import { useState, useRef } from 'react';
import { checkAnswer } from '../lib/answerChecker';
import type { MeasureAnswer } from '../lib/answerChecker';

interface MeasureBuilderProps {
  units: string[];
  expectedAnswer?: string;
  problemDisplay: string;
  problemLabel?: string;
  onCorrect?: (measure: string) => void;
  onIncorrect?: () => void;
  /** Capture mode: returns measure without checking. Overrides onCorrect/onIncorrect. */
  onDone?: (measure: string) => void;
  onClose: () => void;
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
    >
      {label}
    </button>
  );
}

export default function MeasureBuilder({
  units,
  expectedAnswer,
  problemDisplay,
  problemLabel,
  onCorrect,
  onIncorrect,
  onDone,
  onClose,
}: MeasureBuilderProps) {
  const [tokens, setTokens] = useState<string[]>([]);
  const [cursorPos, setCursorPos] = useState(0);
  const cursorRef = useRef(0);
  const [shaking, setShaking] = useState(false);
  const [showWrong, setShowWrong] = useState(false);

  const rawMeasure = tokens.join('');

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

  const handleUnitTap = (unit: string) => {
    setShowWrong(false);
    const pos = cursorRef.current;
    const newTokens: string[] = [];

    // Insert a space before the unit if last token isn't already a space
    if (pos > 0 && tokens[pos - 1] !== ' ') {
      newTokens.push(' ');
    }
    newTokens.push(unit);
    // Insert a trailing space (ready for next number)
    newTokens.push(' ');

    setTokens(prev => [...prev.slice(0, pos), ...newTokens, ...prev.slice(pos)]);
    const newPos = pos + newTokens.length;
    cursorRef.current = newPos;
    setCursorPos(newPos);
  };

  const handleBackspace = () => {
    const pos = cursorRef.current;
    if (pos === 0) return;
    setShowWrong(false);
    setTokens(prev => [...prev.slice(0, pos - 1), ...prev.slice(pos)]);
    cursorRef.current = pos - 1;
    setCursorPos(pos - 1);
  };

  const handleClear = () => {
    setShowWrong(false);
    setTokens([]);
    cursorRef.current = 0;
    setCursorPos(0);
  };

  const handleCheck = () => {
    const trimmed = rawMeasure.trim();
    if (!trimmed) return;

    // Capture mode: just return the measure without checking
    if (onDone) {
      onDone(trimmed);
      return;
    }

    const answer: MeasureAnswer = { type: 'measure', value: expectedAnswer!, units };
    if (checkAnswer(trimmed, answer)) {
      onCorrect?.(trimmed);
    } else {
      setShowWrong(true);
      setShaking(true);
      onIncorrect?.();
      setTimeout(() => setShaking(false), 500);
    }
  };

  // Ensure cursor stays in bounds
  const safeCursor = Math.min(cursorPos, tokens.length);

  // Check if a token is a unit (multi-character non-space string)
  const isUnit = (t: string) => t.length > 0 && t !== ' ' && t !== '.' && !/^\d$/.test(t);

  return (
    <div
      data-modal="measure-builder"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl max-w-sm w-full p-4 animate-bounce-in
                    ${shaking ? 'animate-shake' : ''}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-500">
            {problemLabel ? `${problemLabel} Build measure` : 'Build measure'}
          </span>
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
                {tokens.map((token, idx) => (
                  <span key={idx} className="flex items-center">
                    {safeCursor === idx && (
                      <span className="w-0.5 h-7 bg-indigo-500 rounded-full mx-px shrink-0"
                            style={{ animation: 'cursor-blink 1s step-end infinite' }} />
                    )}
                    <span
                      className={isUnit(token) ? 'text-teal-600 font-bold mx-0.5' : ''}
                      onClick={(e) => { e.stopPropagation(); moveCursor(idx + 1); }}
                    >
                      {token}
                    </span>
                  </span>
                ))}
                {safeCursor === tokens.length && (
                  <span className="w-0.5 h-7 bg-indigo-500 rounded-full mx-px shrink-0"
                        style={{ animation: 'cursor-blink 1s step-end infinite' }} />
                )}
              </span>
            )}
          </div>
          {/* Backspace button next to display */}
          <button
            onClick={handleBackspace}
            disabled={tokens.length === 0}
            className="min-h-14 w-12 rounded-xl bg-gray-100 border-2 border-gray-200 text-gray-600
                       flex items-center justify-center
                       active:scale-95 transition-transform
                       disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Backspace"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.374-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
            </svg>
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

        {/* Number grid (4 columns) — units in right column */}
        <div className="grid grid-cols-4 gap-2">
          {/* Row 1 */}
          <CalcButton label="7" onClick={() => handleTap('7')} />
          <CalcButton label="8" onClick={() => handleTap('8')} />
          <CalcButton label="9" onClick={() => handleTap('9')} />
          <CalcButton
            label="Clear"
            onClick={handleClear}
            className="bg-red-50 text-red-500 text-sm"
          />

          {/* Row 2 */}
          <CalcButton label="4" onClick={() => handleTap('4')} />
          <CalcButton label="5" onClick={() => handleTap('5')} />
          <CalcButton label="6" onClick={() => handleTap('6')} />
          {units[0] ? (
            <CalcButton
              label={units[0]}
              onClick={() => handleUnitTap(units[0])}
              className="bg-teal-100 border-2 border-teal-200 text-teal-700 font-bold"
            />
          ) : <div />}

          {/* Row 3 */}
          <CalcButton label="1" onClick={() => handleTap('1')} />
          <CalcButton label="2" onClick={() => handleTap('2')} />
          <CalcButton label="3" onClick={() => handleTap('3')} />
          {units[1] ? (
            <CalcButton
              label={units[1]}
              onClick={() => handleUnitTap(units[1])}
              className="bg-teal-100 border-2 border-teal-200 text-teal-700 font-bold"
            />
          ) : <div />}

          {/* Row 4: 0, decimal, remaining units or padding */}
          <CalcButton label="0" onClick={() => handleTap('0')} />
          <CalcButton
            label="."
            onClick={() => handleTap('.')}
            className="bg-slate-100 border-2 border-slate-200 text-slate-700"
          />
          {units.slice(2).map(u => (
            <CalcButton
              key={u}
              label={u}
              onClick={() => handleUnitTap(u)}
              className="bg-teal-100 border-2 border-teal-200 text-teal-700 font-bold"
            />
          ))}
          {Array.from({ length: Math.max(0, 2 - units.slice(2).length) }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
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
