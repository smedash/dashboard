import LoginForm from "./LoginForm";

// Verhindere statisches Prerendering
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm />;
}
