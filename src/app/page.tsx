import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import DashboardContent from "./(dashboard)/page";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors">
      <Sidebar />
      <div className="lg:pl-72">
        <Header user={session.user} />
        <main className="py-8 px-4 sm:px-6 lg:px-8">
          <DashboardContent />
        </main>
      </div>
    </div>
  );
}
