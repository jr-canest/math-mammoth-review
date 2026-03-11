interface ProgressBarProps {
  total: number;
  correct: number;
  incorrect: number;
  className?: string;
}

export default function ProgressBar({ total, correct, incorrect, className = '' }: ProgressBarProps) {
  const correctPct = total > 0 ? (correct / total) * 100 : 0;
  const incorrectPct = total > 0 ? (incorrect / total) * 100 : 0;

  return (
    <div className={`w-full bg-gray-200 rounded-full h-4 overflow-hidden ${className}`}>
      <div className="h-full flex">
        <div
          className="bg-emerald-500 transition-all duration-500 ease-out"
          style={{ width: `${correctPct}%` }}
        />
        <div
          className="bg-red-400 transition-all duration-500 ease-out"
          style={{ width: `${incorrectPct}%` }}
        />
      </div>
    </div>
  );
}
