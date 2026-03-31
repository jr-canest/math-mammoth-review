import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadSections, loadSectionData } from '../lib/dataLoader';
import type { SectionData, SectionMeta } from '../lib/dataLoader';
import type { SectionProgress } from '../lib/progressStore';
import ProblemRow from './ProblemRow';
import MultiSelectRow from './MultiSelectRow';
import DualAnswerRow from './DualAnswerRow';
import GapRow from './GapRow';
import ProgressBar from './ProgressBar';
import CelebrationModal from './CelebrationModal';

interface ProblemViewProps {
  getSectionProgress: (key: string) => SectionProgress | null;
  markCorrect: (sectionKey: string, problemId: string, attemptCount: number, totalProblems: number, answer?: string) => void;
  markIncorrect: (sectionKey: string, problemId: string, attemptCount: number) => void;
  undoAnswer: (sectionKey: string, problemId: string, totalProblems: number) => void;
  clearSection: (sectionKey: string) => void;
  markSkipped: (sectionKey: string, problemId: string, totalProblems: number) => void;
  markUnskipped: (sectionKey: string, problemId: string, totalProblems: number) => void;
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
  markSkipped,
  markUnskipped,
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
      if (!data) return;

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
  const skippedCount = progress
    ? Object.values(progress.attempts).filter(a => a.skipped).length
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

  const handleSkip = useCallback(
    (problemId: string) => {
      markSkipped(sectionKey, problemId, totalProblems);
    },
    [markSkipped, sectionKey, totalProblems],
  );

  const handleUnskip = useCallback(
    (problemId: string) => {
      markUnskipped(sectionKey, problemId, totalProblems);
    },
    [markUnskipped, sectionKey, totalProblems],
  );

  const handleNextSection = () => {
    const currentIdx = sections.findIndex(s => s.id === sectionId);
    // Find next section that isn't marked needsReview
    let nextSection: SectionMeta | null = null;
    for (let i = currentIdx + 1; i < sections.length; i++) {
      const meta = sections[i];
      const data = loadSectionData(chapterId!, meta.file);
      if (data && !data.needsReview) {
        nextSection = meta;
        break;
      }
    }
    if (nextSection) {
      navigate(`/chapter/${chapterId}/${nextSection.id}`);
    } else {
      navigate(`/chapter/${chapterId}`);
    }
    setCelebration(null);
  };

  if (!sectionData) {
    const meta = sections.find(s => s.id === sectionId);
    // If sections have loaded and we found the meta but no problem data, the section is empty
    if (sections.length > 0 || meta) {
      return (
        <div className="min-h-screen bg-slate-50">
          <header className="bg-white shadow-sm sticky top-0 z-10">
            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => navigate(`/chapter/${chapterId}`)}
                className="p-2 -ml-2 text-indigo-600 active:scale-95 transition-transform"
              >
                ← Back
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-gray-900 truncate">{meta?.title ?? 'Section'}</h1>
                {meta?.pages && <p className="text-sm text-gray-500">Pages {meta.pages}</p>}
              </div>
            </div>
          </header>
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="text-5xl mb-4">📚</div>
            <div className="text-xl font-semibold text-gray-700 mb-2">Coming Soon!</div>
            <div className="text-gray-500 text-center">Problems for this section haven't been added yet.</div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-400">Loading...</div>
      </div>
    );
  }

  const currentIdx = sections.findIndex(s => s.id === sectionId);
  const currentMeta = currentIdx >= 0 ? sections[currentIdx] : null;
  const hasNext = currentIdx >= 0 && sections.slice(currentIdx + 1).some(s => {
    const d = loadSectionData(chapterId!, s.file);
    return d && !d.needsReview;
  });

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
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900 truncate">
                {sectionData.title}
              </h1>
              {currentMeta?.pacing && (
                <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
                  currentMeta.pacing.type === 'skip' ? 'bg-gray-100 text-gray-400' :
                  currentMeta.pacing.type === 'review' ? 'bg-purple-50 text-purple-400' :
                  'bg-blue-50 text-blue-500'
                }`}>
                  {currentMeta.pacing.type === 'half' ? 'lite' :
                   currentMeta.pacing.type === 'skip' ? 'skip?' :
                   currentMeta.pacing.type === 'review' ? 'review' :
                   'lite + review'}
                </span>
              )}
            </div>
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
                score >= 0.65 ? 'text-emerald-400' :
                score >= 0.4 ? 'text-green-400' :
                score >= 0.2 ? 'text-yellow-400' :
                score >= 0.1 ? 'text-amber-400' :
                score > 0 ? 'text-orange-400' :
                'text-gray-300'
              }`}>
                {Math.round(score * 100)}%
                {skippedCount > 0 && (
                  <span className="text-gray-400 font-normal ml-1">
                    ({skippedCount} skipped)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3">
          <ProgressBar
            total={totalProblems}
            correct={correctCount}
            incorrect={incorrectCount}
            skipped={skippedCount}
          />
        </div>
      </header>

      {/* Skip condition callout (section-level, shown for skip? sections) */}
      {currentMeta?.pacing?.condition && (
        <div className="max-w-3xl mx-auto px-4 pt-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
            <p className="text-xs text-gray-500 italic">{currentMeta.pacing.condition}</p>
          </div>
        </div>
      )}

      {/* Problems */}
      <main className="max-w-3xl mx-auto px-4 py-4 space-y-3 pb-24">
        {sectionData.problems.map((problem, idx) => {
          const attempt = progress?.attempts[problem.id];
          const isSkipped = attempt?.skipped === true;
          const isAnswered = attempt?.correct === true && !isSkipped;
          const prevGroup = idx > 0 ? sectionData.problems[idx - 1].group : undefined;
          const showGroupHeader = problem.group && problem.group !== prevGroup;
          return (
            <div key={problem.id}>
              {showGroupHeader && (
                <div className={`${idx > 0 ? 'mt-5' : ''} mb-2 px-1`}>
                  <p className="text-sm font-semibold text-gray-500 italic">
                    {problem.group}
                  </p>
                  {currentMeta?.pacing?.groups?.map((gp, gi) => {
                    if (problem.group && problem.group.includes(gp.group)) {
                      return (
                        <div key={gi} className="mt-1.5 flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
                          <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-600 rounded-full">lite</span>
                          <span className="text-xs text-blue-600/80">{gp.note}</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
              {/* Skipped state: greyed out with unskip option */}
              {isSkipped ? (
                <div className="relative rounded-2xl bg-gray-100 border-2 border-gray-200 p-4 opacity-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400 font-mono">{problem.label}</span>
                    <button
                      onClick={() => handleUnskip(problem.id)}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Unskip
                    </button>
                  </div>
                  <p className="text-sm text-gray-400 mt-1 truncate">{problem.display}</p>
                  <p className="text-xs text-gray-400 mt-1 italic">Skipped</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Skip button — subtle, inside card top-right with padding */}
                  {!isAnswered && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSkip(problem.id); }}
                      className="absolute top-3 right-3 z-[1] text-[10px] text-gray-300 hover:text-gray-400 transition-colors"
                    >
                      Skip
                    </button>
                  )}
              {problem.answer.type === 'multiselect' ? (
                <MultiSelectRow
                  problem={problem as any}
                  isCorrect={attempt?.correct ?? false}
                  previousAttempts={attempt?.attempts ?? 0}
                  savedAnswer={attempt?.answer}
                  onCorrect={(count, answer) => handleCorrect(problem.id, count, answer)}
                  onIncorrect={(count) => handleIncorrect(problem.id, count)}
                  playCorrect={playCorrect}
                  playIncorrect={playIncorrect}
                />
              ) : problem.answer.type === 'gap' ? (
                <GapRow
                  problem={problem as any}
                  isCorrect={attempt?.correct ?? false}
                  previousAttempts={attempt?.attempts ?? 0}
                  savedAnswer={attempt?.answer}
                  onCorrect={(count, answer) => handleCorrect(problem.id, count, answer)}
                  onIncorrect={(count) => handleIncorrect(problem.id, count)}
                  playCorrect={playCorrect}
                  playIncorrect={playIncorrect}
                />
              ) : problem.answer.type === 'dual' ? (
                <DualAnswerRow
                  problem={problem as any}
                  isCorrect={attempt?.correct ?? false}
                  previousAttempts={attempt?.attempts ?? 0}
                  savedAnswer={attempt?.answer}
                  onCorrect={(count, answer) => handleCorrect(problem.id, count, answer)}
                  onIncorrect={(count) => handleIncorrect(problem.id, count)}
                  playCorrect={playCorrect}
                  playIncorrect={playIncorrect}
                />
              ) : (
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
              )}
              </div>
              )}
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
          skippedCount={skippedCount}
          onClose={() => setCelebration(null)}
          onNextSection={hasNext ? handleNextSection : undefined}
        />
      )}
    </div>
  );
}
