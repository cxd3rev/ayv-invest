import { formatLongDate } from "@/lib/format";
import type { Headline } from "@/lib/market-data/headlines";

export function HeadlineList({ items, empty }: { items: Headline[] | null; empty: string }) {
  if (!items) return null;
  if (items.length === 0) return <p className="mt-3 text-sm text-muted">{empty}</p>;

  return (
    <ul className="mt-3 space-y-3">
      {items.map((item) => (
        <li key={item.id} className="text-sm">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer" className="font-medium underline-offset-4 hover:underline">
              {item.title}
            </a>
          ) : (
            <p className="font-medium">{item.title}</p>
          )}
          <p className="mt-1 text-xs text-muted">
            {item.source ?? "Source unavailable"} · {item.publishedAt ? formatLongDate(item.publishedAt) : "Time unavailable"}
            {item.symbols.length > 0 ? ` · ${item.symbols.slice(0, 4).join(", ")}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
