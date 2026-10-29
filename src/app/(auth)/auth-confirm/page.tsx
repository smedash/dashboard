import AuthConfirmForm from "./AuthConfirmForm";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

// Verhindere statisches Prerendering
export const dynamic = "force-dynamic";

export default function AuthConfirmPage() {
  return (
    <>
      <div className="fixed top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      <AuthConfirmForm />
    </>
  );
}
