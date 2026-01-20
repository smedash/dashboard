import AuthConfirmForm from "./AuthConfirmForm";

// Verhindere statisches Prerendering
export const dynamic = "force-dynamic";

export default function AuthConfirmPage() {
  return <AuthConfirmForm />;
}
