interface ProgressBarProps {
  total: number;
  correct: number;
  incorrect: number;
  className?: string;
}

/** Returns a CSS background color based on the correct percentage: orange → yellow → green */
function barColor(pct: number): string {
  if (pct >= 100) return '#10b981';  // emerald-500
  if (pct >= 65) return '#34d399';   // emerald-400
  if (pct >= 40) return '#4ade80';   // green-400
  if (pct >= 20) return '#facc15';   // yellow-400
  if (pct >= 10) return '#fbbf24';   // amber-400
  return '#fb923c';                   // orange-400
}

export default function ProgressBar({ total, correct, incorrect, className = '' }: ProgressBarProps) {
  const correctPct = total > 0 ? (correct / total) * 100 : 0;
  const incorrectPct = total > 0 ? (incorrect / total) * 100 : 0;

  return (
    <div className={`relative w-full bg-gray-200 rounded-full h-4 overflow-hidden ${className}`}>
      <div className="h-full flex">
        <div
          className="transition-all duration-500 ease-out"
          style={{ width: `${correctPct}%`, backgroundColor: barColor(correctPct) }}
        />
        <div
          className="bg-red-400 transition-all duration-500 ease-out"
          style={{ width: `${incorrectPct}%` }}
        />
      </div>
      {/* Milestone markers */}
      <div className="absolute left-1/2 top-0 h-full w-px bg-gray-400/40" />
      <div className="absolute left-[80%] top-0 h-full w-px bg-gray-400/40" />
    </div>
  );
}
