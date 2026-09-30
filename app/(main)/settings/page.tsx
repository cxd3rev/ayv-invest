"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { PortfolioBody } from "@/components/portfolio/PortfolioProvider";

export default function SettingsPage() {
  return (
    <PortfolioBody>
      {(view) => (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
            <p className="mt-2 text-sm text-muted">Account details for AYV Invest.</p>
          </div>
          <SettingsForm
            displayName={view.displayName}
            email={view.email}
            theme={view.theme}
            showSampleTools={process.env.NODE_ENV === "development"}
          />
        </div>
      )}
    </PortfolioBody>
  );
}
