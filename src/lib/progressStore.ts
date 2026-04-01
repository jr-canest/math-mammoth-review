import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const LOCAL_KEY_PREFIX = 'mathMammoth_progress_';

export interface ProblemAttempt {
  correct: boolean;
  attempts: number;
  lastAttempt: string;
  answer?: string;
  skipped?: boolean;
}

export interface SectionProgress {
  attempts: Record<string, ProblemAttempt>;
  completedAt: string | null;
  score: number;
}

export interface DailyLog {
  problemsAttempted: number;
  problemsCorrect: number;
  timeSpent: number;
}

export interface ProgressData {
  sections: Record<string, SectionProgress>;
  dailyLog: Record<string, DailyLog>;
  dataVersion?: number;
}

function getLocalProgress(userId: string): ProgressData {
  try {
    const stored = localStorage.getItem(LOCAL_KEY_PREFIX + userId);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { sections: {}, dailyLog: {} };
}

function saveLocalProgress(userId: string, data: ProgressData): void {
  localStorage.setItem(LOCAL_KEY_PREFIX + userId, JSON.stringify(data));
}

function mergeProgress(local: ProgressData, remote: ProgressData): ProgressData {
  const merged: ProgressData = {
    sections: { ...local.sections },
    dailyLog: { ...local.dailyLog },
    dataVersion: Math.max(local.dataVersion ?? 0, remote.dataVersion ?? 0),
  };

  // Merge sections - remote wins on conflict
  for (const [sectionId, remoteSection] of Object.entries(remote.sections)) {
    if (!merged.sections[sectionId]) {
      merged.sections[sectionId] = remoteSection;
    } else {
      const localSection = merged.sections[sectionId];
      // Merge attempts - keep whichever has correct:true, or most recent
      for (const [probId, remoteAttempt] of Object.entries(remoteSection.attempts)) {
        const localAttempt = localSection.attempts[probId];
        if (!localAttempt || remoteAttempt.correct ||
            (!localAttempt.correct && remoteAttempt.lastAttempt > localAttempt.lastAttempt)) {
          localSection.attempts[probId] = remoteAttempt;
        }
      }
      // Recalculate score
      const attemptValues = Object.values(localSection.attempts);
      const correctCount = attemptValues.filter(a => a.correct).length;
      localSection.score = attemptValues.length > 0 ? correctCount / attemptValues.length : 0;
      if (remoteSection.completedAt) {
        localSection.completedAt = remoteSection.completedAt;
      }
    }
  }

  // Merge daily log - remote wins
  for (const [date, remoteDay] of Object.entries(remote.dailyLog)) {
    if (!merged.dailyLog[date] ||
        remoteDay.problemsAttempted > merged.dailyLog[date].problemsAttempted) {
      merged.dailyLog[date] = remoteDay;
    }
  }

  return merged;
}

export async function loadProgress(userId: string): Promise<ProgressData> {
  const local = getLocalProgress(userId);

  try {
    const docRef = doc(db, 'mathMammoth', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const remote = docSnap.data() as ProgressData;

      // If remote has a higher dataVersion (e.g. after a reset), use remote entirely
      const remoteVersion = remote.dataVersion ?? 0;
      const localVersion = local.dataVersion ?? 0;
      if (remoteVersion > localVersion) {
        saveLocalProgress(userId, remote);
        return remote;
      }

      const merged = mergeProgress(local, remote);
      saveLocalProgress(userId, merged);
      return merged;
    }
  } catch (e) {
    console.warn('Firebase load failed, using local data:', e);
  }

  return local;
}

export async function saveProgress(userId: string, data: ProgressData): Promise<void> {
  saveLocalProgress(userId, data);

  try {
    const docRef = doc(db, 'mathMammoth', userId);
    await setDoc(docRef, data, { merge: true });
  } catch (e) {
    console.warn('Firebase save failed, saved locally:', e);
  }
}

export function recordCorrectAnswer(
  progress: ProgressData,
  sectionKey: string,
  problemId: string,
  attemptCount: number,
  totalProblems: number,
  answer?: string,
): ProgressData {
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  const section = progress.sections[sectionKey] || {
    attempts: {},
    completedAt: null,
    score: 0,
  };

  section.attempts[problemId] = {
    correct: true,
    attempts: attemptCount,
    lastAttempt: now,
    answer,
  };

  const attemptValues = Object.values(section.attempts);
  const correctCount = attemptValues.filter(a => a.correct).length;
  const skippedCount = attemptValues.filter(a => a.skipped).length;
  const effectiveTotal = totalProblems - skippedCount;
  section.score = effectiveTotal > 0 ? (correctCount - skippedCount) / effectiveTotal : (skippedCount > 0 ? 1 : 0);

  if (correctCount === totalProblems) {
    section.completedAt = now;
  }

  const daily = progress.dailyLog[today] || {
    problemsAttempted: 0,
    problemsCorrect: 0,
    timeSpent: 0,
  };
  daily.problemsAttempted += 1;
  daily.problemsCorrect += 1;

  return {
    sections: { ...progress.sections, [sectionKey]: section },
    dailyLog: { ...progress.dailyLog, [today]: daily },
  };
}

export function removeAnswer(
  progress: ProgressData,
  sectionKey: string,
  problemId: string,
  totalProblems: number,
): ProgressData {
  const section = progress.sections[sectionKey];
  if (!section) return progress;

  const { [problemId]: _removed, ...remaining } = section.attempts;

  const remainingValues = Object.values(remaining);
  const correctCount = remainingValues.filter(a => a.correct).length;
  const skippedCount = remainingValues.filter(a => a.skipped).length;
  const effectiveTotal = totalProblems - skippedCount;

  return {
    ...progress,
    sections: {
      ...progress.sections,
      [sectionKey]: {
        attempts: remaining,
        completedAt: null,
        score: effectiveTotal > 0 ? (correctCount - skippedCount) / effectiveTotal : 0,
      },
    },
  };
}

export function recordIncorrectAttempt(
  progress: ProgressData,
  sectionKey: string,
  problemId: string,
  attemptCount: number,
): ProgressData {
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  const section = progress.sections[sectionKey] || {
    attempts: {},
    completedAt: null,
    score: 0,
  };

  const existing = section.attempts[problemId];
  if (!existing || !existing.correct) {
    section.attempts[problemId] = {
      correct: false,
      attempts: attemptCount,
      lastAttempt: now,
    };
  }

  const daily = progress.dailyLog[today] || {
    problemsAttempted: 0,
    problemsCorrect: 0,
    timeSpent: 0,
  };
  daily.problemsAttempted += 1;

  return {
    sections: { ...progress.sections, [sectionKey]: section },
    dailyLog: { ...progress.dailyLog, [today]: daily },
  };
}

export function clearSection(
  progress: ProgressData,
  sectionKey: string,
): ProgressData {
  const { [sectionKey]: _removed, ...remainingSections } = progress.sections;
  return {
    ...progress,
    sections: remainingSections,
  };
}

export function skipProblem(
  progress: ProgressData,
  sectionKey: string,
  problemId: string,
  totalProblems: number,
): ProgressData {
  const now = new Date().toISOString();
  const section = progress.sections[sectionKey] || {
    attempts: {},
    completedAt: null,
    score: 0,
  };

  section.attempts[problemId] = {
    correct: true,
    attempts: 0,
    lastAttempt: now,
    skipped: true,
  };

  // Recalculate score: answered correct / effective total (excluding skipped)
  const attemptValues = Object.values(section.attempts);
  const correctCount = attemptValues.filter(a => a.correct).length;
  const skippedCount = attemptValues.filter(a => a.skipped).length;
  const effectiveTotal = totalProblems - skippedCount;
  section.score = effectiveTotal > 0 ? (correctCount - skippedCount) / effectiveTotal : (skippedCount > 0 ? 1 : 0);

  if (correctCount === totalProblems) {
    section.completedAt = now;
  }

  return {
    ...progress,
    sections: { ...progress.sections, [sectionKey]: section },
  };
}

export function unskipProblem(
  progress: ProgressData,
  sectionKey: string,
  problemId: string,
  totalProblems: number,
): ProgressData {
  const section = progress.sections[sectionKey];
  if (!section) return progress;

  const { [problemId]: _removed, ...remaining } = section.attempts;
  const remainingValues = Object.values(remaining);
  const correctCount = remainingValues.filter(a => a.correct).length;
  const skippedCount = remainingValues.filter(a => a.skipped).length;
  const effectiveTotal = totalProblems - skippedCount;

  return {
    ...progress,
    sections: {
      ...progress.sections,
      [sectionKey]: {
        attempts: remaining,
        completedAt: null,
        score: effectiveTotal > 0 ? (correctCount - skippedCount) / effectiveTotal : 0,
      },
    },
  };
}

/** Downloads a JSON backup of the user's progress */
export function exportProgressToFile(progress: ProgressData, userId: string): void {
  const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `math-mammoth-backup-${userId}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Imports progress from a JSON file, saves to Firebase + local, returns the data */
export async function importProgressFromFile(userId: string, file: File): Promise<ProgressData> {
  const text = await file.text();
  const data = JSON.parse(text) as ProgressData;
  if (!data.sections || !data.dailyLog) {
    throw new Error('Invalid progress file');
  }
  await saveProgress(userId, data);
  return data;
}
