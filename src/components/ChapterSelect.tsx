import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadChapters, loadSections, loadSectionData } from '../lib/dataLoader';
import type { Chapter } from '../lib/dataLoader';
import type { ProgressData } from '../lib/progressStore';

interface ChapterSelectProps {
  progress: ProgressData;
  onSwitchUser: () => void;
  userName: string;
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
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

/** Returns a CSS background color for the progress bar fill based on percentage */
function progressBarColor(pct: number): string {
  if (pct >= 1) return '#10b981';    // emerald-500
  if (pct >= 0.65) return '#34d399'; // emerald-400
  if (pct >= 0.4) return '#4ade80';  // green-400
  if (pct >= 0.2) return '#facc15';  // yellow-400
  if (pct >= 0.1) return '#fbbf24';  // amber-400
  return '#fb923c';                   // orange-400
}

export default function ChapterSelect({ progress, onSwitchUser, userName, onExport, onImport }: ChapterSelectProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadChapters().then(setChapters);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-indigo-600">Math Mammoth Review</h1>
          <p className="text-gray-500 mt-1">Choose a chapter to practice</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-3">
        {chapters.map(chapter => {
          const sections = loadSections(chapter.folder);
          const totalSections = sections.length;
          const isGameChapter = totalSections > 0 && sections.every(s => s.type === 'game');

          if (isGameChapter) {
            // Game chapter: count only playable games (have a component)
            const playableGames = sections.filter(s => !!s.component);
            const totalPlayable = playableGames.length;
            let gamesCompleted = 0;
            playableGames.forEach(section => {
              const key = `${chapter.folder}-${section.id}`;
              const sp = progress.sections[key];
              if (sp?.completedAt) gamesCompleted++;
            });
            const pct = totalPlayable > 0 ? gamesCompleted / totalPlayable : 0;

            return (
              <button
                key={chapter.id}
                onClick={() => navigate(`/chapter/${chapter.folder}`)}
                className="w-full bg-white rounded-2xl shadow-md p-6 text-left
                           active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-2xl">🎮</span> {chapter.title}
                  </h2>
                  <span className="text-sm text-gray-400">
                    {totalPlayable} of {totalSections} {totalSections === 1 ? 'game' : 'games'} ready
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full transition-all duration-500 rounded-full"
                    style={{ width: `${pct * 100}%`, backgroundColor: progressBarColor(pct) }}
                  />
                </div>
                {gamesCompleted > 0 && (
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-sm font-medium ${progressTextColor(pct)}`}>
                      {gamesCompleted}/{totalPlayable} completed
                    </span>
                  </div>
                )}
              </button>
            );
          }

          // Compute progress for regular + review chapters
          let totalProblems = 0;
          let totalCorrect = 0;

          sections.forEach(section => {
            const data = loadSectionData(chapter.folder, section.file);
            if (data) totalProblems += data.problems.length;
            const key = `${chapter.folder}-${section.id}`;
            const sp = progress.sections[key];
            if (sp) {
              totalCorrect += Object.values(sp.attempts).filter(a => a.correct).length;
            }
          });

          const pct = totalProblems > 0 ? totalCorrect / totalProblems : 0;
          const isReview = chapter.folder.endsWith('-review');

          // Review chapters: compact inline card
          if (isReview) {
            return (
              <button
                key={chapter.id}
                onClick={() => navigate(`/chapter/${chapter.folder}`)}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-left
                           active:scale-[0.98] transition-transform flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📝</span>
                    <h3 className="text-sm font-semibold text-gray-700 truncate">{chapter.title}</h3>
                    <span className="text-xs text-gray-400 shrink-0">{totalSections} sections</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                    <div
                      className="h-full transition-all duration-500 rounded-full"
                      style={{ width: `${pct * 100}%`, backgroundColor: progressBarColor(pct) }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {pct > 0 ? (
                    <span className={`text-xs font-medium ${progressTextColor(pct)}`}>
                      {Math.round(pct * 100)}%
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </div>
              </button>
            );
          }

          // Regular chapter: full card
          return (
            <button
              key={chapter.id}
              onClick={() => navigate(`/chapter/${chapter.folder}`)}
              className="w-full bg-white rounded-2xl shadow-md p-6 text-left
                         active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-gray-900">{chapter.title}</h2>
                <span className="text-sm text-gray-400">
                  {totalSections} sections
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full transition-all duration-500 rounded-full"
                  style={{ width: `${pct * 100}%`, backgroundColor: progressBarColor(pct) }}
                />
              </div>
              {pct > 0 && (
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-sm font-medium ${progressTextColor(pct)}`}>
                    {Math.round(pct * 100)}% complete
                  </span>
                  <span className="text-xs text-gray-400">
                    {totalCorrect}/{totalProblems} problems
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </main>

      <footer className="max-w-3xl mx-auto px-4 py-8 space-y-3">
        <div className="flex justify-center gap-4">
          <button
            onClick={onSwitchUser}
            className="text-sm text-gray-400 hover:text-gray-500 transition-colors"
          >
            Switch User ({userName})
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => navigate('/parent')}
            className="text-sm text-gray-400 hover:text-gray-500 transition-colors"
          >
            Parent Dashboard
          </button>
        </div>
        <div className="flex justify-center gap-4">
          <button
            onClick={onExport}
            className="text-sm text-gray-400 hover:text-gray-500 transition-colors"
          >
            Export Backup
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-sm text-gray-400 hover:text-gray-500 transition-colors"
          >
            Import Backup
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                try {
                  await onImport(file);
                  alert('Progress restored successfully!');
                } catch {
                  alert('Invalid backup file.');
                }
                e.target.value = '';
              }
            }}
          />
        </div>
      </footer>
    </div>
  );
}
