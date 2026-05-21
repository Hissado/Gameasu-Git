import { useSearch } from "wouter";
import { UpgradeRequired } from "@/components/FeatureGate";

export default function UpgradeRequiredPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const moduleKey = params.get("module") ?? undefined;
  return <UpgradeRequired moduleKey={moduleKey} />;
}
