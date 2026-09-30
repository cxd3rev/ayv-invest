import { SettingsForm } from "@/components/settings/SettingsForm";
import { getAccount } from "@/lib/portfolio/account";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const account = await getAccount();
  if (!account) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted">Account details for AYV Invest.</p>
      </div>
      <SettingsForm
        displayName={account.displayName}
        email={account.email}
        theme={account.theme}
        showSampleTools={process.env.NODE_ENV === "development"}
      />
    </div>
  );
}
