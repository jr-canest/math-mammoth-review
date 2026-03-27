import { useState, useCallback } from 'react';
import { HashRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { useProgress } from './hooks/useProgress';
import { useSound } from './hooks/useSound';
import { loadSections } from './lib/dataLoader';
import UserSelect from './components/UserSelect';
import ChapterSelect from './components/ChapterSelect';
import SectionSelect from './components/SectionSelect';
import ProblemView from './components/ProblemView';
import ParentDashboard from './components/ParentDashboard';
import MathMachines from './components/games/MathMachines';
import EquationSolver from './components/games/EquationSolver';

interface SectionRouterProps {
  gameComponents: Record<string, React.ComponentType<{ onComplete?: (score: number) => void }>>;
  problemViewProps: React.ComponentProps<typeof ProblemView>;
  markCorrect: (sectionKey: string, problemId: string, attemptCount: number, totalProblems: number, answer?: string) => void;
}

function SectionRouter({ gameComponents, problemViewProps, markCorrect }: SectionRouterProps) {
  const { chapterId, sectionId } = useParams<{ chapterId: string; sectionId: string }>();
  const navigate = useNavigate();

  if (!chapterId || !sectionId) return null;

  const sections = loadSections(chapterId);
  const section = sections.find(s => s.id === sectionId);

  if (section?.type === 'game' && section.component && gameComponents[section.component]) {
    const GameComponent = gameComponents[section.component];
    const sectionKey = `${chapterId}-${sectionId}`;
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
            <button
              onClick={() => navigate(`/chapter/${chapterId}`)}
              className="p-2 -ml-2 text-indigo-600 active:scale-95 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-gray-900">{section.title}</h1>
          </div>
        </header>
        <GameComponent
          onComplete={() => {
            markCorrect(sectionKey, 'game-complete', 1, 1);
          }}
        />
      </div>
    );
  }

  return <ProblemView {...problemViewProps} />;
}

export default function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const { progress, loading, markCorrect, markIncorrect, undoAnswer, clearSection, getSectionProgress, exportData, importData } = useProgress(userId);
  const { muted, toggleMute, playCorrect, playIncorrect, playMilestone, playComplete } = useSound();

  const handleSwitchUser = useCallback(() => {
    window.location.hash = '#/';
    setUserId(null);
  }, []);

  if (!userId) {
    return <UserSelect onSelect={setUserId} />;
  }

  const gameComponents: Record<string, React.ComponentType<{ onComplete?: (score: number) => void }>> = {
    MathMachines,
    EquationSolver,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-xl text-indigo-400 font-semibold">Loading...</div>
      </div>
    );
  }

  return (
    <HashRouter>
      {/* Global mute toggle */}
      <button
        onClick={toggleMute}
        className="fixed bottom-4 right-4 z-50 w-11 h-11 rounded-full bg-white shadow-lg
                   flex items-center justify-center text-xl border border-gray-200
                   active:scale-90 transition-transform"
        aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      >
        {muted ? '🔇' : '🔊'}
      </button>

      <Routes>
        <Route path="/" element={<ChapterSelect progress={progress} onSwitchUser={handleSwitchUser} userName={userId} onExport={exportData} onImport={importData} />} />
        <Route path="/chapter/:chapterId" element={<SectionSelect progress={progress} />} />
        <Route
          path="/chapter/:chapterId/:sectionId"
          element={
            <SectionRouter
              gameComponents={gameComponents}
              problemViewProps={{
                getSectionProgress,
                markCorrect,
                markIncorrect,
                undoAnswer,
                clearSection,
                playCorrect,
                playIncorrect,
                playMilestone,
                playComplete,
              }}
              markCorrect={markCorrect}
            />
          }
        />
        <Route path="/parent" element={<ParentDashboard progress={progress} />} />
      </Routes>
    </HashRouter>
  );
}
