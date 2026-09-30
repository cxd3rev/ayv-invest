"use client";

import { AlertsBoard } from "@/components/alerts/AlertsBoard";

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Alerts</h1>
        <p className="mt-2 text-sm text-muted">Price conditions for assets you choose. Checked against the live feed only when you ask.</p>
      </div>
      <AlertsBoard />
    </div>
  );
}
