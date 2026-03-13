import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadSections, loadSectionData } from '../lib/dataLoader';
import type { SectionData, SectionMeta } from '../lib/dataLoader';
import type { SectionProgress } from '../lib/progressStore';
import ProblemRow from './ProblemRow';
import ProgressBar from './ProgressBar';
import CelebrationModal from './CelebrationModal';

interface ProblemViewProps {
  getSectionProgress: (key: string) => SectionProgress | null;
  markCorrect: (sectionKey: string, problemId: string, attemptCount: number, totalProblems: number, answer?: string) => void;
  markIncorrect: (sectionKey: string, problemId: string, attemptCount: number) => void;
  undoAnswer: (sectionKey: string, problemId: string, totalProblems: number) => void;
  clearSection: (sectionKey: string) => void;
  playCorrect: () => void;
  playIncorrect: () => void;
  playMilestone: () => void;
  playComplete: () => void;
}

export default function ProblemView({
  getSectionProgress,
  markCorrect,
  markIncorrect,
  undoAnswer,
  clearSection,
  playCorrect,
  playIncorrect,
  playMilestone,
  playComplete,
}: ProblemViewProps) {
  const { chapterId, sectionId } = useParams<{ chapterId: string; sectionId: string }>();
  const navigate = useNavigate();
  const [sectionData, setSectionData] = useState<SectionData | null>(null);
  const [sections, setSections] = useState<SectionMeta[]>([]);
  const [celebration, setCelebration] = useState<'halfway' | 'milestone' | 'complete' | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const halfwayShownRef = useRef(false);
  const milestoneShownRef = useRef(false);
  const completeShownRef = useRef(false);

  const sectionKey = `${chapterId}-${sectionId}`;

  useEffect(() => {
    if (!chapterId || !sectionId) return;
    const allSections = loadSections(chapterId);
    setSections(allSections);
    const meta = allSections.find(s => s.id === sectionId);
    if (meta) {
      const data = loadSectionData(chapterId, meta.file);
      setSectionData(data);

      // Initialize celebration refs based on current progress so we don't
      // re-celebrate milestones that were already reached in a prior visit.
      const key = `${chapterId}-${sectionId}`;
      const sp = getSectionProgress(key);
      const total = data.problems.length;
      const correct = sp ? Object.values(sp.attempts).filter(a => a.correct).length : 0;
      const currentScore = total > 0 ? correct / total : 0;
      halfwayShownRef.current = currentScore >= 0.5;
      milestoneShownRef.current = currentScore >= 0.8;
      completeShownRef.current = currentScore >= 1;
    } else {
      halfwayShownRef.current = false;
      milestoneShownRef.current = false;
      completeShownRef.current = false;
    }
  }, [chapterId, sectionId]);

  const progress = getSectionProgress(sectionKey);
  const totalProblems = sectionData?.problems.length ?? 0;

  const correctCount = progress
    ? Object.values(progress.attempts).filter(a => a.correct).length
    : 0;
  const incorrectCount = progress
    ? Object.values(progress.attempts).filter(a => !a.correct).length
    : 0;

  const score = totalProblems > 0 ? correctCount / totalProblems : 0;

  // Check for milestones
  useEffect(() => {
    if (score >= 1 && !completeShownRef.current && totalProblems > 0) {
      completeShownRef.current = true;
      milestoneShownRef.current = true;
      halfwayShownRef.current = true;
      setCelebration('complete');
      playComplete();
    } else if (score >= 0.8 && !milestoneShownRef.current && totalProblems > 0) {
      milestoneShownRef.current = true;
      halfwayShownRef.current = true;
      setCelebration('milestone');
      playMilestone();
    } else if (score >= 0.5 && !halfwayShownRef.current && totalProblems > 0) {
      halfwayShownRef.current = true;
      setCelebration('halfway');
      playMilestone();
    }
  }, [score, totalProblems, playComplete, playMilestone]);

  const handleCorrect = useCallback(
    (problemId: string, attemptCount: number, answer: string) => {
      markCorrect(sectionKey, problemId, attemptCount, totalProblems, answer);
    },
    [markCorrect, sectionKey, totalProblems],
  );

  const handleIncorrect = useCallback(
    (problemId: string, attemptCount: number) => {
      markIncorrect(sectionKey, problemId, attemptCount);
    },
    [markIncorrect, sectionKey],
  );

  const handleUndo = useCallback(
    (problemId: string) => {
      undoAnswer(sectionKey, problemId, totalProblems);
    },
    [undoAnswer, sectionKey, totalProblems],
  );

  const handleNextSection = () => {
    const currentIdx = sections.findIndex(s => s.id === sectionId);
    if (currentIdx >= 0 && currentIdx < sections.length - 1) {
      navigate(`/chapter/${chapterId}/${sections[currentIdx + 1].id}`);
    } else {
      navigate(`/chapter/${chapterId}`);
    }
    setCelebration(null);
  };

  if (!sectionData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-400">Loading...</div>
      </div>
    );
  }

  const currentIdx = sections.findIndex(s => s.id === sectionId);
  const hasNext = currentIdx >= 0 && currentIdx < sections.length - 1;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(`/chapter/${chapterId}`)}
            className="p-2 -ml-2 text-indigo-600 active:scale-95 transition-transform"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">
              {sectionData.title}
            </h1>
            <p className="text-sm text-gray-500">Pages {sectionData.pages}</p>
          </div>
          <div className="text-right shrink-0">
            <span className={`text-lg font-bold ${
              score >= 1 ? 'text-emerald-600' :
              score >= 0.65 ? 'text-emerald-500' :
              score >= 0.4 ? 'text-green-500' :
              score >= 0.2 ? 'text-yellow-500' :
              score >= 0.1 ? 'text-amber-500' :
              score > 0 ? 'text-orange-500' :
              'text-gray-400'
            }`}>
              {correctCount}/{totalProblems}
            </span>
            {totalProblems > 0 && (
              <p className={`text-xs font-medium ${
                score >= 1 ? 'text-emerald-500' :
                score >= 0.8 ? 'text-emerald-400' :
                score > 0 ? 'text-gray-400' :
                'text-gray-300'
              }`}>
                {Math.round(score * 100)}%
              </p>
            )}
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3">
          <ProgressBar
            total={totalProblems}
            correct={correctCount}
            incorrect={incorrectCount}
          />
        </div>
      </header>

      {/* Problems */}
      <main className="max-w-3xl mx-auto px-4 py-4 space-y-3 pb-24">
        {sectionData.problems.map((problem, idx) => {
          const attempt = progress?.attempts[problem.id];
          const prevGroup = idx > 0 ? sectionData.problems[idx - 1].group : undefined;
          const showGroupHeader = problem.group && problem.group !== prevGroup;
          return (
            <div key={problem.id}>
              {showGroupHeader && (
                <div className={`${idx > 0 ? 'mt-5' : ''} mb-2 px-1`}>
                  <p className="text-sm font-semibold text-gray-500 italic">
                    {problem.group}
                  </p>
                </div>
              )}
              <ProblemRow
                problem={problem}
                isCorrect={attempt?.correct ?? false}
                previousAttempts={attempt?.attempts ?? 0}
                savedAnswer={attempt?.answer}
                onCorrect={(count, answer) => handleCorrect(problem.id, count, answer)}
                onIncorrect={(count) => handleIncorrect(problem.id, count)}
                onUndo={problem.answer.type === 'workbook' ? () => handleUndo(problem.id) : undefined}
                playCorrect={playCorrect}
                playIncorrect={playIncorrect}
              />
            </div>
          );
        })}

        {/* Reset section progress */}
        {correctCount > 0 && (
          <div className="mt-8 flex flex-col items-center gap-2">
            {!confirmingReset ? (
              <button
                onClick={() => setConfirmingReset(true)}
                className="text-xs text-gray-400 hover:text-gray-500 transition-colors"
              >
                Reset section progress
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-gray-500">Clear all answers for this section?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      clearSection(sectionKey);
                      setConfirmingReset(false);
                      halfwayShownRef.current = false;
                      milestoneShownRef.current = false;
                      completeShownRef.current = false;
                    }}
                    className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg
                               hover:bg-red-100 transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setConfirmingReset(false)}
                    className="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg
                               hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Celebration Modal */}
      {celebration && (
        <CelebrationModal
          type={celebration}
          sectionTitle={sectionData.title}
          score={score}
          onClose={() => setCelebration(null)}
          onNextSection={hasNext ? handleNextSection : undefined}
        />
      )}
    </div>
  );
}
