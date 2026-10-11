type InviteLinkDisplayProps = {
  href: string;
};

export function InviteLinkDisplay({ href }: Readonly<InviteLinkDisplayProps>) {
  return (
    <p className="break-all rounded-md bg-muted p-3 text-xs">
      Share this link: {href}
    </p>
  );
}
