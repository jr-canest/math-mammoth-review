interface ProgressBarProps {
  total: number;
  correct: number;
  incorrect: number;
  skipped?: number;
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

export default function ProgressBar({ total, correct, incorrect, skipped = 0, className = '' }: ProgressBarProps) {
  const answeredCorrect = correct - skipped; // non-skipped correct
  const effectiveTotal = total - skipped; // problems that actually need doing
  const correctPct = total > 0 ? (answeredCorrect / total) * 100 : 0;
  const skippedPct = total > 0 ? (skipped / total) * 100 : 0;
  const incorrectPct = total > 0 ? (incorrect / total) * 100 : 0;

  // Milestone markers adjust to effective total (where 50%/80% of remaining problems fall)
  const halfwayMark = total > 0 ? (Math.ceil(effectiveTotal * 0.5) / total) * 100 : 50;
  const milestoneMark = total > 0 ? (Math.ceil(effectiveTotal * 0.8) / total) * 100 : 80;

  return (
    <div className={`relative w-full bg-gray-200 rounded-full h-4 overflow-hidden ${className}`}>
      {/* Skipped segment — anchored to right end */}
      {skippedPct > 0 && (
        <div
          className="absolute right-0 top-0 h-full transition-all duration-500 ease-out"
          style={{ width: `${skippedPct}%`, backgroundColor: '#d1d5db' }}
        />
      )}
      <div className="h-full flex relative z-[1]">
        <div
          className="transition-all duration-500 ease-out"
          style={{ width: `${correctPct}%`, backgroundColor: barColor(correctPct + skippedPct) }}
        />
        <div
          className="bg-red-400 transition-all duration-500 ease-out"
          style={{ width: `${incorrectPct}%` }}
        />
      </div>
      {/* Milestone markers — shift with skipped problems */}
      <div className="absolute top-0 h-full w-0.5 bg-white/70 z-[2] transition-all duration-500" style={{ left: `${halfwayMark}%` }} />
      <div className="absolute top-0 h-full w-0.5 bg-white/70 z-[2] transition-all duration-500" style={{ left: `${milestoneMark}%` }} />
    </div>
  );
}
