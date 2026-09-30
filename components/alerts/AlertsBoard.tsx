"use client";

import { useState } from "react";
import { AssetSearch } from "@/components/assets/AssetSearch";
import { formatMoney, formatPercent } from "@/lib/format";
import { displayTicker } from "@/lib/market-data/identity";
import { getAssetQuote } from "@/lib/market-data/marketData";

type Alert = {
  id: string;
  symbol: string;
  name: string;
  kind: "above" | "below" | "percent" | "marketcap" | "volume" | "earnings" | "dividend";
  value: number;
};

type Notice = { id: string; text: string; at: string; read: boolean; archived?: boolean };

const ALERTS_KEY = "ayv-invest.alerts";
const NOTICES_KEY = "ayv-invest.notices";

function readJson<T>(key: string, fallback: T): T {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function AlertsBoard() {
  const [alerts, setAlerts] = useState<Alert[]>(() => (typeof window === "undefined" ? [] : readJson<Alert[]>(ALERTS_KEY, [])));
  const [notices, setNotices] = useState<Notice[]>(() => (typeof window === "undefined" ? [] : readJson<Notice[]>(NOTICES_KEY, [])));
  const [kind, setKind] = useState<Alert["kind"]>("above");
  const [value, setValue] = useState("");
  const [asset, setAsset] = useState<{ symbol: string; name: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  function saveAlerts(next: Alert[]) {
    setAlerts(next);
    window.localStorage.setItem(ALERTS_KEY, JSON.stringify(next));
  }

  function saveNotices(next: Notice[]) {
    setNotices(next);
    window.localStorage.setItem(NOTICES_KEY, JSON.stringify(next));
  }

  async function check() {
    setChecking(true);
    setStatus(null);
    const fired: Notice[] = [];
    for (const alert of alerts) {
      try {
        const quote = await getAssetQuote(alert.symbol);
        if (!quote) {
          fired.push({ id: crypto.randomUUID(), text: `${alert.symbol}: price unavailable, so this alert was not checked.`, at: new Date().toISOString(), read: false });
          continue;
        }
        const move = quote.previousClose != null && quote.previousClose !== 0 ? ((quote.price - quote.previousClose) / quote.previousClose) * 100 : null;
        if (alert.kind === "earnings" || alert.kind === "dividend") {
          const text = `${alert.symbol}: ${alert.kind} alerts cannot be checked. That data is not in the price feed.`;
          if (!notices.some((notice) => notice.text === text && !notice.archived)) {
            fired.push({ id: crypto.randomUUID(), text, at: new Date().toISOString(), read: false });
          }
          continue;
        }
        if (alert.kind === "marketcap" && quote.marketCap == null) {
          fired.push({ id: crypto.randomUUID(), text: `${alert.symbol}: market cap was not in the quote, so this alert was not treated as a hit.`, at: new Date().toISOString(), read: false });
          continue;
        }
        if (alert.kind === "volume" && quote.volume == null) {
          fired.push({ id: crypto.randomUUID(), text: `${alert.symbol}: volume was not in the quote, so this alert was not treated as a hit.`, at: new Date().toISOString(), read: false });
          continue;
        }
        const hit =
          (alert.kind === "above" && quote.price > alert.value) ||
          (alert.kind === "below" && quote.price < alert.value) ||
          (alert.kind === "percent" && move != null && Math.abs(move) >= alert.value) ||
          (alert.kind === "marketcap" && quote.marketCap != null && quote.marketCap >= alert.value) ||
          (alert.kind === "volume" && quote.volume != null && quote.volume >= alert.value);
        if (!hit) continue;
        const detail = alert.kind === "percent"
          ? `moved ${move == null ? "" : formatPercent(move)}`
          : alert.kind === "marketcap"
            ? `market cap is ${quote.marketCap == null ? "unavailable" : formatMoney(quote.marketCap, quote.currency)}`
            : alert.kind === "volume"
              ? `volume is ${quote.volume == null ? "unavailable" : quote.volume.toLocaleString("en-IE")}`
              : `is ${formatMoney(quote.price, quote.currency)}`;
        fired.push({ id: crypto.randomUUID(), text: `${displayTicker(alert.symbol, "stock")} ${detail}. Last price ${quote.asOf ? new Date(quote.asOf).toLocaleString() : "time unavailable"}.`, at: new Date().toISOString(), read: false });
      } catch {
        fired.push({ id: crypto.randomUUID(), text: `${alert.symbol}: the price feed did not respond.`, at: new Date().toISOString(), read: false });
      }
    }
    if (fired.length > 0) saveNotices([...fired, ...notices].slice(0, 30));
    setStatus(fired.length === 0 ? "No alert condition was met." : `${fired.length} update${fired.length === 1 ? "" : "s"}.`);
    setChecking(false);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-medium">New alert</h2>
        <p className="mt-2 text-xs text-muted">Alerts are checked when you press Check. AYV Invest does not send push notifications.</p>
        <div className="mt-3">
          <AssetSearch inputId="alert-search" onSelect={(result) => setAsset({ symbol: result.symbol, name: result.name })} />
        </div>
        {asset ? <p className="mt-3 text-sm">{asset.name} · {asset.symbol}</p> : null}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select value={kind} onChange={(event) => setKind(event.target.value as Alert["kind"])} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <option value="above">Price above</option>
            <option value="below">Price below</option>
            <option value="percent">Daily move at least (%)</option>
            <option value="marketcap">Market cap at least</option>
            <option value="volume">Volume at least</option>
            <option value="earnings">Earnings (not in this feed)</option>
            <option value="dividend">Dividend (not in this feed)</option>
          </select>
          <input value={value} onChange={(event) => setValue(event.target.value)} inputMode="decimal" placeholder="200" className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          <button
            type="button"
            className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={() => {
              const amount = Number(value);
              if (!asset || !Number.isFinite(amount) || amount <= 0) {
                setStatus("Choose an asset and a number above zero.");
                return;
              }
              saveAlerts([...alerts, { id: crypto.randomUUID(), symbol: asset.symbol, name: asset.name, kind, value: amount }]);
              setValue("");
              setStatus("Alert saved in this browser.");
            }}
          >
            Save alert
          </button>
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">Active alerts</h2>
          <button type="button" disabled={checking || alerts.length === 0} onClick={() => void check()} className="rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-60">{checking ? "Checking..." : "Check now"}</button>
        </div>
        {alerts.length === 0 ? <p className="mt-3 text-sm text-muted">No alerts yet.</p> : (
          <ul className="mt-3 space-y-2 text-sm">
            {alerts.map((alert) => (
              <li key={alert.id} className="flex items-center justify-between gap-3">
                <span>{alert.name} · {alert.kind} {alert.kind === "earnings" || alert.kind === "dividend" ? "" : alert.value}{alert.kind === "percent" ? "%" : ""}</span>
                <button type="button" className="text-xs text-muted" onClick={() => saveAlerts(alerts.filter((item) => item.id !== alert.id))}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        {status ? <p className="mt-3 text-sm text-muted">{status}</p> : null}
      </section>
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">Notifications</h2>
          <button type="button" className="text-xs text-muted" onClick={() => setShowArchived((value) => !value)}>{showArchived ? "Hide archived" : "Archived"}</button>
        </div>
        <p className="mt-2 text-xs text-muted">Price, move, market cap, and volume checks land here when you press Check. Earnings, dividends, and economic events are not in the feed.</p>
        {notices.filter((notice) => showArchived ? notice.archived : !notice.archived).length === 0 ? <p className="mt-3 text-sm text-muted">{showArchived ? "No archived notifications." : "Nothing has been checked yet."}</p> : (
          <ul className="mt-3 space-y-2 text-sm">
            {notices.filter((notice) => showArchived ? notice.archived : !notice.archived).map((notice) => (
              <li key={notice.id} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <span className={notice.read ? "text-muted" : ""}>{notice.text}</span>
                <span className="flex shrink-0 gap-3">
                  <button type="button" className="text-xs text-muted" onClick={() => saveNotices(notices.map((item) => item.id === notice.id ? { ...item, read: !item.read } : item))}>{notice.read ? "Mark unread" : "Mark read"}</button>
                  <button type="button" className="text-xs text-muted" onClick={() => saveNotices(notices.map((item) => item.id === notice.id ? { ...item, archived: !item.archived } : item))}>{notice.archived ? "Unarchive" : "Archive"}</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
