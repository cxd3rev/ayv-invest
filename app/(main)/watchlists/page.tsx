"use client";

import { WatchlistBoard } from "@/components/markets/WatchlistBoard";

export default function WatchlistsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Watchlists</h1>
        <p className="mt-2 text-sm text-muted">Track assets with the same search used when you add an investment.</p>
      </div>
      <WatchlistBoard />
    </div>
  );
}
