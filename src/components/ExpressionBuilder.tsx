import { useState } from 'react';
import { checkAnswer } from '../lib/answerChecker';
import type { TextAnswer } from '../lib/answerChecker';

interface ExpressionBuilderProps {
  variables: string[];
  expectedAnswer: string;
  problemDisplay: string;
  onCorrect: (expression: string) => void;
  onIncorrect: () => void;
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

function formatForDisplay(tokens: string[]): string {
  if (tokens.length === 0) return '';

  const parts: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    // Add spaces around binary operators (not at the start, not after open paren)
    if (['+', '−', '/'].includes(token) && parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      if (lastPart !== '(' && lastPart !== ' ') {
        parts.push(' ');
      }
      parts.push(token);
      parts.push(' ');
    } else {
      parts.push(token);
    }
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}

export default function ExpressionBuilder({
  variables,
  expectedAnswer,
  problemDisplay,
  onCorrect,
  onIncorrect,
  onClose,
}: ExpressionBuilderProps) {
  const [tokens, setTokens] = useState<string[]>([]);
  const [shaking, setShaking] = useState(false);
  const [showWrong, setShowWrong] = useState(false);

  const rawExpression = tokens.join('');
  const displayExpression = formatForDisplay(tokens);

  const handleTap = (value: string) => {
    setShowWrong(false);
    setTokens(prev => [...prev, value]);
  };

  const handleBackspace = () => {
    setShowWrong(false);
    setTokens(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setShowWrong(false);
    setTokens([]);
  };

  const handleCheck = () => {
    if (!rawExpression) return;

    const answer: TextAnswer = { type: 'text', value: expectedAnswer };
    if (checkAnswer(rawExpression, answer)) {
      onCorrect(rawExpression);
    } else {
      setShowWrong(true);
      setShaking(true);
      onIncorrect();
      setTimeout(() => setShaking(false), 500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl max-w-sm w-full p-4 animate-bounce-in
                    ${shaking ? 'animate-shake' : ''}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-500">Build your expression</span>
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
        <p className="text-base text-gray-700 mb-3 px-1 italic">
          {problemDisplay}
        </p>

        {/* Display area */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className={`flex-1 min-h-14 px-4 py-3 rounded-xl border-2 text-xl text-right
                        font-mono tracking-wide flex items-center justify-end
                        ${showWrong ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
          >
            {displayExpression || (
              <span className="text-gray-300 text-base font-sans">Tap to build</span>
            )}
          </div>
          <button
            onClick={handleBackspace}
            disabled={tokens.length === 0}
            className="p-3 rounded-xl bg-gray-100 text-gray-600 text-xl
                       active:scale-95 transition-transform
                       disabled:opacity-30"
            aria-label="Backspace"
          >
            ⌫
          </button>
        </div>

        {/* Error message */}
        {showWrong && (
          <p className="text-red-500 text-sm font-medium text-center mb-2">
            Not quite, try again!
          </p>
        )}

        {/* Variables + Exponents + Clear row */}
        <div className="flex gap-2 mb-2">
          {variables.map(v => (
            <CalcButton
              key={v}
              label={v}
              onClick={() => handleTap(v)}
              className="bg-indigo-100 text-indigo-700 font-bold flex-1"
            />
          ))}
          <CalcButton
            label="²"
            onClick={() => handleTap('²')}
            className="bg-amber-100 text-amber-700 flex-1"
          />
          <CalcButton
            label="³"
            onClick={() => handleTap('³')}
            className="bg-amber-100 text-amber-700 flex-1"
          />
          <CalcButton
            label="Clear"
            onClick={handleClear}
            className="bg-red-50 text-red-500 text-sm flex-1"
          />
        </div>

        {/* Number + Operator grid (4 columns) */}
        <div className="grid grid-cols-4 gap-2">
          <CalcButton label="7" onClick={() => handleTap('7')} />
          <CalcButton label="8" onClick={() => handleTap('8')} />
          <CalcButton label="9" onClick={() => handleTap('9')} />
          <CalcButton
            label="/"
            onClick={() => handleTap('/')}
            className="bg-slate-100 border-2 border-slate-200 text-slate-700"
          />

          <CalcButton label="4" onClick={() => handleTap('4')} />
          <CalcButton label="5" onClick={() => handleTap('5')} />
          <CalcButton label="6" onClick={() => handleTap('6')} />
          <CalcButton
            label="+"
            onClick={() => handleTap('+')}
            className="bg-slate-100 border-2 border-slate-200 text-slate-700"
          />

          <CalcButton label="1" onClick={() => handleTap('1')} />
          <CalcButton label="2" onClick={() => handleTap('2')} />
          <CalcButton label="3" onClick={() => handleTap('3')} />
          <CalcButton
            label="−"
            onClick={() => handleTap('−')}
            className="bg-slate-100 border-2 border-slate-200 text-slate-700"
          />

          <CalcButton label="0" onClick={() => handleTap('0')} />
          <CalcButton
            label="("
            onClick={() => handleTap('(')}
            className="bg-slate-100 border-2 border-slate-200 text-slate-700"
          />
          <CalcButton
            label=")"
            onClick={() => handleTap(')')}
            className="bg-slate-100 border-2 border-slate-200 text-slate-700"
          />
          <CalcButton
            label="Check ✓"
            onClick={handleCheck}
            disabled={tokens.length === 0}
            className="bg-emerald-500 text-white font-bold text-sm"
          />
        </div>
      </div>
    </div>
  );
}
