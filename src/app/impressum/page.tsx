import { LegalPage, getLegalMetadata } from "@/components/marketing/LegalPage";

export function generateMetadata() {
  return getLegalMetadata("imprint");
}

export default function ImpressumPage() {
  return <LegalPage doc="imprint" />;
}
