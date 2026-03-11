import { useState, useRef, useEffect } from 'react';
import type { Problem } from '../lib/dataLoader';
import { checkAnswer } from '../lib/answerChecker';

interface ProblemRowProps {
  problem: Problem;
  isCorrect: boolean;
  previousAttempts: number;
  savedAnswer?: string;
  onCorrect: (attemptCount: number, answer: string) => void;
  onIncorrect: (attemptCount: number) => void;
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
  playCorrect,
  playIncorrect,
}: ProblemRowProps) {
  const [input, setInput] = useState(savedAnswer ?? '');
  const [isCorrect, setIsCorrect] = useState(initialCorrect);
  const [showWrong, setShowWrong] = useState(false);
  const [attempts, setAttempts] = useState(previousAttempts);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
        <span className="text-sm font-bold text-indigo-600 w-8 shrink-0 text-center">
          {problem.label}
        </span>
        <span className="flex-1 text-lg text-gray-800 whitespace-nowrap overflow-x-auto">
          {problem.display}
        </span>
        {isCorrect && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-emerald-600 font-semibold">{input}</span>
            <span className="text-2xl animate-pop">✅</span>
          </div>
        )}
      </div>

      {/* Bottom row: answer input */}
      {!isCorrect && (
        <div className="flex items-center gap-2 pl-10">
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
      )}
    </div>
  );
}
