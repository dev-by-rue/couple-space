"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type Me = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  dateOfBirth: string;
  couple: null;
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<Me>("/me"),
    retry: false,
  });

  useEffect(() => {
    if (me.isError) {
      router.replace("/login");
    }
  }, [me.isError, router]);

  if (me.isPending) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6 text-sm">
        Loading session…
      </main>
    );
  }

  if (me.isError) {
    return null;
  }

  return <>{children}</>;
}
