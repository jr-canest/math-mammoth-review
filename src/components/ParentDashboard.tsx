import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProgressData, SectionProgress } from '../lib/progressStore';
import type { Answer } from '../lib/answerChecker';
import type { Problem } from '../lib/dataLoader';
import { loadSections, loadSectionData } from '../lib/dataLoader';

interface ParentDashboardProps {
  progress: ProgressData;
}

// ── Helpers ──────────────────────────────────────────────────

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

function getSectionDateRange(sp: SectionProgress): { first: string; last: string } {
  let earliest = '';
  let latest = '';
  for (const a of Object.values(sp.attempts)) {
    const d = a.lastAttempt.split('T')[0];
    if (!earliest || d < earliest) earliest = d;
    if (!latest || d > latest) latest = d;
  }
  if (sp.completedAt) {
    const cd = sp.completedAt.split('T')[0];
    if (!earliest || cd < earliest) earliest = cd;
    if (!latest || cd > latest) latest = cd;
  }
  return { first: earliest, last: latest };
}

function formatDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDateRange(first: string, last: string): string {
  if (!first) return '';
  if (first === last) return formatDateShort(first);
  return `${formatDateShort(first)} – ${formatDateShort(last)}`;
}

function getSectionDuration(sp: SectionProgress): number | null {
  const timestamps: number[] = [];
  for (const a of Object.values(sp.attempts)) {
    if (a.lastAttempt) timestamps.push(new Date(a.lastAttempt).getTime());
  }
  if (sp.completedAt) timestamps.push(new Date(sp.completedAt).getTime());
  if (timestamps.length < 2) return null;

  // Group timestamps into sessions: gaps > 30 min start a new session
  timestamps.sort((a, b) => a - b);
  const SESSION_GAP = 30 * 60 * 1000; // 30 minutes
  let totalMs = 0;
  let sessionStart = timestamps[0];
  let prev = timestamps[0];
  for (let i = 1; i < timestamps.length; i++) {
    if (timestamps[i] - prev > SESSION_GAP) {
      // End previous session, start new one
      totalMs += prev - sessionStart;
      sessionStart = timestamps[i];
    }
    prev = timestamps[i];
  }
  totalMs += prev - sessionStart; // close last session

  const minutes = Math.round(totalMs / 60000);
  return Math.min(minutes, 120);
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function extractConcepts(problems: Problem[]): string[] {
  const groups = new Set<string>();
  for (const p of problems) {
    if (p.group) {
      // Strip leading numbering like "1. " or "2a. "
      let clean = p.group.replace(/^\d+[a-z]?\.\s*/, '');
      // Truncate at first sentence if too long
      if (clean.length > 60) {
        const dot = clean.indexOf('. ');
        if (dot > 0 && dot < 60) clean = clean.slice(0, dot);
        else clean = clean.slice(0, 57) + '...';
      }
      // Remove trailing periods
      clean = clean.replace(/\.\s*$/, '');
      if (clean) groups.add(clean);
    }
  }
  return [...groups];
}

function formatAnswerValue(answer: Answer): string {
  switch (answer.type) {
    case 'workbook':
      return 'Done in workbook';
    case 'multiselect':
      return answer.correct.join(', ');
    case 'dual':
      return answer.fields.map(f => f.value).join(', ');
    case 'gap':
      return answer.gaps.map(g => g.value).join(', ');
    case 'measure':
    case 'number':
    case 'fraction':
    case 'text':
      return String(answer.value ?? '');
  }
}

function accuracyColor(pct: number): string {
  if (pct >= 1) return 'text-emerald-600';
  if (pct >= 0.65) return 'text-emerald-500';
  if (pct >= 0.4) return 'text-green-500';
  if (pct >= 0.2) return 'text-yellow-500';
  if (pct >= 0.1) return 'text-amber-500';
  return 'text-orange-500';
}

// ── Sub-components ───────────────────────────────────────────

interface ProblemInfo {
  label: string;
  display: string;
  correctAnswer: string;
  attempted: boolean;
  correct: boolean;
  attempts: number;
  skipped?: boolean;
}

function ProblemRow({ p }: { p: ProblemInfo }) {
  if (p.skipped) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded bg-gray-50">
        <span className="w-4 text-center text-gray-300">—</span>
        <span className="font-mono font-bold text-gray-400 shrink-0 whitespace-nowrap">{p.label}</span>
        <span className="text-gray-400 flex-1 truncate">{p.display}</span>
        <span className="text-gray-400 text-[10px] italic shrink-0">skipped</span>
      </div>
    );
  }
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

// ── Section entry type ───────────────────────────────────────

interface SectionEntry {
  key: string;
  title: string;
  pages: string;
  score: number;
  completedAt: string | null;
  correctCount: number;
  skippedCount: number;
  totalProblems: number;
  problems: ProblemInfo[];
  firstDate: string;
  lastDate: string;
  durationMinutes: number | null;
  concepts: string[];
  isGame: boolean;
}

// ── Main Component ───────────────────────────────────────────

export default function ParentDashboard({ progress }: ParentDashboardProps) {
  const navigate = useNavigate();
  const defaults = getDefaultRange();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);

  // Build section entries with date, duration, and concepts
  const sectionEntries: SectionEntry[] = Object.entries(progress.sections)
    .map(([key, sp]) => {
      // Parse section key to find chapter folder
      // Key format: "chapter-2-order-of-operations" or "games-activities-math-machines"
      const parts = key.split('-');
      let chapterFolder = '';
      let sectionId = '';

      // Try common prefixes
      for (let i = 2; i <= Math.min(parts.length - 1, 4); i++) {
        const candidate = parts.slice(0, i).join('-');
        const sections = loadSections(candidate);
        if (sections.length > 0) {
          chapterFolder = candidate;
          sectionId = parts.slice(i).join('-');
          break;
        }
      }

      if (!chapterFolder) {
        chapterFolder = parts.slice(0, 2).join('-');
        sectionId = parts.slice(2).join('-');
      }

      const sections = loadSections(chapterFolder);
      const meta = sections.find(s => s.id === sectionId);
      const isGame = meta?.type === 'game';
      const sectionData = meta && !isGame ? loadSectionData(chapterFolder, meta.file) : null;

      const problems = sectionData?.problems.map(p => {
        const attempt = sp.attempts[p.id];
        return {
          label: p.label,
          display: p.display,
          correctAnswer: formatAnswerValue(p.answer),
          attempted: !!attempt,
          correct: attempt?.correct ?? false,
          attempts: attempt?.attempts ?? 0,
          skipped: attempt?.skipped ?? false,
        };
      }) ?? [];

      const hasActivityInRange = isGame
        ? (sp.completedAt && sp.completedAt.split('T')[0] >= startDate && sp.completedAt.split('T')[0] <= endDate)
        : Object.values(sp.attempts).some(a => {
            const date = a.lastAttempt.split('T')[0];
            return date >= startDate && date <= endDate;
          });

      if (!hasActivityInRange) return null;

      const { first, last } = getSectionDateRange(sp);
      const durationMinutes = getSectionDuration(sp);
      const concepts = sectionData ? extractConcepts(sectionData.problems) : [];

      return {
        key,
        title: meta?.title ?? sectionId,
        pages: meta?.pages ?? '',
        score: sp.score,
        completedAt: sp.completedAt,
        correctCount: Object.values(sp.attempts).filter(a => a.correct && !a.skipped).length,
        skippedCount: Object.values(sp.attempts).filter(a => a.skipped).length,
        totalProblems: sectionData?.problems.length ?? Object.keys(sp.attempts).length,
        problems,
        firstDate: first,
        lastDate: last,
        durationMinutes,
        concepts,
        isGame,
      };
    })
    .filter((s): s is SectionEntry => s !== null)
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate));

  // Range totals from section entries (unique problems, not raw attempts)
  const rangeTotals = sectionEntries.reduce(
    (acc, s) => {
      if (s.isGame) return acc;
      const attempted = s.problems.filter(p => p.attempted && !p.skipped).length;
      const correct = s.problems.filter(p => p.correct && !p.skipped).length;
      return {
        attempted: acc.attempted + attempted,
        correct: acc.correct + correct,
      };
    },
    { attempted: 0, correct: 0 },
  );

  // Total estimated time across all sections in range
  const totalEstTime = sectionEntries.reduce(
    (sum, s) => sum + (s.durationMinutes ?? 0), 0
  );

  const handleShare = () => {
    const totalSections = sectionEntries.filter(s => !s.isGame).length;
    const completedSections = sectionEntries.filter(s => !s.isGame && s.completedAt).length;
    const gamesCompleted = sectionEntries.filter(s => s.isGame && s.completedAt).length;
    const rangeLabel = `${formatDate(startDate)} – ${formatDate(endDate)}`;
    const accuracy = rangeTotals.attempted > 0
      ? Math.round((rangeTotals.correct / rangeTotals.attempted) * 100)
      : 0;

    // Collect top concepts
    const allConcepts = sectionEntries.flatMap(s => s.concepts).slice(0, 5);
    const conceptsText = allConcepts.length > 0
      ? `\nTopics covered: ${allConcepts.join(', ')}`
      : '';

    const timeText = totalEstTime > 0 ? ` (~${formatDuration(totalEstTime)})` : '';
    const gamesText = gamesCompleted > 0 ? `, ${gamesCompleted} game(s) completed` : '';

    const text = `${rangeLabel}: Odaniel worked on ${totalSections} section(s), completed ${completedSections}${gamesText}, with ${accuracy}% accuracy (${rangeTotals.correct}/${rangeTotals.attempted} problems correct)${timeText}.${conceptsText}`;

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
        <div className="grid grid-cols-4 gap-3">
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
              rangeTotals.attempted > 0 ? accuracyColor(rangeTotals.correct / rangeTotals.attempted) : 'text-gray-400'
            }`}>
              {rangeTotals.attempted > 0
                ? `${Math.round((rangeTotals.correct / rangeTotals.attempted) * 100)}%`
                : '—'}
            </div>
            <div className="text-xs text-gray-500 mt-1">Accuracy</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {totalEstTime > 0 ? `~${formatDuration(totalEstTime)}` : '—'}
            </div>
            <div className="text-xs text-gray-500 mt-1">Est. Time</div>
          </div>
        </div>

        {/* Section results — one card per section, sorted by most recent activity */}
        <section>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
            Section Results
          </h2>
          {sectionEntries.length === 0 ? (
            <p className="text-gray-400 text-sm">No activity in this date range.</p>
          ) : (
            <div className="space-y-4">
              {sectionEntries.map(s => s.isGame ? (
                // Game section card
                <div key={s.key} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 flex items-center gap-3">
                    <span className="text-xl">🎮</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm">{s.title}</h3>
                      <span className="text-xs text-gray-400">{formatDateRange(s.firstDate, s.lastDate)}</span>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                      Completed
                    </span>
                  </div>
                </div>
              ) : (
                // Regular section card
                <div key={s.key} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">{s.title}</h3>
                          {s.completedAt || s.correctCount >= (s.totalProblems - s.skippedCount) ? (
                            <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                              Complete
                            </span>
                          ) : (
                            <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                              In Progress
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-400">
                            {formatDateRange(s.firstDate, s.lastDate)}
                          </span>
                          {s.pages && <span className="text-xs text-gray-300">·</span>}
                          {s.pages && <span className="text-xs text-gray-400">pp. {s.pages}</span>}
                          {s.durationMinutes != null && s.durationMinutes > 0 && (
                            <>
                              <span className="text-xs text-gray-300">·</span>
                              <span className="text-xs text-purple-400 flex items-center gap-0.5">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                ~{formatDuration(s.durationMinutes)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {(() => {
                          const effectiveTotal = s.totalProblems - s.skippedCount;
                          const pct = effectiveTotal > 0 ? s.correctCount / effectiveTotal : 0;
                          return (
                            <>
                              <span className={`text-lg font-bold ${accuracyColor(pct)}`}>
                                {s.correctCount}/{effectiveTotal}
                              </span>
                              <span className="text-xs text-gray-400 ml-1">
                                ({Math.round(pct * 100)}%)
                              </span>
                              {s.skippedCount > 0 && (
                                <span className="text-xs text-gray-400 ml-1">
                                  · {s.skippedCount} skipped
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Concepts summary */}
                    {s.concepts.length > 0 && (
                      <div className="mt-2 text-xs text-gray-400 leading-relaxed">
                        <span className="font-medium text-gray-500">Skills: </span>
                        {s.concepts.slice(0, 4).join(' · ')}
                        {s.concepts.length > 4 && ` · +${s.concepts.length - 4} more`}
                      </div>
                    )}
                  </div>

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
