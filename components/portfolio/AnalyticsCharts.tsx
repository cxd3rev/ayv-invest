"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatShortDate, formatSignedMoney } from "@/lib/format";

export function ContributionChart({ points }: { points: { date: string; value: number }[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold tracking-tight">Contributions</h2>
      <p className="mt-1 text-sm text-muted">Net cash invested after buys, sells, and fees, converted to EUR.</p>
      {points.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Contributions appear after your first transaction.</p>
      ) : (
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(141,149,168,0.18)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(value) => formatShortDate(String(value))} minTickGap={24} tick={{ fill: "#8d95a8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(value) => formatMoney(Number(value))} width={84} tick={{ fill: "#8d95a8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as { date: string; value: number };
                  return (
                    <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                      <p>{formatShortDate(point.date)}</p>
                      <p className="numeric mt-1">{formatMoney(point.value)}</p>
                    </div>
                  );
                }}
              />
              <Line type="stepAfter" dataKey="value" stroke="#d4b483" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export function ProfitLossChart({
  items,
}: {
  items: { name: string; profitLoss: number }[];
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold tracking-tight">Profit and loss by asset</h2>
      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Profit and loss appears when prices are available.</p>
      ) : (
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={items} layout="vertical" margin={{ top: 8, right: 8, left: 16, bottom: 0 }}>
              <CartesianGrid stroke="rgba(141,149,168,0.18)" horizontal={false} />
              <XAxis type="number" tickFormatter={(value) => formatSignedMoney(Number(value))} tick={{ fill: "#8d95a8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#8d95a8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as { name: string; profitLoss: number };
                  return (
                    <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                      <p>{item.name}</p>
                      <p className="numeric mt-1">{formatSignedMoney(item.profitLoss)}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="profitLoss" fill="#8ea0d8" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
