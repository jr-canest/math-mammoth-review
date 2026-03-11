import { HashRouter, Routes, Route } from 'react-router-dom';
import { useProgress } from './hooks/useProgress';
import { useSound } from './hooks/useSound';
import ChapterSelect from './components/ChapterSelect';
import SectionSelect from './components/SectionSelect';
import ProblemView from './components/ProblemView';
import ParentDashboard from './components/ParentDashboard';

export default function App() {
  const { progress, loading, markCorrect, markIncorrect, getSectionProgress } = useProgress();
  const { muted, toggleMute, playCorrect, playIncorrect, playMilestone, playComplete } = useSound();

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
        <Route path="/" element={<ChapterSelect progress={progress} />} />
        <Route path="/chapter/:chapterId" element={<SectionSelect progress={progress} />} />
        <Route
          path="/chapter/:chapterId/:sectionId"
          element={
            <ProblemView
              getSectionProgress={getSectionProgress}
              markCorrect={markCorrect}
              markIncorrect={markIncorrect}
              playCorrect={playCorrect}
              playIncorrect={playIncorrect}
              playMilestone={playMilestone}
              playComplete={playComplete}
            />
          }
        />
        <Route path="/parent" element={<ParentDashboard progress={progress} />} />
      </Routes>
    </HashRouter>
  );
}
