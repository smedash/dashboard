import LoginForm from "./LoginForm";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

// Verhindere statisches Prerendering
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <>
      <div className="fixed top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      <LoginForm />
    </>
  );
}
