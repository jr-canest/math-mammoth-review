import { useParams, useNavigate } from 'react-router-dom';
import { loadSections } from '../lib/dataLoader';
import type { ProgressData } from '../lib/progressStore';

interface SectionSelectProps {
  progress: ProgressData;
}

function getStatusColor(score: number | null, completed: boolean): string {
  if (completed) return 'bg-amber-400'; // gold for 100%
  if (score !== null && score >= 0.8) return 'bg-emerald-500';
  if (score !== null && score > 0) return 'bg-indigo-500';
  return 'bg-gray-300';
}

function getStatusLabel(score: number | null, completed: boolean): string {
  if (completed) return 'Complete!';
  if (score !== null && score > 0) return `${Math.round(score * 100)}%`;
  return 'Not started';
}

export default function SectionSelect({ progress }: SectionSelectProps) {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();

  if (!chapterId) return null;

  const sections = loadSections(chapterId);

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
          <h1 className="text-xl font-bold text-gray-900">Sections</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        {sections.map(section => {
          const key = `${chapterId}-${section.id}`;
          const sp = progress.sections[key];
          const score = sp?.score ?? null;
          const completed = !!sp?.completedAt;
          const statusColor = getStatusColor(score, completed);
          const statusLabel = getStatusLabel(score, completed);

          return (
            <button
              key={section.id}
              onClick={() => navigate(`/chapter/${chapterId}/${section.id}`)}
              className="w-full bg-white rounded-xl shadow-sm p-4 text-left flex items-center gap-4
                         active:scale-[0.98] transition-transform border-2 border-transparent
                         hover:border-indigo-100"
            >
              {/* Status dot */}
              <div className={`w-3 h-3 rounded-full shrink-0 ${statusColor}`} />

              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {section.title}
                </h3>
                <p className="text-sm text-gray-400">Pages {section.pages}</p>
              </div>

              <span className={`text-sm font-medium shrink-0 ${
                completed ? 'text-amber-600' :
                score !== null && score >= 0.8 ? 'text-emerald-600' :
                score !== null && score > 0 ? 'text-indigo-600' :
                'text-gray-400'
              }`}>
                {statusLabel}
              </span>
            </button>
          );
        })}
      </main>
    </div>
  );
}
