type PageLoadingProps = {
  message?: string;
};

export function PageLoading({ message }: Readonly<PageLoadingProps>) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-2xl font-bold">Loading...</h1>
      <p className="text-sm text-muted-foreground">
        {message || "Please wait while we load the page."}
      </p>
    </div>
  );
}
