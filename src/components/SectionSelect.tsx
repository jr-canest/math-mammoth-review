import { useParams, useNavigate } from 'react-router-dom';
import { loadSections, loadSectionData, loadChaptersSync } from '../lib/dataLoader';
import type { ProgressData } from '../lib/progressStore';
import ProgressBar from './ProgressBar';

interface SectionSelectProps {
  progress: ProgressData;
}

/** Returns a Tailwind text color class based on percentage (0–1): orange → yellow → green */
function progressTextColor(pct: number): string {
  if (pct >= 1) return 'text-emerald-600';
  if (pct >= 0.65) return 'text-emerald-500';
  if (pct >= 0.4) return 'text-green-500';
  if (pct >= 0.2) return 'text-yellow-500';
  if (pct >= 0.1) return 'text-amber-500';
  if (pct > 0) return 'text-orange-500';
  return 'text-gray-400';
}

/** Returns a Tailwind bg color class for the status dot */
function progressDotColor(pct: number): string {
  if (pct >= 1) return 'bg-emerald-500';
  if (pct >= 0.65) return 'bg-emerald-400';
  if (pct >= 0.4) return 'bg-green-400';
  if (pct >= 0.2) return 'bg-yellow-400';
  if (pct >= 0.1) return 'bg-amber-400';
  if (pct > 0) return 'bg-orange-400';
  return 'bg-gray-300';
}

export default function SectionSelect({ progress }: SectionSelectProps) {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();

  if (!chapterId) return null;

  const sections = loadSections(chapterId);
  const chapter = loadChaptersSync().find(c => c.folder === chapterId);

  const isGameChapter = sections.length > 0 && sections.every(s => s.type === 'game');

  // Calculate overall chapter progress
  let totalProblems = 0;
  let totalCorrect = 0;
  let totalIncorrect = 0;
  if (isGameChapter) {
    const playable = sections.filter(s => !!s.component);
    totalProblems = playable.length;
    playable.forEach(section => {
      const key = `${chapterId}-${section.id}`;
      const sp = progress.sections[key];
      if (sp && sp.completedAt) totalCorrect++;
    });
  } else {
    sections.forEach(section => {
      const data = loadSectionData(chapterId, section.file);
      if (data) totalProblems += data.problems.length;
      const key = `${chapterId}-${section.id}`;
      const sp = progress.sections[key];
      if (sp) {
        const attempts = Object.values(sp.attempts);
        totalCorrect += attempts.filter(a => a.correct).length;
        totalIncorrect += attempts.filter(a => !a.correct).length;
      }
    });
  }

  const overallPct = totalProblems > 0 ? totalCorrect / totalProblems : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 text-indigo-600 active:scale-95 transition-transform"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">
              {chapter?.title ?? 'Sections'}
            </h1>
          </div>
          <div className="text-right shrink-0">
            {isGameChapter ? null : (
              <>
                <span className={`text-lg font-bold ${progressTextColor(overallPct)}`}>
                  {Math.round(overallPct * 100)}%
                </span>
                <p className="text-xs text-gray-400">
                  {totalCorrect}/{totalProblems}
                </p>
              </>
            )}
          </div>
        </div>
        {!isGameChapter && (
          <div className="max-w-3xl mx-auto px-4 pb-3">
            <ProgressBar total={totalProblems} correct={totalCorrect} incorrect={totalIncorrect} />
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        {sections.map(section => {
          const key = `${chapterId}-${section.id}`;
          const sp = progress.sections[key];
          const isGame = section.type === 'game';

          // Game sections: completed, playable, or coming soon
          if (isGame) {
            const completed = sp?.completedAt != null;
            const hasComponent = !!section.component;
            return (
              <button
                key={section.id}
                onClick={() => hasComponent ? navigate(`/chapter/${chapterId}/${section.id}`) : undefined}
                disabled={!hasComponent}
                className={`w-full bg-white rounded-xl shadow-sm p-4 text-left flex items-center gap-4
                           transition-transform border-2 border-transparent
                           ${hasComponent ? 'active:scale-[0.98] hover:border-indigo-100' : 'opacity-60 cursor-default'}`}
              >
                <div className="w-7 h-7 shrink-0 flex items-center justify-center text-lg">
                  {completed ? '🏆' : hasComponent ? '🎮' : '🔒'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {section.title}
                    </h3>
                    {section.week && (
                      <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-400 rounded-full">
                        Wk {section.week}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{section.subtitle || 'Interactive game'}</p>
                </div>
                <div className={`text-right shrink-0 ${completed ? 'text-emerald-600' : 'text-gray-400'}`}>
                  <span className="text-sm font-medium">
                    {completed ? 'Completed' : hasComponent ? 'Not played' : 'Coming soon'}
                  </span>
                </div>
              </button>
            );
          }

          // Regular problem sections
          const data = loadSectionData(chapterId, section.file);
          const sectionTotal = data?.problems.length ?? 0;
          const sectionCorrect = sp
            ? Object.values(sp.attempts).filter(a => a.correct).length
            : 0;
          const sectionSkipped = sp
            ? Object.values(sp.attempts).filter(a => a.skipped).length
            : 0;
          const pct = sectionTotal > 0 ? sectionCorrect / sectionTotal : 0;
          const pacing = section.pacing;

          const pacingLabel = pacing?.type === 'half' ? 'lite' :
            pacing?.type === 'skip' ? 'skip?' :
            pacing?.type === 'review' ? 'review' :
            pacing?.type === 'half-review' ? 'lite + review' : null;

          return (
            <button
              key={section.id}
              onClick={() => navigate(`/chapter/${chapterId}/${section.id}`)}
              className="w-full bg-white rounded-xl shadow-sm p-4 text-left
                         active:scale-[0.98] transition-transform border-2 border-transparent
                         hover:border-indigo-100"
            >
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full shrink-0 ${progressDotColor(pct)}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {section.title}
                    </h3>
                    {data?.needsReview && (
                      <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-600 rounded-full uppercase tracking-wide">
                        In Construction
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">Pages {section.pages}</p>
                </div>
                <div className={`text-right shrink-0 ${progressTextColor(pct)}`}>
                  <span className="text-sm font-medium">
                    {sectionCorrect > 0 ? `${Math.round(pct * 100)}%` : 'Not started'}
                  </span>
                  <p className="text-xs opacity-70">
                    {sectionCorrect > 0 ? `${sectionCorrect}/${sectionTotal}` : `0/${sectionTotal}`}
                    {sectionSkipped > 0 && ` (${sectionSkipped} skipped)`}
                  </p>
                </div>
              </div>
              {pacing && (
                <div className={`mt-2 ml-7 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${
                  pacing.type === 'skip' ? 'bg-gray-50 border border-gray-200' : 'bg-blue-50 border border-blue-100'
                }`}>
                  <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                    pacing.type === 'skip' ? 'bg-gray-200 text-gray-500' :
                    pacing.type === 'review' ? 'bg-purple-100 text-purple-500' :
                    'bg-blue-100 text-blue-600'
                  }`}>{pacingLabel}</span>
                  <span className={`text-xs ${pacing.type === 'skip' ? 'text-gray-500' : 'text-blue-600/80'}`}>
                    {pacing.condition || pacing.note}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </main>
    </div>
  );
}
