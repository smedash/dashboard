import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardWrapper } from "@/components/dashboard/DashboardWrapper";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardWrapper user={session.user}>
      {children}
    </DashboardWrapper>
  );
}


