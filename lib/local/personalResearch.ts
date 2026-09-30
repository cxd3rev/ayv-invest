export type ThesisNote = {
  why: string;
  timeframe: string;
  bull: string;
  bear: string;
  risks: string;
  catalysts: string;
  sell: string;
  status: string;
  metrics: string;
  target: string;
  reviewedAt: string;
  updatedAt: string;
};

export type ResearchNote = {
  id: string;
  symbol: string;
  body: string;
  tags: string;
  link: string;
  createdAt: string;
  updatedAt: string;
};

export type JournalEntry = {
  id: string;
  symbol: string;
  portfolio: string;
  date: string;
  decision: string;
  reason: string;
  expectation: string;
  result: string;
  lessons: string;
  createdAt: string;
};

export type PriceTarget = {
  id: string;
  symbol: string;
  name: string;
  target: number;
  currency: string;
  createdAt: string;
};

const THESIS_KEY = "ayv-invest.theses";
const NOTES_KEY = "ayv-invest.research-notes";
const JOURNAL_KEY = "ayv-invest.research-journal";
const TARGET_KEY = "ayv-invest.targets";

export const emptyThesis = (): ThesisNote => ({
  why: "",
  timeframe: "",
  bull: "",
  bear: "",
  risks: "",
  catalysts: "",
  sell: "",
  status: "",
  metrics: "",
  target: "",
  reviewedAt: "",
  updatedAt: "",
});

function readMap<T>(key: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "{}") as Record<string, T>;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]") as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readTheses() {
  return readMap<Partial<ThesisNote>>(THESIS_KEY);
}

export function saveThesis(symbol: string, note: ThesisNote) {
  const all = readTheses();
  all[symbol] = { ...all[symbol], ...note, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(THESIS_KEY, JSON.stringify(all));
}

export function readResearchNotes() {
  return readList<ResearchNote>(NOTES_KEY);
}

export function saveResearchNotes(notes: ResearchNote[]) {
  window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes.slice(0, 40)));
}

export function readResearchJournal() {
  return readList<JournalEntry>(JOURNAL_KEY);
}

export function saveResearchJournal(entries: JournalEntry[]) {
  window.localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries.slice(0, 40)));
}

export function readPriceTargets() {
  return readList<PriceTarget>(TARGET_KEY);
}

export function savePriceTargets(targets: PriceTarget[]) {
  window.localStorage.setItem(TARGET_KEY, JSON.stringify(targets.slice(0, 40)));
}
