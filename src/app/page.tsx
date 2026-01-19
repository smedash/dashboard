import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardWrapper } from "@/components/dashboard/DashboardWrapper";
import DashboardContent from "./(dashboard)/page";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardWrapper user={session.user}>
      <DashboardContent />
    </DashboardWrapper>
  );
}
