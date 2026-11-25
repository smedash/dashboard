import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { DashboardWrapper } from "@/components/dashboard/DashboardWrapper";
import { MarketingHome } from "@/components/marketing/MarketingHome";
import { getMessages } from "@/i18n/server";
import { marketingMessages } from "@/i18n/messages/marketing";
import DashboardContent from "./(dashboard)/page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(marketingMessages);
  return { title: t.meta.title, description: t.meta.description };
}

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    return <MarketingHome />;
  }

  return (
    <DashboardWrapper user={session.user}>
      <DashboardContent />
    </DashboardWrapper>
  );
}
