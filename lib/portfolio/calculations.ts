import { QUANTITY_EPSILON } from "@/lib/dates";

export type TransactionType = "buy" | "sell";

export type PositionTransaction = {
  assetId: string;
  type: TransactionType;
  quantity: number;
  price: number;
  fees: number;
  date: string;
  createdAt: string;
};

export type Position = {
  assetId: string;
  quantity: number;
  costBasis: number;
  realizedPl: number;
};

export class PositionError extends Error {
  constructor(message = "You cannot sell more than you own.") {
    super(message);
    this.name = "PositionError";
  }
}

export function sortTransactions<T extends { date: string; createdAt: string }>(transactions: T[]) {
  return [...transactions].sort((left, right) => {
    if (left.date !== right.date) return left.date < right.date ? -1 : 1;
    if (left.createdAt !== right.createdAt) return left.createdAt < right.createdAt ? -1 : 1;
    return 0;
  });
}

export function averageCost(position: Position) {
  if (position.quantity <= QUANTITY_EPSILON) return 0;
  return position.costBasis / position.quantity;
}

function applyTransaction(position: Position, transaction: PositionTransaction) {
  if (transaction.type === "buy") {
    position.quantity += transaction.quantity;
    position.costBasis += transaction.quantity * transaction.price + transaction.fees;
    return;
  }

  if (transaction.quantity - position.quantity > QUANTITY_EPSILON) {
    throw new PositionError();
  }

  const average = averageCost(position);
  const removedCost = average * transaction.quantity;
  const proceeds = transaction.quantity * transaction.price - transaction.fees;
  position.realizedPl += proceeds - removedCost;
  position.costBasis -= removedCost;
  position.quantity -= transaction.quantity;

  if (position.quantity <= QUANTITY_EPSILON) {
    position.quantity = 0;
    position.costBasis = 0;
  }
}

export function buildPositions(transactions: PositionTransaction[]) {
  const positions = new Map<string, Position>();

  for (const transaction of sortTransactions(transactions)) {
    const position = positions.get(transaction.assetId) ?? {
      assetId: transaction.assetId,
      quantity: 0,
      costBasis: 0,
      realizedPl: 0,
    };
    applyTransaction(position, transaction);
    positions.set(transaction.assetId, position);
  }

  return positions;
}

export function openPositions(transactions: PositionTransaction[]) {
  return [...buildPositions(transactions).values()].filter(
    (position) => position.quantity > QUANTITY_EPSILON,
  );
}

export type HistoryPoint = {
  date: string;
  value: number;
  incomplete: boolean;
};

export type HistoryTransaction = {
  assetId: string;
  type: TransactionType;
  quantity: number;
  date: string;
  createdAt: string;
};

export function quantityAt(
  transactions: HistoryTransaction[],
  assetId: string,
  at: string,
) {
  let quantity = 0;
  const atDate = at.slice(0, 10);

  for (const transaction of sortTransactions(transactions)) {
    if (transaction.assetId !== assetId || transaction.date > atDate) continue;
    quantity += transaction.type === "buy" ? transaction.quantity : -transaction.quantity;
  }

  return quantity <= QUANTITY_EPSILON ? 0 : quantity;
}

function lastPriceOnOrBefore(points: { date: string; price: number }[], at: string) {
  let price: number | null = null;
  for (const point of points) {
    if (point.date <= at) price = point.price;
    else break;
  }
  return price;
}

export function buildPortfolioHistory(input: {
  transactions: HistoryTransaction[];
  prices: Record<string, { date: string; price: number }[]>;
  days: string[];
}) {
  const prices = Object.fromEntries(
    Object.entries(input.prices).map(([assetId, points]) => [
      assetId,
      [...points].sort((left, right) => (left.date < right.date ? -1 : 1)),
    ]),
  );
  const assetIds = [...new Set(input.transactions.map((transaction) => transaction.assetId))];
  const points: HistoryPoint[] = [];

  for (const day of input.days) {
    let value = 0;
    let openCount = 0;
    let pricedCount = 0;

    for (const assetId of assetIds) {
      const quantity = quantityAt(input.transactions, assetId, day);
      if (quantity <= 0) continue;
      openCount += 1;
      const price = lastPriceOnOrBefore(prices[assetId] ?? [], day);
      if (price == null) continue;
      pricedCount += 1;
      value += quantity * price;
    }

    if (openCount > 0 && pricedCount === 0) continue;

    points.push({
      date: day,
      value,
      incomplete: pricedCount < openCount,
    });
  }

  return points;
}

export function cumulativeContributions(transactions: PositionTransaction[]) {
  let total = 0;
  const byDate = new Map<string, number>();

  for (const transaction of sortTransactions(transactions)) {
    const cashFlow =
      transaction.type === "buy"
        ? transaction.quantity * transaction.price + transaction.fees
        : -(transaction.quantity * transaction.price - transaction.fees);
    total += cashFlow;
    byDate.set(transaction.date, total);
  }

  return [...byDate.entries()].map(([date, value]) => ({ date, value }));
}
