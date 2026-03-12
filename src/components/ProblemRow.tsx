import { useState, useRef, useEffect } from 'react';
import type { Problem } from '../lib/dataLoader';
import { checkAnswer } from '../lib/answerChecker';
import ExpressionBuilder from './ExpressionBuilder';

interface ProblemRowProps {
  problem: Problem;
  isCorrect: boolean;
  previousAttempts: number;
  savedAnswer?: string;
  onCorrect: (attemptCount: number, answer: string) => void;
  onIncorrect: (attemptCount: number) => void;
  onUndo?: () => void;
  playCorrect: () => void;
  playIncorrect: () => void;
}

export default function ProblemRow({
  problem,
  isCorrect: initialCorrect,
  previousAttempts,
  savedAnswer,
  onCorrect,
  onIncorrect,
  onUndo,
  playCorrect,
  playIncorrect,
}: ProblemRowProps) {
  const [input, setInput] = useState(savedAnswer ?? '');
  const [isCorrect, setIsCorrect] = useState(initialCorrect);
  const [showWrong, setShowWrong] = useState(false);
  const [attempts, setAttempts] = useState(previousAttempts);
  const [shaking, setShaking] = useState(false);
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasExpressionBuilder = problem.answer.type === 'text' && problem.variables?.length;

  useEffect(() => {
    setIsCorrect(initialCorrect);
    setAttempts(previousAttempts);
    if (initialCorrect && savedAnswer) {
      setInput(savedAnswer);
    }
  }, [initialCorrect, previousAttempts, savedAnswer]);

  const handleCheck = () => {
    if (isCorrect || !input.trim()) return;

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (checkAnswer(input, problem.answer)) {
      setIsCorrect(true);
      setShowWrong(false);
      playCorrect();
      onCorrect(newAttempts, input.trim());
    } else {
      setShowWrong(true);
      setShaking(true);
      playIncorrect();
      onIncorrect(newAttempts);
      setTimeout(() => setShaking(false), 500);
      inputRef.current?.select();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCheck();
    }
  };

  return (
    <div
      className={`p-3 rounded-xl transition-colors duration-300 ${
        isCorrect
          ? 'bg-emerald-50 border-2 border-emerald-200'
          : 'bg-white border-2 border-gray-100'
      } ${shaking ? 'animate-shake' : ''}`}
    >
      {/* Top row: label + problem text + correct indicator */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-bold text-indigo-600 shrink-0">
          {problem.label}
        </span>
        <span className="flex-1 text-lg text-gray-800">
          {problem.display}
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
                <span className="text-emerald-600 font-semibold">
                  {problem.answer.type === 'workbook' ? 'Done in workbook' : input}
                </span>
                <span className="text-2xl animate-pop">✅</span>
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

      {/* Image (if any) */}
      {problem.image && (
        <div className="my-2 ml-1">
          <img
            src={`${import.meta.env.BASE_URL}${problem.image}`}
            alt={`Diagram for ${problem.label}`}
            className="max-w-full max-h-48 rounded-lg border border-gray-200"
            loading="lazy"
          />
        </div>
      )}

      {/* Bottom row: answer input, expression builder, or workbook button */}
      {!isCorrect && problem.answer.type === 'workbook' ? (
        <div className="flex items-center gap-2 ml-1">
          <button
            onClick={() => {
              setIsCorrect(true);
              playCorrect();
              onCorrect(1, 'done in workbook');
            }}
            className="px-5 py-2 bg-amber-500 text-white rounded-lg font-semibold
                       active:scale-95 transition-transform text-base flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Done in workbook
          </button>
        </div>
      ) : !isCorrect && hasExpressionBuilder ? (
        <div className="flex items-center gap-2 ml-1">
          <button
            onClick={() => setShowBuilder(true)}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-semibold
                       active:scale-95 transition-transform text-base flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm2.25-4.5h.008v.008H10.5v-.008zm0 2.25h.008v.008H10.5v-.008zm0 2.25h.008v.008H10.5v-.008zm2.25-4.5h.008v.008H12.75v-.008zm0 2.25h.008v.008H12.75v-.008zm2.25-6.75h.008v.008H15v-.008zm0 2.25h.008v.008H15v-.008zm0 2.25h.008v.008H15v-.008zm0 2.25h.008v.008H15v-.008zm2.25-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zM6 18.75V6.75A2.25 2.25 0 018.25 4.5h7.5A2.25 2.25 0 0118 6.75v12a2.25 2.25 0 01-2.25 2.25h-7.5A2.25 2.25 0 016 18.75z" />
            </svg>
            Build Expression
          </button>
          {showWrong && (
            <span className="text-red-500 text-sm font-medium whitespace-nowrap">
              Not quite!
            </span>
          )}
        </div>
      ) : !isCorrect ? (
        <div className="flex items-center gap-2 ml-1">
          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            value={input}
            onChange={e => {
              setInput(e.target.value);
              setShowWrong(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Answer"
            className={`flex-1 max-w-40 px-3 py-2 rounded-lg border-2 text-lg text-center
                       focus:outline-none focus:border-indigo-400 transition-colors
                       ${showWrong ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
          />
          <button
            onClick={handleCheck}
            disabled={!input.trim()}
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
      ) : null}

      {/* Expression Builder Modal */}
      {showBuilder && hasExpressionBuilder && problem.variables && (
        <ExpressionBuilder
          variables={problem.variables}
          expectedAnswer={(problem.answer as { type: 'text'; value: string }).value}
          problemDisplay={problem.display}
          onCorrect={(expression) => {
            setShowBuilder(false);
            setInput(expression);
            setIsCorrect(true);
            setShowWrong(false);
            playCorrect();
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            onCorrect(newAttempts, expression);
          }}
          onIncorrect={() => {
            setShowWrong(true);
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            playIncorrect();
            onIncorrect(newAttempts);
          }}
          onClose={() => setShowBuilder(false)}
        />
      )}
    </div>
  );
}
