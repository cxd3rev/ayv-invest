import { AssetExplorer } from "@/components/assets/AssetExplorer";

export default function AssetsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Assets</h1>
        <p className="mt-2 text-sm text-muted">Search the market, then add a transaction to your portfolio.</p>
      </div>
      <AssetExplorer />
    </div>
  );
}
