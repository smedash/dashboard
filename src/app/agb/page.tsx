import { LegalPage, getLegalMetadata } from "@/components/marketing/LegalPage";

export function generateMetadata() {
  return getLegalMetadata("terms");
}

export default function AgbPage() {
  return <LegalPage doc="terms" />;
}
