import { LegalPage, getLegalMetadata } from "@/components/marketing/LegalPage";

export function generateMetadata() {
  return getLegalMetadata("privacy");
}

export default function DatenschutzPage() {
  return <LegalPage doc="privacy" />;
}
