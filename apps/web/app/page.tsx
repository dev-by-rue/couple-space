import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Couple Space</h1>
      <p className="text-muted-foreground text-sm">
        The original safe space for couples.
      </p>
      <div className="flex gap-3">
        <Button nativeButton={false} render={<Link href="/login" />}>
          Log in
        </Button>
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href="/register" />}
        >
          Register
        </Button>
      </div>
    </main>
  );
}
