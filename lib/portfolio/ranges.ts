import { addDays, addMonths } from "@/lib/dates";

export const HISTORY_RANGES = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "ALL"] as const;

export type HistoryRange = (typeof HISTORY_RANGES)[number];

export function isHistoryRange(value: string): value is HistoryRange {
  return (HISTORY_RANGES as readonly string[]).includes(value);
}

export function rangeStart(range: HistoryRange, today: string, firstTransaction: string | null) {
  if (!firstTransaction) return today;

  const start = (() => {
    switch (range) {
      case "1D":
        return today;
      case "1W":
        return addDays(today, -7);
      case "1M":
        return addMonths(today, -1);
      case "3M":
        return addMonths(today, -3);
      case "6M":
        return addMonths(today, -6);
      case "YTD":
        return `${today.slice(0, 4)}-01-01`;
      case "1Y":
        return addMonths(today, -12);
      case "ALL":
        return firstTransaction;
    }
  })();

  return start < firstTransaction ? firstTransaction : start;
}
