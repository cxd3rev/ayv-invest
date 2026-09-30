import { addDays, addMonths } from "@/lib/dates";

export function progressPercent(current: number | null, target: number) {
  if (current == null || !(target > 0)) return null;
  return (current / target) * 100;
}

export function wholeMonthsUntil(today: string, target: string) {
  if (target <= today) return 0;
  const [year, month, day] = today.split("-").map(Number);
  const [targetYear, targetMonth, targetDay] = target.split("-").map(Number);
  if (![year, month, day, targetYear, targetMonth, targetDay].every(Number.isFinite)) return null;
  let months = (targetYear - year) * 12 + (targetMonth - month);
  if (targetDay < day) months -= 1;
  return Math.max(months, 0);
}

export function requiredMonthlyAmount(current: number | null, target: number, months: number | null) {
  if (current == null || months == null || months <= 0) return null;
  const gap = target - current;
  if (gap <= 0) return 0;
  return gap / months;
}

export function compoundProjection(input: { start: number; monthly: number; annualPercent: number; years: number }) {
  if (!(input.years > 0) || input.start < 0 || input.monthly < 0 || !Number.isFinite(input.annualPercent)) return null;
  const months = Math.round(input.years * 12);
  if (months <= 0) return null;
  const rate = input.annualPercent / 100 / 12;
  const finalValue =
    rate === 0
      ? input.start + input.monthly * months
      : input.start * (1 + rate) ** months + input.monthly * (((1 + rate) ** months - 1) / rate);
  const contributed = input.start + input.monthly * months;
  return { contributed, growth: finalValue - contributed, finalValue };
}

export function nextContributionDate(started: string, every: "week" | "month", today: string) {
  let cursor = started.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cursor)) return null;
  for (let step = 0; step < 2400 && cursor < today; step += 1) {
    cursor = every === "week" ? addDays(cursor, 7) : addMonths(cursor, 1);
  }
  return cursor;
}

export function contributionStats(rows: { quantity: number; price: number; fees: number; currency: string; type: "buy" | "sell" }[]) {
  const buys = rows.filter((row) => row.type === "buy");
  if (buys.length === 0) return null;
  const currencies = new Set(buys.map((row) => row.currency));
  if (currencies.size !== 1) return { mixed: true as const };
  const currency = [...currencies][0];
  const contributed = buys.reduce((sum, row) => sum + row.quantity * row.price + row.fees, 0);
  const quantity = buys.reduce((sum, row) => sum + row.quantity, 0);
  return {
    mixed: false as const,
    currency,
    count: buys.length,
    contributed,
    average: quantity > 0 ? contributed / quantity : null,
  };
}
