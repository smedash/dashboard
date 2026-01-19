"use client";

import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { PropertyProvider } from "@/contexts/PropertyContext";

interface DashboardWrapperProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  children: React.ReactNode;
}

export function DashboardWrapper({ user, children }: DashboardWrapperProps) {
  return (
    <PropertyProvider>
      <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors">
        <Sidebar />
        <div className="lg:pl-72">
          <Header user={user} />
          <main className="py-8 px-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </PropertyProvider>
  );
}
