import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProgressData } from '../lib/progressStore';
import { loadSections, loadSectionData } from '../lib/dataLoader';

interface ParentDashboardProps {
  progress: ProgressData;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDefaultRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 13);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function formatAnswerValue(answer: { type: string; value?: number | string }): string {
  if (answer.type === 'workbook') return 'Done in workbook';
  return String(answer.value ?? '');
}

interface ProblemInfo {
  label: string;
  display: string;
  correctAnswer: string;
  attempted: boolean;
  correct: boolean;
  attempts: number;
}

function ProblemRow({ p }: { p: ProblemInfo }) {
  const firstTry = p.correct && p.attempts === 1;
  const eventuallyCorrect = p.correct && p.attempts > 1;

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 rounded ${
        firstTry ? 'bg-emerald-50'
        : eventuallyCorrect ? 'bg-amber-50'
        : p.attempted ? 'bg-red-50'
        : 'bg-gray-50'
      }`}
    >
      <span className={`w-4 text-center ${
        firstTry ? 'text-emerald-600'
        : eventuallyCorrect ? 'text-amber-600'
        : p.attempted ? 'text-red-500'
        : 'text-gray-300'
      }`}>
        {p.correct ? '✓' : p.attempted ? '✗' : '·'}
      </span>
      <span className="font-mono font-bold text-gray-600 shrink-0 whitespace-nowrap">{p.label}</span>
      <span className="text-gray-500 flex-1 truncate">{p.display}</span>
      <span className="text-gray-400 font-mono shrink-0">= {p.correctAnswer}</span>
      {eventuallyCorrect && (
        <span className="text-amber-500 shrink-0">({p.attempts} tries)</span>
      )}
      {p.attempted && !p.correct && (
        <span className="text-red-400 shrink-0">({p.attempts} tries)</span>
      )}
    </div>
  );
}

function SectionProblems({ problems }: { problems: ProblemInfo[] }) {
  const [showRemaining, setShowRemaining] = useState(false);
  const attempted = problems.filter(p => p.attempted);
  const remaining = problems.filter(p => !p.attempted);

  return (
    <div className="p-3">
      <div className="grid grid-cols-1 gap-0.5 text-xs">
        {attempted.map(p => <ProblemRow key={p.label} p={p} />)}
      </div>
      {remaining.length > 0 && (
        <button
          onClick={() => setShowRemaining(!showRemaining)}
          className="mt-2 text-xs text-gray-400 hover:text-gray-500 flex items-center gap-1"
        >
          <svg
            className={`w-3 h-3 transition-transform ${showRemaining ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {remaining.length} not yet attempted
        </button>
      )}
      {showRemaining && (
        <div className="grid grid-cols-1 gap-0.5 text-xs mt-1">
          {remaining.map(p => <ProblemRow key={p.label} p={p} />)}
        </div>
      )}
    </div>
  );
}

export default function ParentDashboard({ progress }: ParentDashboardProps) {
  const navigate = useNavigate();
  const defaults = getDefaultRange();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);

  // Filter daily log by date range
  const dailyEntries = Object.entries(progress.dailyLog)
    .filter(([date]) => date >= startDate && date <= endDate)
    .sort(([a], [b]) => b.localeCompare(a));

  // Totals for the range
  const rangeTotals = dailyEntries.reduce(
    (acc, [, day]) => ({
      attempted: acc.attempted + day.problemsAttempted,
      correct: acc.correct + day.problemsCorrect,
    }),
    { attempted: 0, correct: 0 },
  );

  // Section breakdown with individual problem details
  const sectionEntries = Object.entries(progress.sections)
    .map(([key, sp]) => {
      const parts = key.split('-');
      const chapterFolder = parts.slice(0, 2).join('-');
      const sectionId = parts.slice(2).join('-');
      const sections = loadSections(chapterFolder);
      const meta = sections.find(s => s.id === sectionId);
      const sectionData = meta ? loadSectionData(chapterFolder, meta.file) : null;

      const problems = sectionData?.problems.map(p => {
        const attempt = sp.attempts[p.id];
        return {
          label: p.label,
          display: p.display,
          correctAnswer: formatAnswerValue(p.answer),
          attempted: !!attempt,
          correct: attempt?.correct ?? false,
          attempts: attempt?.attempts ?? 0,
        };
      }) ?? [];

      const hasActivityInRange = Object.values(sp.attempts).some(a => {
        const date = a.lastAttempt.split('T')[0];
        return date >= startDate && date <= endDate;
      });

      return {
        key,
        title: meta?.title ?? sectionId,
        pages: meta?.pages ?? '',
        score: sp.score,
        completedAt: sp.completedAt,
        correctCount: Object.values(sp.attempts).filter(a => a.correct).length,
        totalProblems: sectionData?.problems.length ?? Object.keys(sp.attempts).length,
        problems,
        hasActivityInRange,
      };
    })
    .filter(s => s.hasActivityInRange)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));

  const handleShare = () => {
    const totalSections = sectionEntries.length;
    const completedSections = sectionEntries.filter(s => s.completedAt).length;
    const rangeLabel = `${formatDate(startDate)} – ${formatDate(endDate)}`;
    const accuracy = rangeTotals.attempted > 0
      ? Math.round((rangeTotals.correct / rangeTotals.attempted) * 100)
      : 0;

    const text = `${rangeLabel}: Odaniel worked on ${totalSections} section(s), completed ${completedSections}, with ${accuracy}% accuracy (${rangeTotals.correct}/${rangeTotals.attempted} problems correct).`;

    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        alert('Summary copied to clipboard!');
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 text-indigo-600 active:scale-95 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900">Parent Dashboard</h1>
          </div>
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm
                       active:scale-95 transition-transform"
          >
            Share
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Date Range Picker */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-gray-600">From</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <label className="text-sm font-semibold text-gray-600">To</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => {
                  const d = getDefaultRange();
                  setStartDate(d.start);
                  setEndDate(d.end);
                }}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 rounded-lg text-gray-600
                           active:scale-95 transition-transform"
              >
                2 weeks
              </button>
              <button
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setDate(start.getDate() - 29);
                  setStartDate(start.toISOString().split('T')[0]);
                  setEndDate(end.toISOString().split('T')[0]);
                }}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 rounded-lg text-gray-600
                           active:scale-95 transition-transform"
              >
                30 days
              </button>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-indigo-600">{rangeTotals.attempted}</div>
            <div className="text-xs text-gray-500 mt-1">Attempted</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{rangeTotals.correct}</div>
            <div className="text-xs text-gray-500 mt-1">Correct</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <div className={`text-2xl font-bold ${
              rangeTotals.attempted > 0
                ? (() => {
                    const pct = rangeTotals.correct / rangeTotals.attempted;
                    return pct >= 1 ? 'text-emerald-600' :
                      pct >= 0.65 ? 'text-emerald-500' :
                      pct >= 0.4 ? 'text-green-500' :
                      pct >= 0.2 ? 'text-yellow-500' :
                      pct >= 0.1 ? 'text-amber-500' :
                      'text-orange-500';
                  })()
                : 'text-gray-400'
            }`}>
              {rangeTotals.attempted > 0
                ? `${Math.round((rangeTotals.correct / rangeTotals.attempted) * 100)}%`
                : '—'}
            </div>
            <div className="text-xs text-gray-500 mt-1">Accuracy</div>
          </div>
        </div>

        {/* Daily Activity */}
        <section>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Daily Activity</h2>
          {dailyEntries.length === 0 ? (
            <p className="text-gray-400 text-sm">No activity in this date range.</p>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-3 py-2 font-semibold text-gray-600">Date</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right">Done</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right">Right</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right">Acc.</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyEntries.map(([date, day]) => (
                    <tr key={date} className="border-b last:border-0">
                      <td className="px-3 py-2 text-gray-900">{formatDate(date)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{day.problemsAttempted}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{day.problemsCorrect}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        <span className={
                          day.problemsAttempted > 0
                            ? (() => {
                                const pct = day.problemsCorrect / day.problemsAttempted;
                                return pct >= 1 ? 'text-emerald-600' :
                                  pct >= 0.65 ? 'text-emerald-500' :
                                  pct >= 0.4 ? 'text-green-500' :
                                  pct >= 0.2 ? 'text-yellow-500' :
                                  pct >= 0.1 ? 'text-amber-500' :
                                  'text-orange-500';
                              })()
                            : 'text-gray-400'
                        }>
                          {day.problemsAttempted > 0
                            ? `${Math.round((day.problemsCorrect / day.problemsAttempted) * 100)}%`
                            : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Section Breakdown with Problem Details */}
        <section>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
            Section Results
          </h2>
          {sectionEntries.length === 0 ? (
            <p className="text-gray-400 text-sm">No sections attempted in this date range.</p>
          ) : (
            <div className="space-y-4">
              {sectionEntries.map(s => (
                <div key={s.key} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {/* Section header */}
                  <div className="p-4 border-b bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">{s.title}</h3>
                        {s.pages && <span className="text-xs text-gray-400">pp. {s.pages}</span>}
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-bold ${
                          s.score >= 1 ? 'text-emerald-600' :
                          s.score >= 0.65 ? 'text-emerald-500' :
                          s.score >= 0.4 ? 'text-green-500' :
                          s.score >= 0.2 ? 'text-yellow-500' :
                          s.score >= 0.1 ? 'text-amber-500' :
                          s.score > 0 ? 'text-orange-500' :
                          'text-gray-400'
                        }`}>
                          {s.correctCount}/{s.totalProblems}
                        </span>
                        <span className="text-xs text-gray-400 ml-1">
                          ({Math.round(s.score * 100)}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Problem grid - condensed */}
                  <SectionProblems problems={s.problems} />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
