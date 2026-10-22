import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/atoms/logo/logo";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex flex-col items-center">
        <Logo className="size-20" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-primary">
        Couple Space
      </h1>
      <p className="text-muted-foreground text-sm  ">
        The original{" "}
        <span className="bg-primary py-1 px-2 rounded-xl text-white">
          safe space
        </span>{" "}
        for couples.
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
