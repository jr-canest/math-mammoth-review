import type { Answer } from './answerChecker';

export interface Chapter {
  id: string;
  title: string;
  folder: string;
  order: number;
}

export interface SectionMeta {
  id: string;
  title: string;
  pages: string;
  file: string;
  order: number;
}

export interface Problem {
  id: string;
  label: string;
  display: string;
  answer: Answer;
}

export interface SectionData {
  chapter: string;
  section: string;
  title: string;
  pages: string;
  problems: Problem[];
}

// Vite glob import for all chapter data
const chapterIndexModules = import.meta.glob<SectionMeta[]>('../data/*/index.json', { eager: true, import: 'default' });
const sectionDataModules = import.meta.glob<SectionData>('../data/*/*.json', { eager: true, import: 'default' });

export async function loadChapters(): Promise<Chapter[]> {
  const mod = await import('../data/chapters.json');
  return (mod.default as Chapter[]).sort((a, b) => a.order - b.order);
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
