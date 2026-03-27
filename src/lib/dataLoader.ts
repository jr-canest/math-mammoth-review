import type { Answer } from './answerChecker';

export interface Chapter {
  id: string;
  title: string;
  folder: string;
  order: number;
}

export interface GroupPacing {
  /** Substring match against the group text in problem data */
  group: string;
  note: string;
}

export interface PacingInfo {
  type: 'half' | 'skip' | 'review' | 'half-review';
  note: string;
  /** Per-group suggestions shown inline under group headers */
  groups?: GroupPacing[];
  /** For 'skip' type: the diagnostic condition */
  condition?: string;
}

export interface SectionMeta {
  id: string;
  title: string;
  pages: string;
  file: string;
  order: number;
  type?: 'game';
  component?: string;
  subtitle?: string;
  week?: number;
  pacing?: PacingInfo;
}

export interface Problem {
  id: string;
  label: string;
  display: string;
  answer: Answer;
  image?: string;
  group?: string;
  variables?: string[];
}

export interface SectionData {
  chapter: string;
  section: string;
  title: string;
  pages: string;
  needsReview?: boolean;
  problems: Problem[];
}

// Vite glob import for all chapter data
const chapterIndexModules = import.meta.glob<SectionMeta[]>('../data/*/index.json', { eager: true, import: 'default' });
const sectionDataModules = import.meta.glob<SectionData>('../data/*/*.json', { eager: true, import: 'default' });

const chaptersModule = import.meta.glob<Chapter[]>('../data/chapters.json', { eager: true, import: 'default' });

export function loadChaptersSync(): Chapter[] {
  const data = chaptersModule['../data/chapters.json'];
  if (!data) return [];
  return [...data].sort((a, b) => a.order - b.order);
}

export async function loadChapters(): Promise<Chapter[]> {
  return loadChaptersSync();
}

export function loadSections(chapterFolder: string): SectionMeta[] {
  const key = `../data/${chapterFolder}/index.json`;
  const data = chapterIndexModules[key];
  if (!data) return [];
  return [...data].sort((a, b) => a.order - b.order);
}

export function loadSectionData(chapterFolder: string, sectionFile: string): SectionData | null {
  const key = `../data/${chapterFolder}/${sectionFile}`;
  return sectionDataModules[key] || null;
}
