"use client";

import { useState, useSyncExternalStore } from "react";
import { formatMoney, formatPercent } from "@/lib/format";
import { todayISO } from "@/lib/dates";
import { brokerStatus } from "@/lib/brokers/provider";
import { readResearchJournal, readResearchNotes } from "@/lib/local/personalResearch";
import {
  compoundProjection,
  contributionStats,
  nextContributionDate,
  progressPercent,
  requiredMonthlyAmount,
  wholeMonthsUntil,
} from "@/lib/planning/math";
import { feesByCurrency } from "@/lib/portfolio/insights";
import { answerPortfolioQuestion, todayFacts } from "@/lib/portfolio/desk";
import type { PortfolioView } from "@/lib/portfolio/types";

type Goal = {
  id: string;
  name: string;
  target: number;
  measure: "portfolio" | "manual";
  manual: number;
  date: string;
};

type Schedule = {
  id: string;
  amount: number;
  every: "week" | "month";
  symbol: string;
  started: string;
};

const GOAL_KEY = "ayv-invest.goal-list";
const SCHEDULE_KEY = "ayv-invest.schedules";
const LEGACY_GOAL = "ayv-invest.goals";

const EMPTY_GOALS: Goal[] = [];
const EMPTY_SCHEDULES: Schedule[] = [];
let goalRaw = "";
let goalList: Goal[] = EMPTY_GOALS;
let scheduleRaw = "";
let scheduleList: Schedule[] = EMPTY_SCHEDULES;

function readGoals(): Goal[] {
  if (typeof window === "undefined") return goalList;
  const raw = window.localStorage.getItem(GOAL_KEY) ?? "[]";
  if (raw === goalRaw) return goalList;
  goalRaw = raw;
  try {
    const parsed = JSON.parse(raw) as Goal[];
    goalList = Array.isArray(parsed) ? parsed : EMPTY_GOALS;
  } catch {
    goalList = EMPTY_GOALS;
  }
  return goalList;
}

function readSchedules(): Schedule[] {
  if (typeof window === "undefined") return scheduleList;
  const raw = window.localStorage.getItem(SCHEDULE_KEY) ?? "[]";
  if (raw === scheduleRaw) return scheduleList;
  scheduleRaw = raw;
  try {
    const parsed = JSON.parse(raw) as Schedule[];
    scheduleList = Array.isArray(parsed) ? parsed : EMPTY_SCHEDULES;
  } catch {
    scheduleList = EMPTY_SCHEDULES;
  }
  return scheduleList;
}

export function PlanBoard({ view }: { view: PortfolioView }) {
  const goals = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-plan", callback);
      return () => window.removeEventListener("ayv-plan", callback);
    },
    readGoals,
    () => EMPTY_GOALS,
  );
  const schedules = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-plan", callback);
      return () => window.removeEventListener("ayv-plan", callback);
    },
    readSchedules,
    () => EMPTY_SCHEDULES,
  );
  const legacy = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-goal", callback);
      return () => window.removeEventListener("ayv-goal", callback);
    },
    () => (typeof window === "undefined" ? "" : window.localStorage.getItem(LEGACY_GOAL) ?? ""),
    () => "",
  );
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [backupNote, setBackupNote] = useState<string | null>(null);

  function saveGoals(next: Goal[]) {
    window.localStorage.setItem(GOAL_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("ayv-plan"));
  }

  function saveSchedules(next: Schedule[]) {
    window.localStorage.setItem(SCHEDULE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("ayv-plan"));
  }

  const explained = todayFacts(view);
  const legacyTarget = Number(legacy);
  const broker = brokerStatus();

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Goals</h2>
        <p className="mt-1 text-xs text-muted">Progress uses the open portfolio when you choose that measure. A manual amount is a number you type, because cash and dividends are not recorded.</p>
        {legacyTarget > 0 ? (
          <Progress
            name="Portfolio value"
            current={view.metrics.totalValue}
            target={legacyTarget}
            date=""
          />
        ) : null}
        {goals.map((goal) => (
          <Progress
            key={goal.id}
            name={goal.name}
            current={goal.measure === "portfolio" ? view.metrics.totalValue : goal.manual}
            target={goal.target}
            date={goal.date}
          />
        ))}
        <GoalForm onSave={(goal) => saveGoals([goal, ...goals].slice(0, 20))} />
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Recurring investments and DCA</h2>
        <p className="mt-1 text-xs text-muted">A schedule is a reminder you set. It does not create a transaction or move money. History below is only the buys already stored for that symbol.</p>
        <ScheduleForm onSave={(schedule) => saveSchedules([schedule, ...schedules].slice(0, 20))} />
        <ul className="mt-4 space-y-4">
          {schedules.map((schedule) => {
            const rows = view.transactions.filter((transaction) => transaction.symbol.toUpperCase() === schedule.symbol.toUpperCase());
            const stats = contributionStats(rows);
            const holding = view.holdings.find((item) => item.symbol.toUpperCase() === schedule.symbol.toUpperCase());
            const next = nextContributionDate(schedule.started, schedule.every, todayISO());
            return (
              <li key={schedule.id} className="rounded-2xl border border-border p-3 text-sm">
                <p className="font-medium">{formatMoney(schedule.amount)} {schedule.every} · {schedule.symbol || "No symbol"}</p>
                <p className="mt-1 text-muted">Next date on this schedule: {next ?? "Set a start date."}</p>
                {stats == null ? <p className="mt-1 text-muted">No stored buys for this symbol.</p> : stats.mixed ? <p className="mt-1 text-muted">Buys use more than one currency, so they are not added together.</p> : (
                  <p className="mt-1">Stored buys: {stats.count}. Contributed {formatMoney(stats.contributed, stats.currency)}. Average cost of those buys {stats.average == null ? "—" : formatMoney(stats.average, stats.currency)}.</p>
                )}
                {holding ? <p className="mt-1">Open position value {holding.currentValue == null ? "unavailable" : formatMoney(holding.currentValue)}. Return {holding.returnPct == null ? "unavailable" : formatPercent(holding.returnPct)}.</p> : null}
              </li>
            );
          })}
        </ul>
      </section>

      <Projection />

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Portfolio questions</h2>
        <p className="mt-1 text-xs text-muted">Answers use figures already stored for this portfolio. This is not a language model, and it does not estimate missing sectors, dividends, or news.</p>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setAnswer(answerPortfolioQuestion(view, question)); }}>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="How much have I invested?" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          <button type="submit" className="rounded-xl border border-border px-3 py-2 text-sm">Ask</button>
        </form>
        {answer ? <p className="mt-3 text-sm">{answer}</p> : null}
        <div className="mt-4">
          <p className="text-sm font-medium">Why the portfolio moved today</p>
          <ul className="mt-2 space-y-1 text-sm">{explained.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
          <ul className="mt-2 space-y-1 text-xs text-muted">{explained.missing.map((fact) => <li key={fact}>{fact}</li>)}</ul>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Cost basis</h2>
        <p className="mt-1 text-xs text-muted">Open positions use average cost in EUR. Realized profit is the closed trades already converted. No country tax rule is applied, and separate tax lots are not stored.</p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-muted">Unrealized</dt><dd className="numeric mt-1">{view.metrics.profitLoss == null ? "—" : formatMoney(view.metrics.profitLoss)}</dd></div>
          <div><dt className="text-muted">Realized</dt><dd className="numeric mt-1">{view.metrics.realizedPl == null ? "—" : formatMoney(view.metrics.realizedPl)}</dd></div>
          <div><dt className="text-muted">Invested</dt><dd className="numeric mt-1">{view.metrics.totalInvested == null ? "—" : formatMoney(view.metrics.totalInvested)}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted">Fees stay in the trade currency: {feesByCurrency(view.transactions).map(([currency, amount]) => `${amount.toFixed(2)} ${currency}`).join(", ") || "none recorded"}.</p>
        <p className="mt-3 text-sm text-muted">Splits, reverse splits, mergers, spin-offs, and symbol changes are not in the transaction record, so positions are not adjusted for them.</p>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
        <Activity view={view} />
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Backup</h2>
        <p className="mt-1 text-xs text-muted">Export copies data stored in this browser. Import adds records that are not already here. It does not delete transactions.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="rounded-xl border border-border px-3 py-2 text-sm" onClick={exportLocal}>Export</button>
          <label className="rounded-xl border border-border px-3 py-2 text-sm">
            Import
            <input type="file" accept="application/json" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file.text().then((text) => {
                try {
                  setBackupNote(importLocal(text));
                } catch {
                  setBackupNote("That file is not an AYV Invest backup.");
                }
              }).catch(() => setBackupNote("That file could not be read."));
            }} />
          </label>
        </div>
        {backupNote ? <p className="mt-3 text-sm text-muted">{backupNote}</p> : null}
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Brokers and earnings</h2>
        <p className="mt-2 text-sm text-muted">{broker.reason} A broker adapter can be added later without replacing the portfolio you already keep.</p>
        <p className="mt-2 text-sm text-muted">Earnings releases, guidance, and management comments are not in the price feed, so there is no earnings summary.</p>
        <p className="mt-2 text-sm text-muted">Market data uses the public Yahoo chart. API keys and broker passwords are not written into the page.</p>
      </section>
    </div>
  );
}

function Progress({ name, current, target, date }: { name: string; current: number | null; target: number; date: string }) {
  const percent = progressPercent(current, target);
  const months = date ? wholeMonthsUntil(todayISO(), date) : null;
  const needed = requiredMonthlyAmount(current, target, months);
  return (
    <article className="mt-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>{name}</span>
        <span className="numeric text-muted">{percent == null ? "—" : `${Math.min(percent, 999).toFixed(0)}%`}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-foreground/10">
        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.min(percent ?? 0, 100)}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">
        Current {current == null ? "unavailable" : formatMoney(current)} · Target {formatMoney(target)}
        {date ? ` · ${date}` : ""}
        {needed == null ? "" : ` · ${formatMoney(needed)} per month would close the gap with no investment return. That is arithmetic, not a forecast.`}
      </p>
    </article>
  );
}

function GoalForm({ onSave }: { onSave: (goal: Goal) => void }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [measure, setMeasure] = useState<Goal["measure"]>("portfolio");
  const [manual, setManual] = useState("");
  const [date, setDate] = useState("");
  return (
    <form className="mt-4 grid gap-2 sm:grid-cols-2" onSubmit={(event) => {
      event.preventDefault();
      const amount = Number(target);
      if (!name.trim() || !(amount > 0)) return;
      onSave({ id: crypto.randomUUID(), name: name.trim().slice(0, 40), target: amount, measure, manual: Number(manual) || 0, date });
      setName("");
      setTarget("");
      setManual("");
      setDate("");
    }}>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="House deposit" className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
      <input value={target} onChange={(event) => setTarget(event.target.value)} inputMode="decimal" placeholder="Target EUR" className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
      <select value={measure} onChange={(event) => setMeasure(event.target.value as Goal["measure"])} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
        <option value="portfolio">Compare with portfolio value</option>
        <option value="manual">Compare with a number I enter</option>
      </select>
      <input value={manual} onChange={(event) => setManual(event.target.value)} inputMode="decimal" placeholder="Current amount" className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
      <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
      <button type="submit" className="rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground">Save goal</button>
    </form>
  );
}

function ScheduleForm({ onSave }: { onSave: (schedule: Schedule) => void }) {
  const [amount, setAmount] = useState("");
  const [every, setEvery] = useState<Schedule["every"]>("month");
  const [symbol, setSymbol] = useState("");
  const [started, setStarted] = useState(todayISO());
  return (
    <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={(event) => {
      event.preventDefault();
      const value = Number(amount);
      if (!(value > 0)) return;
      onSave({ id: crypto.randomUUID(), amount: value, every, symbol: symbol.trim().toUpperCase(), started });
      setAmount("");
      setSymbol("");
    }}>
      <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="Amount EUR" className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
      <select value={every} onChange={(event) => setEvery(event.target.value as Schedule["every"])} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
        <option value="month">Monthly</option>
        <option value="week">Weekly</option>
      </select>
      <input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="Symbol, optional" className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
      <input type="date" value={started} onChange={(event) => setStarted(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
      <button type="submit" className="rounded-xl border border-border px-3 py-2 text-sm sm:col-span-2">Save schedule</button>
    </form>
  );
}

function Projection() {
  const [start, setStart] = useState("0");
  const [monthly, setMonthly] = useState("500");
  const [rate, setRate] = useState("5");
  const [years, setYears] = useState("10");
  const result = compoundProjection({
    start: Number(start) || 0,
    monthly: Number(monthly) || 0,
    annualPercent: Number(rate) || 0,
    years: Number(years) || 0,
  });
  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold tracking-tight">What if</h2>
      <p className="mt-1 text-xs leading-5 text-muted">This uses the return you type, compounded monthly. It is an assumption. It is not this portfolio’s past result and it is not a guaranteed outcome.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Field label="Starting capital" value={start} onChange={setStart} />
        <Field label="Monthly contribution" value={monthly} onChange={setMonthly} />
        <Field label="Assumed annual return %" value={rate} onChange={setRate} />
        <Field label="Years" value={years} onChange={setYears} />
      </div>
      {result ? (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-muted">Contributions</dt><dd className="numeric mt-1">{formatMoney(result.contributed)}</dd></div>
          <div><dt className="text-muted">Assumed growth</dt><dd className="numeric mt-1">{formatMoney(result.growth)}</dd></div>
          <div><dt className="text-muted">Assumed value</dt><dd className="numeric mt-1">{formatMoney(result.finalValue)}</dd></div>
        </dl>
      ) : <p className="mt-3 text-sm text-muted">Enter a time period above zero.</p>}
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-sm">
      <span className="text-muted">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2" />
    </label>
  );
}

const EMPTY_NOTES: ReturnType<typeof readResearchNotes> = [];
const EMPTY_ENTRIES: ReturnType<typeof readResearchJournal> = [];
const EMPTY_LINES: string[] = [];
const EMPTY_NOTICES: { id: string; text: string; at: string }[] = [];
let notesRaw = "";
let notesCache = EMPTY_NOTES;
let entriesRaw = "";
let entriesCache = EMPTY_ENTRIES;
let linesRaw = "";
let linesCache = EMPTY_LINES;
let noticesRaw = "";
let noticesCache = EMPTY_NOTICES;

function cachedNotes() {
  const raw = window.localStorage.getItem("ayv-invest.research-notes") ?? "[]";
  if (raw === notesRaw) return notesCache;
  notesRaw = raw;
  notesCache = readResearchNotes();
  return notesCache;
}

function cachedEntries() {
  const raw = window.localStorage.getItem("ayv-invest.research-journal") ?? "[]";
  if (raw === entriesRaw) return entriesCache;
  entriesRaw = raw;
  entriesCache = readResearchJournal();
  return entriesCache;
}

function cachedLines() {
  const raw = window.localStorage.getItem("ayv-invest.journal") ?? "[]";
  if (raw === linesRaw) return linesCache;
  linesRaw = raw;
  try {
    const parsed = JSON.parse(raw) as string[];
    linesCache = Array.isArray(parsed) ? parsed : EMPTY_LINES;
  } catch {
    linesCache = EMPTY_LINES;
  }
  return linesCache;
}

function cachedNotices() {
  const raw = window.localStorage.getItem("ayv-invest.notices") ?? "[]";
  if (raw === noticesRaw) return noticesCache;
  noticesRaw = raw;
  try {
    const parsed = JSON.parse(raw) as { id: string; text: string; at: string; archived?: boolean }[];
    noticesCache = Array.isArray(parsed) ? parsed.filter((notice) => !notice.archived) : EMPTY_NOTICES;
  } catch {
    noticesCache = EMPTY_NOTICES;
  }
  return noticesCache;
}

function Activity({ view }: { view: PortfolioView }) {
  const notes = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-plan", callback);
      return () => window.removeEventListener("ayv-plan", callback);
    },
    cachedEntries,
    () => EMPTY_ENTRIES,
  );
  const research = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-plan", callback);
      return () => window.removeEventListener("ayv-plan", callback);
    },
    cachedNotes,
    () => EMPTY_NOTES,
  );
  const journal = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-plan", callback);
      return () => window.removeEventListener("ayv-plan", callback);
    },
    cachedLines,
    () => EMPTY_LINES,
  );
  const notices = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-plan", callback);
      return () => window.removeEventListener("ayv-plan", callback);
    },
    cachedNotices,
    () => EMPTY_NOTICES,
  );
  const rows = [
    ...view.transactions.slice(0, 8).map((transaction) => ({ id: transaction.id, label: `${transaction.date} · ${transaction.type} ${transaction.symbol}` })),
    ...notes.slice(0, 5).map((entry) => ({ id: entry.id, label: `${entry.date} · journal ${entry.symbol}: ${entry.decision}` })),
    ...research.slice(0, 5).map((note) => ({ id: note.id, label: `${note.createdAt.slice(0, 10)} · note ${note.symbol}` })),
    ...journal.slice(0, 5).map((line) => ({ id: line, label: line })),
    ...notices.slice(0, 5).map((notice) => ({ id: notice.id, label: `${notice.at.slice(0, 10)} · ${notice.text}` })),
  ].slice(0, 16);
  if (rows.length === 0) return <p className="mt-3 text-sm text-muted">Activity appears after a transaction, note, or alert check.</p>;
  return <ul className="mt-3 space-y-2 text-sm">{rows.map((row) => <li key={row.id}>{row.label}</li>)}</ul>;
}

const EXPORT_KEYS = [
  "ayv-invest.local",
  "ayv-invest.watchlists",
  "ayv-invest.theses",
  "ayv-invest.research-notes",
  "ayv-invest.research-journal",
  "ayv-invest.journal",
  "ayv-invest.goals",
  "ayv-invest.goal-list",
  "ayv-invest.schedules",
  "ayv-invest.alerts",
  "ayv-invest.targets",
];

function exportLocal() {
  const payload: Record<string, string | null> = {};
  for (const key of EXPORT_KEYS) payload[key] = window.localStorage.getItem(key);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ayv-invest-backup.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importLocal(text: string) {
  const parsed = JSON.parse(text) as Record<string, string | null>;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "That file is not an AYV Invest backup.";
  let added = 0;
  for (const key of EXPORT_KEYS) {
    if (key === "ayv-invest.local" || typeof parsed[key] !== "string") continue;
    const incoming = JSON.parse(parsed[key]) as unknown;
    const current = window.localStorage.getItem(key);
    if (!current) {
      window.localStorage.setItem(key, parsed[key]);
      added += 1;
      continue;
    }
    if (Array.isArray(incoming) && incoming.every((item) => typeof item === "string")) {
      const existing = JSON.parse(current) as unknown;
      const lines = Array.isArray(existing) ? existing.filter((item): item is string => typeof item === "string") : [];
      const known = new Set(lines);
      const extra = incoming.filter((item) => !known.has(item));
      if (extra.length > 0) {
        window.localStorage.setItem(key, JSON.stringify([...lines, ...extra]));
        added += extra.length;
      }
      continue;
    }
    if (Array.isArray(incoming)) {
      const existing = JSON.parse(current) as { id?: string }[];
      if (!Array.isArray(existing)) continue;
      const ids = new Set(existing.map((item) => item.id).filter(Boolean));
      const extra = incoming.filter((item) => {
        const row = item as { id?: string };
        return Boolean(row.id) && !ids.has(row.id);
      });
      if (extra.length > 0) {
        window.localStorage.setItem(key, JSON.stringify([...existing, ...extra]));
        added += extra.length;
      }
    }
  }
  const currentLocal = window.localStorage.getItem("ayv-invest.local");
  if (!currentLocal && typeof parsed["ayv-invest.local"] === "string") {
    window.localStorage.setItem("ayv-invest.local", parsed["ayv-invest.local"]);
    window.dispatchEvent(new Event("ayv-portfolios"));
    added += 1;
  }
  const portfolio = typeof parsed["ayv-invest.local"] === "string" ? JSON.parse(parsed["ayv-invest.local"]) as { portfolios?: { id: string; transactions?: { id: string }[] }[] } : null;
  if (portfolio?.portfolios && currentLocal) {
    const current = JSON.parse(window.localStorage.getItem("ayv-invest.local") ?? "{}") as { portfolios?: { id: string; transactions: { id: string }[] }[] };
    for (const book of portfolio.portfolios) {
      const target = current.portfolios?.find((item) => item.id === book.id);
      if (!target || !Array.isArray(target.transactions) || !Array.isArray(book.transactions)) continue;
      const ids = new Set(target.transactions.map((item) => item.id));
      const extra = book.transactions.filter((item) => item.id && !ids.has(item.id));
      target.transactions.push(...extra);
      added += extra.length;
    }
    window.localStorage.setItem("ayv-invest.local", JSON.stringify(current));
    window.dispatchEvent(new Event("ayv-portfolios"));
  }
  window.dispatchEvent(new Event("ayv-plan"));
  return added === 0 ? "Nothing new was added. Existing records were left in place." : `Added ${added} record${added === 1 ? "" : "s"}. Existing records were kept.`;
}
