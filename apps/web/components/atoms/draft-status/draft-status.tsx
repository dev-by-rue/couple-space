export type DraftSaveStatus = "idle" | "pending" | "success" | "error";

const DRAFT_STATUS_COPY: Record<DraftSaveStatus, string> = {
  idle: "You can't change your answer after submitting.",
  pending: "Saving draft…",
  success: "Draft saved · only you can see it",
  error: "Draft not saved",
};

type DraftStatusProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** The draft save mutation's status; picks the copy. */
  status: DraftSaveStatus;
};

/**
 * One line of copy describing where the answer draft is up to.
 *
 * @remarks
 * Falls back to the "can't change after submitting" reminder while idle.
 * `aria-live="polite"` so screen readers hear saves without being interrupted.
 */
export function DraftStatus({
  status,
  ...props
}: Readonly<DraftStatusProps>) {
  return (
    <span aria-live="polite" {...props}>
      {DRAFT_STATUS_COPY[status]}
    </span>
  );
}
