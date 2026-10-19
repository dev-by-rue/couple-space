"use client";

import { redirect } from "next/navigation";
import { useMeQuery } from "@/hooks/use-me";
import { AppHeader } from "@/components/organisms/app-header/app-header";

type AppLayoutProps = {
  children: React.ReactNode;
};

export default function AppLayout({ children }: Readonly<AppLayoutProps>) {
  const me = useMeQuery();

  if (me.isPending) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6 text-sm">
        Loading session…
      </main>
    );
  }

  if (me.isError) {
    redirect("/login");
  }

  if (!me.data.emailVerified) {
    redirect("/check-email");
  }

  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
