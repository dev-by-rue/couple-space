import Link from "next/link";

type RedirectToProps = {
  pageTitle: string;
  pageMessage: string;
  redirectTo: string;
};

export function RedirectTo({
  pageTitle,
  pageMessage,
  redirectTo,
}: Readonly<RedirectToProps>) {
  const redirectToText =
    redirectTo === "/" ? "Back to home page." : "Back to previous page.";
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-2xl font-bold">{pageTitle}</h1>
      <p className="text-sm text-muted-foreground">{pageMessage}</p>
      <Link
        href={redirectTo}
        className="text-sm bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-md px-4 py-2"
      >
        {redirectToText}
      </Link>
    </div>
  );
}
