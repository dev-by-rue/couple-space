"use client";

type CoupleMarkProps = {
  you: string;
  yourPartner: string;
};

export function CoupleMark({ you, yourPartner }: CoupleMarkProps) {
  return (
    <div
      className="flex -space-x-2"
      aria-label={[you, yourPartner].join(" and ")}
    >
      <span className="grid size-11 place-items-center rounded-full border-2 border-background bg-primary text-sm font-semibold text-primary-foreground">
        {you.slice(0, 1)}
      </span>
      <span className="grid size-11 place-items-center rounded-full border-2 border-background bg-secondary text-sm font-semibold text-secondary-foreground">
        {yourPartner.slice(0, 1)}
      </span>
    </div>
  );
}
