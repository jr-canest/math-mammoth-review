import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProgressData } from '../lib/progressStore';
import {
  loadProgress,
  saveProgress,
  recordCorrectAnswer,
  recordIncorrectAttempt,
} from '../lib/progressStore';

export function useProgress() {
  const [progress, setProgress] = useState<ProgressData>({ sections: {}, dailyLog: {} });
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadProgress().then(data => {
      setProgress(data);
      setLoading(false);
    });
  }, []);

  const debouncedSave = useCallback((data: ProgressData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveProgress(data);
    }, 1000);
  }, []);

  const markCorrect = useCallback(
    (sectionKey: string, problemId: string, attemptCount: number, totalProblems: number, answer?: string) => {
      setProgress(prev => {
        const next = recordCorrectAnswer(prev, sectionKey, problemId, attemptCount, totalProblems, answer);
        debouncedSave(next);
        return next;
      });
    },
    [debouncedSave],
  );

  const markIncorrect = useCallback(
    (sectionKey: string, problemId: string, attemptCount: number) => {
      setProgress(prev => {
        const next = recordIncorrectAttempt(prev, sectionKey, problemId, attemptCount);
        debouncedSave(next);
        return next;
      });
    },
    [debouncedSave],
  );

  const getSectionProgress = useCallback(
    (sectionKey: string) => progress.sections[sectionKey] || null,
    [progress],
  );

  return { progress, loading, markCorrect, markIncorrect, getSectionProgress };
}
