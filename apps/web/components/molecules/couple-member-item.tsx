type CoupleMemberItemProps = {
  displayName: string;
  email: string;
  emailVerified: boolean;
};

export function CoupleMemberItem({
  displayName,
  email,
  emailVerified,
}: CoupleMemberItemProps) {
  return (
    <li>
      {displayName} ({email})
      {emailVerified ? "" : " — unverified"}
    </li>
  );
}
