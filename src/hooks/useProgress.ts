import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProgressData } from '../lib/progressStore';
import {
  loadProgress,
  saveProgress,
  recordCorrectAnswer,
  recordIncorrectAttempt,
  removeAnswer,
  clearSection as clearSectionData,
  skipProblem as skipProblemData,
  unskipProblem as unskipProblemData,
  exportProgressToFile,
  importProgressFromFile,
} from '../lib/progressStore';

export function useProgress(userId: string | null) {
  const [progress, setProgress] = useState<ProgressData>({ sections: {}, dailyLog: {} });
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef(userId);

  useEffect(() => {
    userIdRef.current = userId;
    if (!userId) {
      setProgress({ sections: {}, dailyLog: {} });
      setLoading(false);
      return;
    }
    setLoading(true);
    loadProgress(userId).then(data => {
      setProgress(data);
      setLoading(false);
    });
  }, [userId]);

  const debouncedSave = useCallback((data: ProgressData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (userIdRef.current) {
        saveProgress(userIdRef.current, data);
      }
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

  const undoAnswer = useCallback(
    (sectionKey: string, problemId: string, totalProblems: number) => {
      setProgress(prev => {
        const next = removeAnswer(prev, sectionKey, problemId, totalProblems);
        debouncedSave(next);
        return next;
      });
    },
    [debouncedSave],
  );

  const clearSection = useCallback(
    (sectionKey: string) => {
      setProgress(prev => {
        const next = clearSectionData(prev, sectionKey);
        debouncedSave(next);
        return next;
      });
    },
    [debouncedSave],
  );

  const markSkipped = useCallback(
    (sectionKey: string, problemId: string, totalProblems: number) => {
      setProgress(prev => {
        const next = skipProblemData(prev, sectionKey, problemId, totalProblems);
        debouncedSave(next);
        return next;
      });
    },
    [debouncedSave],
  );

  const markUnskipped = useCallback(
    (sectionKey: string, problemId: string, totalProblems: number) => {
      setProgress(prev => {
        const next = unskipProblemData(prev, sectionKey, problemId, totalProblems);
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

  const exportData = useCallback(() => {
    if (userIdRef.current) {
      exportProgressToFile(progress, userIdRef.current);
    }
  }, [progress]);

  const importData = useCallback(async (file: File) => {
    if (!userIdRef.current) return;
    const data = await importProgressFromFile(userIdRef.current, file);
    setProgress(data);
  }, []);

  return { progress, loading, markCorrect, markIncorrect, undoAnswer, clearSection, markSkipped, markUnskipped, getSectionProgress, exportData, importData };
}
