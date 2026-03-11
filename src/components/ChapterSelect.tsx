import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadChapters, loadSections } from '../lib/dataLoader';
import type { Chapter } from '../lib/dataLoader';
import type { ProgressData } from '../lib/progressStore';

interface ChapterSelectProps {
  progress: ProgressData;
}

export default function ChapterSelect({ progress }: ChapterSelectProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const navigate = useNavigate();

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

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {chapters.map(chapter => {
          const sections = loadSections(chapter.folder);
          const totalSections = sections.length;
          let completedSections = 0;
          let totalScore = 0;

          sections.forEach(section => {
            const key = `${chapter.folder}-${section.id}`;
            const sp = progress.sections[key];
            if (sp?.completedAt) completedSections++;
            if (sp) totalScore += sp.score;
          });

          const avgProgress = totalSections > 0 ? (totalScore / totalSections) : 0;

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
                  {completedSections}/{totalSections} sections
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-500 rounded-full"
                  style={{ width: `${avgProgress * 100}%` }}
                />
              </div>
              {avgProgress > 0 && (
                <p className="text-sm text-indigo-600 mt-2 font-medium">
                  {Math.round(avgProgress * 100)}% complete
                </p>
              )}
            </button>
          );
        })}
      </main>

      <footer className="max-w-3xl mx-auto px-4 py-8 text-center">
        <button
          onClick={() => navigate('/parent')}
          className="text-sm text-gray-400 hover:text-gray-500 transition-colors"
        >
          Parent Dashboard
        </button>
      </footer>
    </div>
  );
}
