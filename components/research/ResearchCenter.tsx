"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { AssetSearch, rememberAsset } from "@/components/assets/AssetSearch";
import { HeadlineList } from "@/components/research/Headlines";
import { formatMoney, formatPercent } from "@/lib/format";
import { addDays, addMonths, todayISO } from "@/lib/dates";
import { displayTicker, shortAssetName } from "@/lib/market-data/identity";
import type { Headline } from "@/lib/market-data/headlines";
import { getAssetQuote, getAssetQuotes, getHeadlines, getHistoricalPrices } from "@/lib/market-data/marketData";
import type { AssetQuote, AssetSearchResult } from "@/lib/market-data/types";
import { annualizedVolatility } from "@/lib/portfolio/desk";
import { priceReturn } from "@/lib/portfolio/insights";
import {
  emptyThesis,
  readPriceTargets,
  readResearchJournal,
  readResearchNotes,
  readTheses,
  savePriceTargets,
  saveResearchJournal,
  saveResearchNotes,
  saveThesis,
  type JournalEntry,
  type PriceTarget,
  type ResearchNote,
  type ThesisNote,
} from "@/lib/local/personalResearch";

const TABS = ["Overview", "News", "Thesis", "Notes", "Journal", "Targets", "Compare", "Watchlist", "Not in this feed"] as const;
const GAPS = [
  ["Fundamentals", "Revenue, profit, margins, cash flow, debt, and shares are not in the chart feed."],
  ["Financial statements", "Income statement, balance sheet, and cash flow are not in the chart feed."],
  ["Valuation", "P/E, PEG, P/S, P/B, EV/EBITDA, and yields are not in the chart feed. None of these would be a buy or sell signal here."],
  ["Earnings", "Estimates, actual results, surprise, and an earnings calendar are not in the chart feed."],
  ["Dividends", "Dividend history, growth, payout, and pay dates are not recorded and are not in the chart feed."],
  ["Ownership", "Institutional holders, insider ownership, and holder changes are not in the chart feed."],
  ["Filings", "Annual, quarterly, and current reports are not in the chart feed."],
  ["Economic calendar", "Inflation, rates, GDP, employment, and similar events are not in the chart feed."],
  ["Sector news", "The feed has no sector for a holding, so sector news is not listed."],
];

const EMPTY_LISTS: { id: string; name: string; assets: AssetSearchResult[] }[] = [];
let watchRaw = "";
let watchLists = EMPTY_LISTS;

function readWatchlists() {
  if (typeof window === "undefined") return watchLists;
  const raw = window.localStorage.getItem("ayv-invest.watchlists") ?? "[]";
  if (raw === watchRaw) return watchLists;
  watchRaw = raw;
  try {
    const parsed = JSON.parse(raw) as { id: string; name: string; assets: AssetSearchResult[] }[];
    watchLists = Array.isArray(parsed) ? parsed : EMPTY_LISTS;
  } catch {
    watchLists = EMPTY_LISTS;
  }
  return watchLists;
}

function readAlerts() {
  if (typeof window === "undefined") return [] as { symbol: string; kind: string; value: number }[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem("ayv-invest.alerts") ?? "[]") as { symbol: string; kind: string; value: number }[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function ResearchCenter() {
  const [asset, setAsset] = useState<AssetSearchResult | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [quote, setQuote] = useState<AssetQuote | null>(null);
  const [headlines, setHeadlines] = useState<Headline[] | null>(null);
  const [relatedOnly, setRelatedOnly] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function open(result: AssetSearchResult) {
    setAsset(result);
    rememberAsset(result);
    setLoading(true);
    setStatus(null);
    setQuote(null);
    setHeadlines(null);
    try {
      const [nextQuote, news] = await Promise.all([
        getAssetQuote(result.symbol).catch(() => null),
        getHeadlines(result.symbol, result.symbol).catch(() => null),
      ]);
      setQuote(nextQuote);
      setHeadlines(news?.headlines ?? null);
      setRelatedOnly(news?.relatedOnly ?? false);
      if (!nextQuote && !news) setStatus("Yahoo did not return a quote or headlines for this symbol.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <AssetSearch onSelect={(result) => void open(result)} />
      {asset ? (
        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{shortAssetName(asset.name)}</h2>
              <p className="mt-1 text-sm text-muted">
                {displayTicker(asset.symbol, asset.assetType)} · {asset.assetType} · {asset.exchange ?? "Exchange unavailable"} · {asset.symbol}
              </p>
            </div>
            <p className="numeric text-2xl">{quote ? formatMoney(quote.price, quote.currency) : loading ? "Loading..." : "Price unavailable"}</p>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">
            Source: Yahoo Finance chart and search. {quote?.asOf ? `Last updated ${quote.asOf}.` : "Update time unavailable."} Prices may be delayed. Figures below are omitted when Yahoo does not send them.
          </p>
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {TABS.map((item) => (
              <button key={item} type="button" onClick={() => setTab(item)} className={`shrink-0 rounded-full border px-3 py-1 text-xs ${tab === item ? "border-accent text-foreground" : "border-border text-muted"}`}>
                {item}
              </button>
            ))}
          </div>
          <div className="mt-4">
            {tab === "Overview" ? <Overview quote={quote} loading={loading} status={status} /> : null}
            {tab === "News" ? (
              <>
                <p className="text-xs text-muted">
                  {relatedOnly ? "Headlines Yahoo tagged with this symbol." : "Yahoo search results for this symbol. They are not filtered to a sector, and crypto searches often return none."}
                </p>
                <HeadlineList items={headlines} empty={loading ? "Loading headlines..." : "No headlines were returned."} />
              </>
            ) : null}
            {tab === "Thesis" && asset ? <ThesisForm key={asset.symbol} symbol={asset.symbol} /> : null}
            {tab === "Notes" && asset ? <NotesForm key={asset.symbol} symbol={asset.symbol} /> : null}
            {tab === "Journal" && asset ? <JournalForm key={asset.symbol} symbol={asset.symbol} /> : null}
            {tab === "Targets" && asset ? <TargetsForm key={asset.symbol} symbol={asset.symbol} name={asset.name} price={quote?.price ?? null} currency={quote?.currency ?? asset.currency ?? "USD"} /> : null}
            {tab === "Compare" ? <CompareBoard key={asset.symbol} current={asset} /> : null}
            {tab === "Watchlist" ? <WatchResearch /> : null}
            {tab === "Not in this feed" ? (
              <ul className="space-y-3 text-sm">
                {GAPS.map(([title, body]) => (
                  <li key={title}>
                    <p className="font-medium">{title}</p>
                    <p className="mt-1 text-muted">{body}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted">Search a ticker or name. The page uses the same Yahoo search as the rest of AYV Invest.</p>
      )}
    </div>
  );
}

function Overview({ quote, loading, status }: { quote: AssetQuote | null; loading: boolean; status: string | null }) {
  if (loading) return <p className="text-sm text-muted">Loading the quote and headlines.</p>;
  if (!quote) return <p className="text-sm text-muted">{status ?? "Quote unavailable."}</p>;
  const day = quote.previousClose ? ((quote.price - quote.previousClose) / quote.previousClose) * 100 : null;
  const rows: [string, string][] = [
    ["Day change", day == null ? "Unavailable" : formatPercent(day)],
    ["Day high", quote.dayHigh == null ? "Unavailable" : formatMoney(quote.dayHigh, quote.currency)],
    ["Day low", quote.dayLow == null ? "Unavailable" : formatMoney(quote.dayLow, quote.currency)],
    ["52-week high", quote.fiftyTwoWeekHigh == null ? "Unavailable" : formatMoney(quote.fiftyTwoWeekHigh, quote.currency)],
    ["52-week low", quote.fiftyTwoWeekLow == null ? "Unavailable" : formatMoney(quote.fiftyTwoWeekLow, quote.currency)],
    ["Volume", quote.volume == null ? "Unavailable" : quote.volume.toLocaleString("en-IE")],
    ["Market cap", quote.marketCap == null ? "Unavailable" : formatMoney(quote.marketCap, quote.currency)],
  ];
  return (
    <div>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="numeric mt-1 text-sm">{value}</dd>
          </div>
        ))}
      </dl>
      <QuoteAsk quote={quote} />
    </div>
  );
}

function QuoteAsk({ quote }: { quote: AssetQuote }) {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask(event: FormEvent) {
    event.preventDefault();
    const text = prompt.trim().toLowerCase();
    if (!text) return;
    if (text.includes("earning") || text.includes("guidance") || text.includes("risk") || text.includes("report") || text.includes("compare")) {
      setReply("Earnings, guidance, filings, and stated risks are not in the Yahoo chart or search feed, so they are not summarized. Comparison of two companies is on the Compare tab and only shows fields Yahoo returned.");
      return;
    }
    if (text.includes("week") || text.includes("changed")) {
      setBusy(true);
      try {
        const to = todayISO();
        const bars = await getHistoricalPrices(quote.symbol, { interval: "1d", from: addDays(to, -7), to });
        if (bars.length < 2) setReply("Fewer than two daily closes came back for the last week, so a change is not calculated.");
        else {
          const first = bars[0];
          const last = bars[bars.length - 1];
          const change = first.close > 0 ? ((last.close - first.close) / first.close) * 100 : null;
          setReply(`Daily close moved from ${formatMoney(first.close, quote.currency)} on ${first.time.slice(0, 10)} to ${formatMoney(last.close, quote.currency)} on ${last.time.slice(0, 10)}${change == null ? "" : ` (${formatPercent(change)})`}. Source: Yahoo daily closes. This is the price change only.`);
        }
      } catch {
        setReply("The price history feed did not respond.");
      }
      setBusy(false);
      return;
    }
    const day = quote.previousClose ? ((quote.price - quote.previousClose) / quote.previousClose) * 100 : null;
    setReply(`Last price ${formatMoney(quote.price, quote.currency)}. Day change ${day == null ? "unavailable" : formatPercent(day)}. Volume ${quote.volume == null ? "unavailable" : quote.volume.toLocaleString("en-IE")}. Market cap ${quote.marketCap == null ? "unavailable" : formatMoney(quote.marketCap, quote.currency)}. Source: Yahoo chart${quote.asOf ? ` as of ${quote.asOf}` : ""}.`);
  }

  return (
    <form className="mt-4 space-y-2" onSubmit={(event) => void ask(event)}>
      <p className="text-xs text-muted">Questions use this quote, or one week of daily closes when you ask what changed. Nothing is filled in when the feed is empty.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="What changed this week?" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <button type="submit" disabled={busy} className="rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-60">{busy ? "Loading..." : "Ask"}</button>
      </div>
      {reply ? <p className="text-sm">{reply}</p> : null}
    </form>
  );
}

function ThesisForm({ symbol }: { symbol: string }) {
  const stored = readTheses()[symbol];
  const [draft, setDraft] = useState<ThesisNote>({ ...emptyThesis(), ...stored });
  const [saved, setSaved] = useState(false);
  const fields: [keyof ThesisNote, string][] = [
    ["why", "Why I own it"],
    ["bull", "Bull case"],
    ["bear", "Bear case"],
    ["risks", "Risks"],
    ["catalysts", "Catalysts"],
    ["metrics", "Key metrics I am watching"],
    ["target", "Target thesis"],
    ["sell", "What would make me sell"],
  ];
  return (
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); saveThesis(symbol, draft); setSaved(true); }}>
      {fields.map(([key, label]) => (
        <label key={key} className="block text-sm">
          <span className="text-muted">{label}</span>
          <textarea value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} className="mt-1 min-h-16 w-full rounded-xl border border-border bg-background px-3 py-2" />
        </label>
      ))}
      <label className="block text-sm">
        <span className="text-muted">Last reviewed</span>
        <input type="date" value={draft.reviewedAt.slice(0, 10)} onChange={(event) => setDraft({ ...draft, reviewedAt: event.target.value })} className="mt-1 rounded-xl border border-border bg-background px-3 py-2" />
      </label>
      <button type="submit" className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">Save thesis</button>
      {saved ? <p className="text-xs text-muted">Saved in this browser{draft.updatedAt ? `. Updated ${draft.updatedAt}` : ""}. This is your note, not a recommendation. Markdown is stored as text.</p> : null}
    </form>
  );
}

function NotesForm({ symbol }: { symbol: string }) {
  const [notes, setNotes] = useState<ResearchNote[]>(() => readResearchNotes().filter((note) => note.symbol === symbol));
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [link, setLink] = useState("");
  return (
    <div>
      <form className="space-y-2" onSubmit={(event) => {
        event.preventDefault();
        if (!body.trim()) return;
        const now = new Date().toISOString();
        const next = [{ id: crypto.randomUUID(), symbol, body: body.trim(), tags: tags.trim(), link: link.trim(), createdAt: now, updatedAt: now }, ...readResearchNotes()].slice(0, 40);
        saveResearchNotes(next);
        setNotes(next.filter((note) => note.symbol === symbol));
        setBody("");
        setTags("");
        setLink("");
      }}>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Research note" className="min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Tags" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="Link" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <button type="submit" className="rounded-full border border-border px-4 py-2 text-sm">Save note</button>
      </form>
      <p className="mt-2 text-xs text-muted">Attachments are not stored. Notes stay in this browser.</p>
      <ul className="mt-3 space-y-3 text-sm">
        {notes.map((note) => (
          <li key={note.id}>
            <p className="whitespace-pre-wrap">{note.body}</p>
            <p className="mt-1 text-xs text-muted">{note.createdAt.slice(0, 16).replace("T", " ")}{note.tags ? ` · ${note.tags}` : ""}{note.link ? ` · ${note.link}` : ""}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function JournalForm({ symbol }: { symbol: string }) {
  const [entries, setEntries] = useState<JournalEntry[]>(() => readResearchJournal().filter((entry) => entry.symbol === symbol));
  const [draft, setDraft] = useState({ decision: "", reason: "", expectation: "", result: "", lessons: "", portfolio: "", date: todayISO() });
  return (
    <div>
      <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => {
        event.preventDefault();
        if (!draft.decision.trim()) return;
        const next = [{ id: crypto.randomUUID(), symbol, createdAt: new Date().toISOString(), ...draft }, ...readResearchJournal()].slice(0, 40);
        saveResearchJournal(next);
        setEntries(next.filter((entry) => entry.symbol === symbol));
        setDraft({ decision: "", reason: "", expectation: "", result: "", lessons: "", portfolio: "", date: todayISO() });
      }}>
        {(["decision", "reason", "expectation", "result", "lessons", "portfolio"] as const).map((field) => (
          <input key={field} value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} placeholder={field} className="rounded-xl border border-border bg-background px-3 py-2 text-sm capitalize" />
        ))}
        <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <button type="submit" className="rounded-full border border-border px-4 py-2 text-sm">Save entry</button>
      </form>
      <ul className="mt-3 space-y-3 text-sm">
        {entries.map((entry) => (
          <li key={entry.id}>
            <p className="font-medium">{entry.date} · {entry.decision}</p>
            <p className="text-muted">{[entry.reason, entry.expectation, entry.result, entry.lessons].filter(Boolean).join(" · ")}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TargetsForm({ symbol, name, price, currency }: { symbol: string; name: string; price: number | null; currency: string }) {
  const [targets, setTargets] = useState<PriceTarget[]>(() => readPriceTargets());
  const [value, setValue] = useState("");
  const mine = targets.filter((target) => target.symbol === symbol);
  return (
    <div>
      <p className="text-xs text-muted">A personal price to track. AYV Invest does not turn it into a recommendation.</p>
      <form className="mt-3 flex gap-2" onSubmit={(event) => {
        event.preventDefault();
        const target = Number(value);
        if (!Number.isFinite(target) || target <= 0) return;
        const next = [{ id: crypto.randomUUID(), symbol, name, target, currency, createdAt: new Date().toISOString() }, ...readPriceTargets()].slice(0, 40);
        savePriceTargets(next);
        setTargets(next);
        setValue("");
      }}>
        <input value={value} onChange={(event) => setValue(event.target.value)} inputMode="decimal" placeholder="Target price" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <button type="submit" className="rounded-full border border-border px-4 py-2 text-sm">Save</button>
      </form>
      <ul className="mt-3 space-y-2 text-sm">
        {mine.map((target) => {
          const gap = price != null && price !== 0 ? ((target.target - price) / price) * 100 : null;
          return (
            <li key={target.id} className="flex justify-between gap-3">
              <span>{formatMoney(target.target, target.currency)} · {target.createdAt.slice(0, 10)}</span>
              <span className="numeric text-muted">{price == null ? "Current price unavailable" : gap == null ? "—" : `${formatPercent(gap)} vs current`}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CompareBoard({ current }: { current: AssetSearchResult }) {
  const [assets, setAssets] = useState<AssetSearchResult[]>([current]);
  const [rows, setRows] = useState<Record<string, { quote: AssetQuote | null; change: number | null; volatility: number | null }>>({});
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setNote(null);
    const today = todayISO();
    const from = addMonths(today, -12);
    const quotes = await getAssetQuotes(assets.map((item) => item.symbol)).catch(() => new Map<string, AssetQuote>());
    const next: typeof rows = {};
    let failed = false;
    for (const item of assets) {
      const quote = quotes.get(item.symbol.toUpperCase()) ?? null;
      let change: number | null = null;
      let volatility: number | null = null;
      try {
        const bars = await getHistoricalPrices(item.symbol, { interval: "1d", from, to: today });
        change = priceReturn(bars, from);
        volatility = annualizedVolatility(bars.map((bar) => bar.close));
      } catch {
        failed = true;
      }
      next[item.symbol] = { quote, change, volatility };
    }
    setRows(next);
    if (failed || quotes.size === 0) setNote("Part of this comparison could not be loaded. Missing fundamentals stay blank.");
    setLoading(false);
  }

  const metrics: [string, (row: (typeof rows)[string] | undefined) => string][] = [
    ["Price", (row) => (row?.quote ? formatMoney(row.quote.price, row.quote.currency) : "Unavailable")],
    ["Market cap", (row) => (row?.quote?.marketCap == null ? "Unavailable" : formatMoney(row.quote.marketCap, row.quote.currency))],
    ["1Y price change", (row) => (row?.change == null ? "Unavailable" : formatPercent(row.change))],
    ["Volatility", (row) => (row?.volatility == null ? "Unavailable" : formatPercent(row.volatility).replace("+", ""))],
    ["Revenue", () => "Unavailable"],
    ["Growth", () => "Unavailable"],
    ["Margins", () => "Unavailable"],
    ["P/E", () => "Unavailable"],
    ["Forward P/E", () => "Unavailable"],
    ["Free cash flow", () => "Unavailable"],
    ["Dividend", () => "Unavailable"],
  ];

  return (
    <div>
      <p className="text-xs text-muted">Add listings to compare. There is no winner and no ranking.</p>
      <div className="mt-3">
        <AssetSearch onSelect={(result) => setAssets((currentAssets) => currentAssets.some((item) => item.symbol === result.symbol) || currentAssets.length >= 4 ? currentAssets : [...currentAssets, result])} />
      </div>
      <p className="mt-2 text-sm">{assets.map((item) => item.symbol).join(" · ")}</p>
      <button type="button" onClick={() => void load()} disabled={loading} className="mt-3 rounded-full border border-border px-4 py-2 text-sm disabled:opacity-60">{loading ? "Loading..." : "Load comparison"}</button>
      {note ? <p className="mt-2 text-sm text-muted">{note}</p> : null}
      {Object.keys(rows).length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-2 pr-3 font-medium">Metric</th>
                {assets.map((item) => <th key={item.symbol} className="px-2 py-2 font-medium">{item.symbol}</th>)}
              </tr>
            </thead>
            <tbody>
              {metrics.map(([label, read]) => (
                <tr key={label} className="border-t border-border">
                  <td className="py-2 pr-3">{label}</td>
                  {assets.map((item) => <td key={item.symbol} className="numeric px-2 py-2">{read(rows[item.symbol])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function WatchResearch() {
  const lists = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-watchlists", callback);
      return () => window.removeEventListener("ayv-watchlists", callback);
    },
    readWatchlists,
    () => EMPTY_LISTS,
  );
  const [listId, setListId] = useState("");
  const [headlines, setHeadlines] = useState<Headline[] | null>(null);
  const [loading, setLoading] = useState(false);
  const current = lists.find((list) => list.id === listId) ?? lists[0];
  const alerts = current ? readAlerts().filter((alert) => current.assets.some((asset) => asset.symbol === alert.symbol)) : [];

  async function loadNews() {
    if (!current) return;
    setLoading(true);
    const collected: Headline[] = [];
    for (const asset of current.assets.slice(0, 4)) {
      try {
        const news = await getHeadlines(asset.symbol, asset.symbol);
        collected.push(...news.headlines);
      } catch {
        // One symbol failing does not invent a headline.
      }
    }
    const seen = new Set<string>();
    setHeadlines(collected.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true))));
    setLoading(false);
  }

  if (lists.length === 0) return <p className="text-sm text-muted">Create a watchlist first. <Link href="/watchlists" className="underline-offset-4 hover:underline">Open watchlists</Link></p>;

  return (
    <div>
      <select value={current?.id ?? ""} onChange={(event) => { setListId(event.target.value); setHeadlines(null); }} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" aria-label="Watchlist">
        {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
      </select>
      <p className="mt-3 text-sm">{current?.assets.map((asset) => asset.symbol).join(", ") || "This watchlist is empty."}</p>
      <p className="mt-2 text-xs text-muted">Prices and day change stay on the watchlist page. Fundamentals and earnings dates are not in this feed.</p>
      <p className="mt-2 text-sm">Alerts on these symbols: {alerts.length === 0 ? "none" : alerts.map((alert) => `${alert.symbol} ${alert.kind} ${alert.value}`).join(", ")}</p>
      <button type="button" onClick={() => void loadNews()} disabled={loading || !current?.assets.length} className="mt-3 rounded-full border border-border px-4 py-2 text-sm disabled:opacity-60">{loading ? "Loading..." : "Load headlines"}</button>
      <HeadlineList items={headlines} empty="No headlines were returned for these symbols." />
    </div>
  );
}
