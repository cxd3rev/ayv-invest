"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatPercent, formatShortDate, formatSignedMoney } from "@/lib/format";
import { addDays, addMonths, todayISO } from "@/lib/dates";
import { displayTicker } from "@/lib/market-data/identity";
import { getHistoricalPrices } from "@/lib/market-data/marketData";
import { holdingContributions } from "@/lib/portfolio/desk";
import { dayReturnPct, feesByCurrency, priceReturn, rankPerformers, topWeight } from "@/lib/portfolio/insights";
import type { HoldingView, PortfolioView, TransactionView } from "@/lib/portfolio/types";
import { SignedMoney } from "@/components/portfolio/Money";
import { optionalClient } from "@/lib/supabase/client";
import { getPortfolioHistory } from "@/lib/portfolio/history";
import type { HistoryRange } from "@/lib/portfolio/ranges";

const SECTION_KEY = "ayv-invest.sections";
const ORDER_KEY = "ayv-invest.section-order";
const THESIS_KEY = "ayv-invest.theses";

const SECTIONS = [
  ["weights", "Holding weights"],
  ["performers", "Performers"],
  ["contribution", "Holding contribution"],
  ["movers", "Today's contributors"],
  ["bridge", "Contributions and return"],
  ["heatmap", "Performance heatmap"],
  ["treemap", "Treemap"],
  ["benchmark", "Benchmarks"],
  ["risk", "Concentration"],
  ["activity", "Activity"],
  ["thesis", "Investment notes"],
  ["unavailable", "Data not in this feed"],
] as const;

type SectionId = (typeof SECTIONS)[number][0];

function readHidden() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(SECTION_KEY) ?? "";
}

function writeHidden(ids: string[]) {
  window.localStorage.setItem(SECTION_KEY, ids.join(","));
  window.dispatchEvent(new Event("ayv-sections"));
}

function readOrder() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ORDER_KEY) ?? "";
}

function orderedIds(raw: string) {
  const known = SECTIONS.map(([id]) => id);
  const stored = raw.split(",").filter((id): id is SectionId => known.includes(id as SectionId));
  return [...stored, ...known.filter((id) => !stored.includes(id))];
}

function card(title: string, children: ReactNode) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function TodayMovers({ holdings }: { holdings: HoldingView[] }) {
  const ranked = rankPerformers(holdings, "today");
  const up = ranked.filter((row) => (row.profit ?? 0) > 0).slice(0, 3);
  const down = [...ranked].reverse().filter((row) => (row.profit ?? 0) < 0).slice(0, 3);
  if (up.length === 0 && down.length === 0) {
    return <p className="text-sm text-muted">Today&apos;s contributors appear when each holding has a previous close.</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <MoverList title="Main contributors" rows={up} />
      <MoverList title="Main detractors" rows={down} />
    </div>
  );
}

function MoverList({ title, rows }: { title: string; rows: ReturnType<typeof rankPerformers> }) {
  return (
    <div>
      <p className="text-sm text-muted">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">None.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.symbol} className="flex items-center justify-between gap-3">
              <span className="truncate">{row.name}</span>
              <SignedMoney value={row.profit} percent={row.percent} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AnalyticsSuite({ view }: { view: PortfolioView }) {
  const hidden = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-sections", callback);
      window.addEventListener("storage", callback);
      return () => {
        window.removeEventListener("ayv-sections", callback);
        window.removeEventListener("storage", callback);
      };
    },
    readHidden,
    () => "",
  );
  const orderRaw = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-sections", callback);
      window.addEventListener("storage", callback);
      return () => {
        window.removeEventListener("ayv-sections", callback);
        window.removeEventListener("storage", callback);
      };
    },
    readOrder,
    () => "",
  );
  const hiddenIds = hidden.split(",").filter(Boolean);
  const order = orderedIds(orderRaw);
  const show = (id: SectionId) => !hiddenIds.includes(id);

  function move(id: SectionId, direction: -1 | 1) {
    const next = [...order];
    const index = next.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    window.localStorage.setItem(ORDER_KEY, next.join(","));
    window.dispatchEvent(new Event("ayv-sections"));
  }

  const blocks: Record<SectionId, ReactNode> = {
    weights: <WeightBars holdings={view.holdings} />,
    performers: <Performers holdings={view.holdings} />,
    contribution: <ContributionBars holdings={view.holdings} total={view.metrics.totalValue} />,
    movers: card("Why the portfolio moved today", <TodayMovers holdings={view.holdings} />),
    bridge: <CashBridge view={view} />,
    heatmap: <ReturnHeatmap holdings={view.holdings} />,
    treemap: <HoldingTreemap holdings={view.holdings} />,
    benchmark: <BenchmarkCompare />,
    risk: <RiskCenter holdings={view.holdings} />,
    activity: <ActivityTimeline transactions={view.transactions} />,
    thesis: <ThesisNotes holdings={view.holdings} />,
    unavailable: <MissingData />,
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Sections</h2>
        <p className="mt-1 text-xs text-muted">Show, hide, and reorder. This layout stays in this browser.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {order.map((id) => {
            const label = SECTIONS.find(([sectionId]) => sectionId === id)?.[1] ?? id;
            const on = show(id);
            return (
              <div key={id} className={`flex items-center rounded-full border ${on ? "border-accent" : "border-border"}`}>
                <button
                  type="button"
                  onClick={() => {
                    const next = on ? [...hiddenIds, id] : hiddenIds.filter((item) => item !== id);
                    writeHidden(next);
                  }}
                  className={`px-3 py-1 text-xs ${on ? "text-foreground" : "text-muted"}`}
                >
                  {label}
                </button>
                <button type="button" aria-label={`Move ${label} up`} onClick={() => move(id, -1)} className="px-1 text-xs text-muted">↑</button>
                <button type="button" aria-label={`Move ${label} down`} onClick={() => move(id, 1)} className="px-1.5 text-xs text-muted">↓</button>
              </div>
            );
          })}
        </div>
      </section>

      {order.map((id) => (show(id) ? <div key={id}>{blocks[id]}</div> : null))}
    </div>
  );
}

function WeightBars({ holdings }: { holdings: HoldingView[] }) {
  const [expanded, setExpanded] = useState(false);
  const rows = holdings.filter((holding) => holding.portfolioPercent != null);
  const visible = expanded ? rows : rows.slice(0, 8);
  if (rows.length === 0) return card("Holding weights", <p className="text-sm text-muted">Weights appear after holdings have prices.</p>);
  const max = Math.max(...rows.map((holding) => holding.portfolioPercent ?? 0), 1);
  return card(
    "Holding weights",
    <>
      <ul className="space-y-3">
        {visible.map((holding) => (
          <li key={holding.assetId}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{holding.name}</span>
              <span className="numeric text-muted">{formatPercent(holding.portfolioPercent ?? 0).replace("+", "")}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-foreground/8">
              <div className="h-1.5 rounded-full bg-accent" style={{ width: `${((holding.portfolioPercent ?? 0) / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {rows.length > 8 ? (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-4 text-sm text-muted underline-offset-4 hover:underline">
          {expanded ? "Show top holdings" : "View all"}
        </button>
      ) : null}
    </>,
  );
}

function Performers({ holdings }: { holdings: HoldingView[] }) {
  const [period, setPeriod] = useState<"today" | "all">("all");
  const ranked = rankPerformers(holdings, period);
  return card(
    "Performers",
    <>
      <div className="mb-4 flex gap-2">
        {(["all", "today"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setPeriod(item)} className={`rounded-full border px-3 py-1 text-xs ${period === item ? "border-accent" : "border-border text-muted"}`}>
            {item === "all" ? "Since purchase" : "Today"}
          </button>
        ))}
      </div>
      <p className="mb-4 text-xs text-muted">Other periods are in the heatmap, and only when a real price history exists.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <MoverList title="Highest return" rows={ranked.slice(0, 5)} />
        <MoverList title="Lowest return" rows={[...ranked].reverse().slice(0, 5)} />
      </div>
    </>,
  );
}

function CashBridge({ view }: { view: PortfolioView }) {
  const fees = feesByCurrency(view.transactions);
  const metrics = view.metrics;
  return card(
    "Contributions and return",
    <div className="space-y-3 text-sm">
      <p className="flex justify-between gap-3"><span className="text-muted">Invested in open positions</span><span className="numeric">{metrics.totalInvested == null ? "—" : formatMoney(metrics.totalInvested)}</span></p>
      <p className="flex justify-between gap-3"><span className="text-muted">Unrealized profit/loss</span><SignedMoney value={metrics.profitLoss} percent={metrics.returnPct} /></p>
      <p className="flex justify-between gap-3 border-t border-border pt-3"><span>Current value</span><span className="numeric">{metrics.totalValue == null ? "—" : formatMoney(metrics.totalValue)}</span></p>
      <p className="text-xs leading-5 text-muted">
        This is invested cost plus unrealized profit on what you still hold. Dividends, deposits, and withdrawals are not recorded, so they are not included.
      </p>
      {fees.length > 0 ? (
        <p className="text-xs text-muted">Fees paid: {fees.map(([currency, amount]) => `${amount.toLocaleString("en-IE", { maximumFractionDigits: 2 })} ${currency}`).join(", ")}.</p>
      ) : null}
    </div>,
  );
}

function RiskCenter({ holdings }: { holdings: HoldingView[] }) {
  const largest = topWeight(holdings, 1);
  const top5 = topWeight(holdings, 5);
  const top10 = topWeight(holdings, 10);
  return card(
    "Concentration",
    <dl className="grid gap-3 sm:grid-cols-3 text-sm">
      <div><dt className="text-muted">Largest position</dt><dd className="numeric mt-1">{largest == null ? "—" : formatPercent(largest).replace("+", "")}</dd></div>
      <div><dt className="text-muted">Top 5 positions</dt><dd className="numeric mt-1">{top5 == null ? "—" : formatPercent(top5).replace("+", "")}</dd></div>
      <div><dt className="text-muted">Top 10 positions</dt><dd className="numeric mt-1">{top10 == null ? "—" : formatPercent(top10).replace("+", "")}</dd></div>
    </dl>,
  );
}

function ActivityTimeline({ transactions }: { transactions: TransactionView[] }) {
  const [filter, setFilter] = useState("all");
  const rows = transactions.filter((transaction) => {
    if (filter === "all") return true;
    if (filter === "fee") return transaction.fees > 0;
    return transaction.type === filter;
  });
  return card(
    "Activity",
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {["all", "buy", "sell", "fee", "dividend", "deposit"].map((item) => (
          <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === item ? "border-accent" : "border-border text-muted"}`}>
            {item === "all" ? "All" : item}
          </button>
        ))}
      </div>
      {filter === "dividend" || filter === "deposit" || (filter === "fee" && rows.length === 0) ? (
        <p className="text-sm text-muted">
          {filter === "dividend"
            ? "No dividends are recorded. AYV Invest currently stores buys and sells."
            : filter === "fee"
              ? "No fees are recorded on these transactions."
              : "No deposits are recorded. AYV Invest currently stores buys and sells."}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">{filter === "all" ? "No transaction history yet." : `No ${filter}s yet.`}</p>
      ) : (
        <ul className="space-y-3">
          {rows.slice(0, 12).map((transaction) => (
            <li key={transaction.id} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <p className="font-medium">{transaction.name}</p>
                <p className="text-xs text-muted">{formatShortDate(transaction.date)} · {transaction.type.toUpperCase()} · {transaction.quantity} @ {formatMoney(transaction.price, transaction.currency)}</p>
              </div>
              <span className="numeric">{formatMoney(transaction.total, transaction.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </>,
  );
}

const HEAT_RANGES = ["1W", "1M", "3M", "YTD", "1Y"] as const;

function ReturnHeatmap({ holdings }: { holdings: HoldingView[] }) {
  const [cells, setCells] = useState<Record<string, Record<string, number | null>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const today = todayISO();
    const from = addMonths(today, -12);
    const next: Record<string, Record<string, number | null>> = {};
    let failed = false;
    for (const holding of holdings.slice(0, 12)) {
      try {
        const bars = await getHistoricalPrices(holding.symbol, { interval: "1d", from, to: today });
        next[holding.symbol] = {
          "1W": priceReturn(bars, addDays(today, -7)),
          "1M": priceReturn(bars, addMonths(today, -1)),
          "3M": priceReturn(bars, addMonths(today, -3)),
          YTD: priceReturn(bars, `${today.slice(0, 4)}-01-01`),
          "1Y": priceReturn(bars, from),
        };
      } catch {
        failed = true;
        next[holding.symbol] = {};
      }
    }
    setCells(next);
    if (failed) setError("Some price histories could not be loaded.");
    setLoading(false);
  }

  return card(
    "Performance heatmap",
    <>
      <p className="mb-3 text-xs leading-5 text-muted">Today and since-purchase use your portfolio. The other columns are the asset&apos;s own price change, loaded only when you ask.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-2 pr-3 font-medium">Holding</th>
              {["1D", ...HEAT_RANGES, "All"].map((label) => <th key={label} className="px-2 py-2 font-medium">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {holdings.slice(0, 12).map((holding) => (
              <tr key={holding.assetId} className="border-t border-border">
                <td className="py-2 pr-3">{holding.symbol}</td>
                <HeatCell value={dayReturnPct(holding)} />
                {HEAT_RANGES.map((range) => <HeatCell key={range} value={cells?.[holding.symbol]?.[range] ?? null} />)}
                <HeatCell value={holding.returnPct} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading} className="mt-4 rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-60">
        {loading ? "Loading prices..." : "Load period returns"}
      </button>
      {error ? <p className="mt-2 text-sm text-muted">{error}</p> : null}
    </>,
  );
}

function ContributionBars({ holdings, total }: { holdings: HoldingView[]; total: number | null }) {
  const rows = holdingContributions(holdings, total);
  const max = Math.max(...rows.map((row) => Math.abs(row.profit)), 1);
  if (rows.length === 0) {
    return card("Holding contribution", <p className="text-sm text-muted">Contribution appears when holdings have a profit or loss and a portfolio value.</p>);
  }
  return card(
    "Holding contribution",
    <>
      <p className="mb-3 text-xs leading-5 text-muted">Each amount is unrealized profit or loss in EUR. The percent is that amount divided by the current portfolio value.</p>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.assetId}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{row.name}</span>
              <span className="numeric shrink-0">{formatSignedMoney(row.profit)} · {formatPercent(row.contributionPct)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-foreground/8">
              <div className={`h-1.5 rounded-full ${row.profit >= 0 ? "bg-positive" : "bg-negative"}`} style={{ width: `${(Math.abs(row.profit) / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </>,
  );
}

function HoldingTreemap({ holdings }: { holdings: HoldingView[] }) {
  const [group, setGroup] = useState<"asset" | "sector" | "country">("asset");
  const rows = holdings.filter((holding) => (holding.portfolioPercent ?? 0) > 0);
  return card(
    "Treemap",
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["asset", "sector", "country"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setGroup(item)} className={`rounded-full border px-3 py-1 text-xs capitalize ${group === item ? "border-accent" : "border-border text-muted"}`}>
            {item}
          </button>
        ))}
      </div>
      {group !== "asset" ? <p className="mb-3 text-sm text-muted">Sector and country are not in the price feed. The blocks below stay grouped by holding.</p> : null}
      {rows.length === 0 ? (
        <p className="text-sm text-muted">A treemap appears after holdings have a weight.</p>
      ) : (
        <div className="flex min-h-40 flex-wrap overflow-hidden rounded-xl">
          {rows.map((holding) => {
            const ret = holding.returnPct;
            const background = ret == null ? "rgba(141,149,168,0.16)" : ret >= 0 ? "rgba(61,190,140,0.28)" : "rgba(226,109,122,0.28)";
            return (
              <div key={holding.assetId} className="min-w-16 border border-background p-2 text-xs" style={{ flexGrow: holding.portfolioPercent ?? 1, flexBasis: `${Math.max(18, holding.portfolioPercent ?? 0)}%`, background }}>
                <p className="font-medium">{displayTicker(holding.symbol, holding.assetType)}</p>
                <p>{ret == null ? "—" : formatPercent(ret)}</p>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-xs text-muted">Size is portfolio weight. Color is return since purchase.</p>
    </>,
  );
}

function HeatCell({ value }: { value: number | null }) {
  const tone = value == null ? "text-muted" : value > 0 ? "bg-positive/15 text-positive" : value < 0 ? "bg-negative/15 text-negative" : "text-muted";
  return <td className={`numeric px-2 py-2 ${tone}`}>{value == null ? "—" : formatPercent(value)}</td>;
}

const BENCHMARKS = [
  { id: "sp500", label: "S&P 500", symbol: "^GSPC" },
  { id: "nasdaq", label: "Nasdaq-100", symbol: "^NDX" },
  { id: "world", label: "MSCI World ETF (URTH)", symbol: "URTH" },
  { id: "stoxx", label: "STOXX Europe 600 ETF (EXSA.DE)", symbol: "EXSA.DE" },
  { id: "btc", label: "Bitcoin", symbol: "BTC-USD" },
] as const;

function BenchmarkCompare() {
  const [range, setRange] = useState<HistoryRange>("1Y");
  const [active, setActive] = useState<string[]>(["sp500"]);
  const [rows, setRows] = useState<{ name: string; change: number | null }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    const today = todayISO();
    const from = addMonths(today, range === "5Y" ? -60 : range === "3Y" ? -36 : -12);
    const portfolio = await getPortfolioHistory(optionalClient(), range);
    const portfolioChange = portfolio.ok && portfolio.points.length > 1
      ? ((portfolio.points[portfolio.points.length - 1].value - portfolio.points[0].value) / portfolio.points[0].value) * 100
      : null;
    const next = [{ name: "Your portfolio", change: portfolioChange }];
    let failed = false;
    const chosen = [
      ...BENCHMARKS.filter((item) => active.includes(item.id)),
      ...(custom.trim() ? [{ id: "custom", label: custom.trim().toUpperCase(), symbol: custom.trim() }] : []),
    ];
    for (const benchmark of chosen) {
      try {
        const bars = await getHistoricalPrices(benchmark.symbol, { interval: "1d", from, to: today });
        next.push({ name: benchmark.label, change: priceReturn(bars, from) });
      } catch {
        failed = true;
        next.push({ name: benchmark.label, change: null });
      }
    }
    setRows(next);
    if (!portfolio.ok || failed) setError("Part of this comparison could not be loaded. A benchmark is not a recommendation.");
    setLoading(false);
  }

  const chartRows = useMemo(() => (rows ?? []).filter((row) => row.change != null), [rows]);

  return card(
    "Benchmarks",
    <>
      <p className="mb-3 text-xs leading-5 text-muted">These indexes are separate from your portfolio. URTH is a listed world ETF, not the MSCI index itself. None of them is automatically the right comparison.</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["1Y", "3Y", "5Y"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setRange(item)} className={`rounded-full border px-3 py-1 text-xs ${range === item ? "border-accent" : "border-border text-muted"}`}>{item}</button>
        ))}
        {BENCHMARKS.map((item) => (
          <button key={item.id} type="button" onClick={() => setActive((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} className={`rounded-full border px-3 py-1 text-xs ${active.includes(item.id) ? "border-accent" : "border-border text-muted"}`}>{item.label}</button>
        ))}
        <input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Custom symbol" aria-label="Custom benchmark symbol" className="rounded-full border border-border bg-background px-3 py-1 text-xs" />
      </div>
      <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-60">{loading ? "Loading..." : "Compare"}</button>
      {error ? <p className="mt-3 text-sm text-muted">{error}</p> : null}
      {rows ? (
        <ul className="mt-4 space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.name} className="flex justify-between gap-3">
              <span>{row.name}</span>
              <span className="numeric">{row.change == null ? "Not enough history" : formatPercent(row.change)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {chartRows.length > 0 ? (
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "#8d95a8", fontSize: 12 }} interval={0} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(value) => `${Number(value).toFixed(0)}%`} tick={{ fill: "#8d95a8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="change" fill="var(--accent)" radius={6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </>,
  );
}

type Thesis = {
  why: string;
  timeframe: string;
  bull: string;
  bear: string;
  risks: string;
  catalysts: string;
  sell: string;
  status: string;
};

const emptyThesis = (): Thesis => ({ why: "", timeframe: "", bull: "", bear: "", risks: "", catalysts: "", sell: "", status: "" });

function readTheses(): Record<string, Thesis> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(THESIS_KEY) ?? "{}") as Record<string, Thesis>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function ThesisNotes({ holdings }: { holdings: HoldingView[] }) {
  const [symbol, setSymbol] = useState(holdings[0]?.symbol ?? "");
  const [draft, setDraft] = useState<Thesis>(emptyThesis);
  const [saved, setSaved] = useState(false);

  function load(nextSymbol: string) {
    setSymbol(nextSymbol);
    setDraft({ ...emptyThesis(), ...readTheses()[nextSymbol] });
    setSaved(false);
  }

  return card(
    "Investment notes",
    holdings.length === 0 ? (
      <p className="text-sm text-muted">Add a holding before writing a note.</p>
    ) : (
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const all = readTheses();
          all[symbol] = draft;
          window.localStorage.setItem(THESIS_KEY, JSON.stringify(all));
          setSaved(true);
        }}
      >
        <select value={symbol} onChange={(event) => load(event.target.value)} onFocus={() => draft.why === "" && load(symbol)} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" aria-label="Holding">
          {holdings.map((holding) => <option key={holding.symbol} value={holding.symbol}>{holding.name}</option>)}
        </select>
        <textarea value={draft.why} onChange={(event) => setDraft({ ...draft, why: event.target.value })} placeholder="Why I own this" className="min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <select value={draft.timeframe} onChange={(event) => setDraft({ ...draft, timeframe: event.target.value })} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" aria-label="Timeframe">
          <option value="">Timeframe</option>
          <option value="short">Short term</option>
          <option value="medium">Medium term</option>
          <option value="long">Long term</option>
        </select>
        {(["bull", "bear", "risks", "catalysts", "sell"] as const).map((field) => (
          <textarea key={field} value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} placeholder={field === "sell" ? "What would make me sell?" : field} className="min-h-16 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        ))}
        <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" aria-label="Thesis status">
          <option value="">Thesis status</option>
          <option value="intact">Intact</option>
          <option value="review">Needs review</option>
          <option value="broken">Broken</option>
        </select>
        <button type="submit" className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground">Save note</button>
        {saved ? <p className="text-xs text-muted">Saved in this browser. This note is yours. AYV Invest does not turn it into a buy or sell instruction.</p> : null}
      </form>
    ),
  );
}

function MissingData() {
  const items = [
    ["Sector allocation", "The current price feed does not include a reliable sector for each holding."],
    ["Geographic allocation", "Country exposure is not included, so AYV Invest will not guess where a holding is based."],
    ["Dividends", "No dividend payments are recorded, so income, yield, and a dividend calendar are not shown."],
    ["ETF overlap", "Underlying ETF holdings are not available from the current feed."],
    ["Fundamentals comparison", "Market cap, earnings, and margins are not in the current feed. Your own price, value, and return stay in the holdings table."],
    ["Research assistant", "There is no analysis model connected. Notes above stay separate from market data."],
  ];
  return card(
    "Not available from this data",
    <ul className="space-y-3 text-sm">
      {items.map(([title, body]) => (
        <li key={title}>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-muted">{body}</p>
        </li>
      ))}
    </ul>,
  );
}
