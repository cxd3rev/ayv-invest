"use client";

import { useState, useSyncExternalStore } from "react";
import { formatPercent } from "@/lib/format";
import { getHistoricalPrices } from "@/lib/market-data/marketData";
import { addMonths, todayISO } from "@/lib/dates";
import { optionalClient } from "@/lib/supabase/client";
import { getPortfolioHistory } from "@/lib/portfolio/history";
import { answerPortfolioQuestion, currencyExposure, drawdownStats, pearson, portfolioMilestones } from "@/lib/portfolio/desk";
import type { PortfolioView } from "@/lib/portfolio/types";

const GOAL_KEY = "ayv-invest.goals";
const JOURNAL_KEY = "ayv-invest.journal";

function readGoal() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(GOAL_KEY) ?? "";
}

const EMPTY_JOURNAL: string[] = [];
let journalRaw = "";
let journalList: string[] = EMPTY_JOURNAL;

function readJournal() {
  if (typeof window === "undefined") return journalList;
  const raw = window.localStorage.getItem(JOURNAL_KEY) ?? "[]";
  if (raw === journalRaw) return journalList;
  journalRaw = raw;
  try {
    const parsed = JSON.parse(raw) as string[];
    journalList = Array.isArray(parsed) ? parsed : [];
  } catch {
    journalList = [];
  }
  return journalList;
}

export function ResearchDesk({ view }: { view: PortfolioView }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [drawdown, setDrawdown] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const currencies = currencyExposure(view.holdings);
  const weights = view.holdings.filter((holding) => holding.portfolioPercent != null).slice(0, 8);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Currency exposure</h2>
        {currencies.length === 0 ? <p className="mt-3 text-sm text-muted">Currency weights appear when holdings have a listing currency and a value.</p> : (
          <ul className="mt-3 space-y-2 text-sm">
            {currencies.map((row) => <li key={row.currency} className="flex justify-between"><span>{row.currency}</span><span className="numeric">{formatPercent(row.percent).replace("+", "")}</span></li>)}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">This uses the listing currency of each holding, converted value in EUR as the weight.</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Holding exposure</h2>
        {weights.length === 0 ? <p className="mt-3 text-sm text-muted">Add priced holdings to see their share of the portfolio.</p> : (
          <div className="mt-3 flex min-h-24 overflow-hidden rounded-xl">
            {weights.map((holding) => (
              <div key={holding.assetId} className="flex items-end border-r border-background bg-foreground/10 p-2 text-xs" style={{ flexGrow: holding.portfolioPercent ?? 1 }}>
                <span>{holding.symbol}<br />{formatPercent(holding.portfolioPercent ?? 0).replace("+", "")}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted">Sector grouping is not shown because the price feed has no sector for each holding.</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Drawdown and correlation</h2>
        <p className="mt-2 text-xs text-muted">Drawdown uses saved portfolio history. Correlation uses daily price changes over one year, and only when both assets have at least five shared days. It is not a judgment of risk.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} className="rounded-xl border border-border px-3 py-2 text-sm" onClick={() => void (async () => {
            setBusy(true);
            const history = await getPortfolioHistory(optionalClient(), "ALL");
            const stats = history.ok ? drawdownStats(history.points.map((point) => point.value)) : null;
            setDrawdown(stats ? `Current ${stats.current.toFixed(1)}%. Largest peak-to-trough in this history ${stats.maximum.toFixed(1)}%.` : "Not enough portfolio history.");
            setBusy(false);
          })()}>Load drawdown</button>
          <button type="button" disabled={busy} className="rounded-xl border border-border px-3 py-2 text-sm" onClick={() => void (async () => {
            setBusy(true);
            const today = todayISO();
            const from = addMonths(today, -12);
            const holdings = view.holdings.slice(0, 4);
            const series = await Promise.all(holdings.map(async (holding) => {
              try {
                const bars = await getHistoricalPrices(holding.symbol, { interval: "1d", from, to: today });
                return bars.map((bar) => bar.close);
              } catch {
                return [];
              }
            }));
            const lines = holdings.map((holding, index) => {
              const cells = holdings.map((_, other) => {
                const value = pearson(returns(series[index]), returns(series[other]));
                return value == null ? "—" : value.toFixed(2);
              });
              return `${holding.symbol} ${cells.join("  ")}`;
            });
            setMatrix(holdings.length < 2 ? "Add at least two holdings." : lines.join("\n"));
            setBusy(false);
          })()}>Load 1Y correlation</button>
        </div>
        {drawdown ? <p className="mt-3 text-sm">{drawdown}</p> : null}
        {matrix ? <pre className="mt-3 overflow-x-auto text-xs">{matrix}</pre> : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Ask your portfolio</h2>
        <p className="mt-2 text-xs text-muted">Answers use figures already on this portfolio. This is not a language model and it does not estimate missing data.</p>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setAnswer(answerPortfolioQuestion(view, question)); }}>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What are my largest holdings?" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          <button type="submit" className="rounded-xl border border-border px-3 py-2 text-sm">Ask</button>
        </form>
        {answer ? <p className="mt-3 text-sm">{answer}</p> : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Milestones</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {portfolioMilestones(view).map((item) => <li key={item}>{item}</li>)}
          {portfolioMilestones(view).length === 0 ? <li className="text-muted">Milestones appear after the first transaction.</li> : null}
        </ul>
      </section>

      <GoalJournal value={view.metrics.totalValue} />

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Not in this data feed</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>News, earnings, dividends, ownership, and financial statements are not provided by the current price feed.</li>
          <li>There is no model connected for generated research or earnings summaries.</li>
          <li>Price alerts and push notifications are not sent. Watchlist prices update when you refresh them.</li>
          <li>Top movers are not listed, because this feed does not provide a market-wide ranking.</li>
        </ul>
      </section>
    </div>
  );
}

function returns(closes: number[]) {
  const values: number[] = [];
  for (let index = 1; index < closes.length; index += 1) {
    if (closes[index - 1] > 0) values.push((closes[index] - closes[index - 1]) / closes[index - 1]);
  }
  return values;
}

function GoalJournal({ value }: { value: number | null }) {
  const storedTarget = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-goal", callback);
      return () => window.removeEventListener("ayv-goal", callback);
    },
    readGoal,
    () => "",
  );
  const [entry, setEntry] = useState("");
  const entries = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-journal", callback);
      return () => window.removeEventListener("ayv-journal", callback);
    },
    readJournal,
    () => EMPTY_JOURNAL,
  );
  const goal = Number(storedTarget);
  const progress = value != null && goal > 0 ? Math.min(100, (value / goal) * 100) : null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold tracking-tight">Goal and journal</h2>
      <label className="mt-3 block text-sm">
        <span className="text-muted">Portfolio value goal (EUR)</span>
        <input value={storedTarget} onChange={(event) => { window.localStorage.setItem(GOAL_KEY, event.target.value); window.dispatchEvent(new Event("ayv-goal")); }} inputMode="decimal" className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2" />
      </label>
      {progress != null ? <p className="mt-2 text-sm">Current value is {progress.toFixed(0)}% of this goal. This is progress so far, not a forecast.</p> : <p className="mt-2 text-xs text-muted">Set a number to compare with the current portfolio value.</p>}
      <form className="mt-4 space-y-2" onSubmit={(event) => {
        event.preventDefault();
        const text = entry.trim();
        if (!text) return;
        const next = [`${new Date().toISOString().slice(0, 10)} — ${text}`, ...entries].slice(0, 20);
        journalRaw = "";
        window.localStorage.setItem(JOURNAL_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event("ayv-journal"));
        setEntry("");
      }}>
        <textarea value={entry} onChange={(event) => setEntry(event.target.value)} placeholder="Note about a holding or decision" className="min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <button type="submit" className="rounded-xl border border-border px-3 py-2 text-sm">Save note</button>
      </form>
      <ul className="mt-3 space-y-2 text-sm">{entries.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}
