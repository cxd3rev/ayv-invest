"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney, formatPercent } from "@/lib/format";
import type { AllocationSlice } from "@/lib/portfolio/types";

const COLORS = ["#8ea0d8", "#6fbfa8", "#d4b483", "#d9899a", "#9aa3b5", "#b7c4a3", "#c4b4e0"];

export function AllocationChart({
  title,
  items,
  details,
  selected: selectedProp,
  onSelect,
}: {
  title: string;
  items: AllocationSlice[];
  details?: Record<string, { name: string; percent: number }[]>;
  selected?: string | null;
  onSelect?: (name: string | null) => void;
}) {
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const selected = selectedProp === undefined ? localSelected : selectedProp;
  const breakdown = selected && details ? details[selected] : undefined;

  function choose(name: string) {
    const next = selected === name ? null : name;
    setLocalSelected(next);
    onSelect?.(next);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Allocation appears after your holdings have prices.</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={items}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={74}
                  stroke="none"
                  paddingAngle={2}
                  onClick={(_, index) => {
                    const name = items[index]?.name;
                    if (name) choose(name);
                  }}
                >
                  {items.map((item, index) => (
                    <Cell key={item.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload as AllocationSlice;
                    return (
                      <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                        <p>{item.name}</p>
                        <p className="numeric mt-1">{formatMoney(item.value)}</p>
                        <p className="text-muted">{formatPercent(item.percent).replace("+", "")}</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2 text-sm">
            {items.map((item, index) => (
              <li key={item.name}>
                <button
                  type="button"
                  onClick={() => choose(item.name)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left ${
                    selected === item.name ? "bg-foreground/5" : ""
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="numeric shrink-0 text-muted">{formatPercent(item.percent).replace("+", "")}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {breakdown && breakdown.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          {breakdown.map((item) => (
            <li key={item.name} className="flex items-center justify-between gap-3">
              <span className="truncate">{item.name}</span>
              <span className="numeric text-muted">{formatPercent(item.percent).replace("+", "")}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
