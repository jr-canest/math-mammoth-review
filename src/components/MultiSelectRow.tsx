import { useState, useEffect } from 'react';
import type { MultiselectAnswer } from '../lib/answerChecker';

interface MultiSelectRowProps {
  problem: {
    id: string;
    label: string;
    display: string;
    group?: string;
    answer: MultiselectAnswer;
  };
  isCorrect: boolean;
  previousAttempts: number;
  savedAnswer?: string;
  onCorrect: (attemptCount: number, answer: string) => void;
  onIncorrect: (attemptCount: number) => void;
  onUndo?: () => void;
  playCorrect: () => void;
  playIncorrect: () => void;
}

export default function MultiSelectRow({
  problem,
  isCorrect: initialCorrect,
  previousAttempts,
  savedAnswer,
  onCorrect,
  onIncorrect,
  onUndo,
  playCorrect,
  playIncorrect,
}: MultiSelectRowProps) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (savedAnswer) {
      try {
        return new Set(JSON.parse(savedAnswer) as string[]);
      } catch { /* ignore */ }
    }
    return new Set();
  });
  const [isCorrect, setIsCorrect] = useState(initialCorrect);
  const [attempts, setAttempts] = useState(previousAttempts);
  const [showWrong, setShowWrong] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [confirmingUndo, setConfirmingUndo] = useState(false);

  useEffect(() => {
    setIsCorrect(initialCorrect);
    setAttempts(previousAttempts);
    if (initialCorrect && savedAnswer) {
      try {
        setSelected(new Set(JSON.parse(savedAnswer) as string[]));
      } catch { /* ignore */ }
    }
  }, [initialCorrect, previousAttempts, savedAnswer]);

  const isSingleSelect = problem.answer.correct.length === 1;

  const toggle = (option: string) => {
    if (isCorrect) return;
    setShowWrong(false);
    if (isSingleSelect) {
      // Radio behavior: select only one
      setSelected(prev => prev.has(option) ? new Set() : new Set([option]));
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(option)) next.delete(option);
        else next.add(option);
        return next;
      });
    }
  };

  const handleCheck = () => {
    if (isCorrect || selected.size === 0) return;

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    const correctSet = new Set(problem.answer.correct);
    const match = selected.size === correctSet.size &&
      [...selected].every(s => correctSet.has(s));

    if (match) {
      setIsCorrect(true);
      setShowWrong(false);
      playCorrect();
      onCorrect(newAttempts, JSON.stringify([...selected]));
    } else {
      setShowWrong(true);
      setShaking(true);
      playIncorrect();
      onIncorrect(newAttempts);
      setTimeout(() => setShaking(false), 500);
    }
  };

  // Extract the question part (before "Options:")
  const displayParts = problem.display.split(/Options:\s*/i);
  const questionText = displayParts[0].trim();

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
      {/* Top row: label + question */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-bold text-indigo-600 shrink-0">
          {problem.label}
        </span>
        <span className="flex-1 text-lg text-gray-800">
          {questionText}
        </span>
        {isCorrect && (
          <div className="flex items-center gap-1 shrink-0">
            {confirmingUndo ? (
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">Undo?</span>
                <button
                  onClick={() => {
                    setIsCorrect(false);
                    setAttempts(0);
                    setSelected(new Set());
                    setConfirmingUndo(false);
                    onUndo?.();
                  }}
                  className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded font-semibold
                             active:scale-95 transition-transform"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmingUndo(false)}
                  className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded font-semibold
                             active:scale-95 transition-transform"
                >
                  No
                </button>
              </div>
            ) : (
              <>
                <div className="text-right">
                  {attempts > 1 && (
                    <span className="text-[10px] text-amber-500 font-medium block leading-tight">
                      {attempts} tries
                    </span>
                  )}
                </div>
                <span className={`text-2xl animate-pop ${attempts > 1 ? 'opacity-70' : ''}`}>
                  ✅
                </span>
                {onUndo && (
                  <button
                    onClick={() => setConfirmingUndo(true)}
                    className="ml-1 p-1 text-gray-300 hover:text-gray-500 transition-colors"
                    aria-label="Undo"
                    title="Undo"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Option chips */}
      <div className="flex flex-wrap gap-2 ml-1 mb-2">
        {problem.answer.options.map((option) => {
          const isSelected = selected.has(option);
          const isCorrectOption = isCorrect && problem.answer.correct.includes(option);
          const isWrongSelection = showWrong && isSelected && !problem.answer.correct.includes(option);

          return (
            <button
              key={option}
              onClick={() => toggle(option)}
              disabled={isCorrect}
              className={`px-4 py-2 rounded-full text-base font-medium border-2
                         transition-all duration-200 active:scale-95
                         ${isCorrect && isCorrectOption
                           ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                           : isCorrect && !isCorrectOption
                           ? 'bg-gray-50 border-gray-200 text-gray-400'
                           : isWrongSelection
                           ? 'bg-red-50 border-red-300 text-red-700'
                           : isSelected
                           ? 'bg-indigo-100 border-indigo-400 text-indigo-800'
                           : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
                         }
                         disabled:cursor-default`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {/* Check button */}
      {!isCorrect && (
        <div className="flex items-center gap-2 ml-1">
          <button
            onClick={handleCheck}
            disabled={selected.size === 0}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-semibold
                       disabled:opacity-40 disabled:cursor-not-allowed
                       active:scale-95 transition-transform text-base"
          >
            Check
          </button>
          {showWrong && (
            <span className="text-red-500 text-sm font-medium whitespace-nowrap">
              Not quite, try again!
            </span>
          )}
        </div>
      )}
    </div>
  );
}
