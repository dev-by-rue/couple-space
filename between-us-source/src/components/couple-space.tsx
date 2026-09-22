import { Link } from "@tanstack/react-router";
import {
  ChevronDown,
  Clock3,
  Copy,
  Heart,
  LockKeyhole,
  MessageCircleQuestion,
  RotateCcw,
  Settings2,
  Sparkles,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCouplePrototype } from "@/mocks/CouplePrototypeProvider";
import {
  memberName,
  type DirectedQuestion,
  type FollowUp,
  type Member,
  type Session,
  type Theme,
} from "@/types/couple";

// EXTRACTION [adapt] PageShell
// → layout class or thin shell; align max-w-[720px] with apps/web max-w-3xl deliberately
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-5 pb-28 pt-8 text-foreground sm:px-8 sm:pt-12">
      <div className="mx-auto w-full max-w-[720px]">{children}</div>
    </main>
  );
}

// EXTRACTION [rewrite] PageSkeleton
// → molecules/couple-page-skeleton.tsx; Skeleton via add-via-shadcn (do not copy proto ui/skeleton)
export function PageSkeleton({ detail = false }: { detail?: boolean }) {
  return (
    <PageShell>
      <div aria-label="Loading your space" role="status">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-56" />
          </div>
          <Skeleton className="size-11 rounded-full" />
        </div>
        <Skeleton className="mt-10 h-44 w-full rounded-card" />
        {detail && <Skeleton className="mt-6 h-64 w-full rounded-card" />}
        <span className="sr-only">Loading</span>
      </div>
    </PageShell>
  );
}

// EXTRACTION [adapt] CoupleMark — DUPLICATE
// → organisms/couple-mark.tsx already exists; adapt one, do not add a second
export function CoupleMark({ members }: { members: Member[] }) {
  return (
    <div className="flex -space-x-2" aria-label={members.map(memberName).join(" and ")}>
      {members.map((member, index) => (
        <span
          key={member.id}
          className={`grid size-11 place-items-center rounded-full border-2 border-background text-sm font-semibold ${
            index === 0
              ? "bg-accent-soft text-accent-foreground"
              : "bg-waiting-soft text-waiting-foreground"
          }`}
        >
          {memberName(member).slice(0, 1)}
        </span>
      ))}
    </div>
  );
}

// EXTRACTION [rewrite] Steps
// → molecules/how-it-works-steps.tsx; "Open together" → per-user Reveal copy
export function Steps({ compact = false }: { compact?: boolean }) {
  const steps = [
    { title: "Answer", text: "Share privately", icon: LockKeyhole },
    { title: "Reveal", text: "Open together", icon: Sparkles },
    { title: "Talk", text: "Stay curious", icon: MessageCircleQuestion },
  ];
  return (
    <ol className={`grid grid-cols-3 ${compact ? "gap-2" : "gap-3"}`}>
      {steps.map(({ title, text, icon: Icon }) => (
        <li key={title} className="text-center">
          <span className="mx-auto mb-2 grid size-10 place-items-center rounded-full bg-secondary text-secondary-foreground">
            <Icon className="size-4" />
          </span>
          <strong className="block text-sm font-semibold">{title}</strong>
          <span className="text-xs text-muted-foreground">{text}</span>
        </li>
      ))}
    </ol>
  );
}

// EXTRACTION [rewrite] StatusPill
// → molecules/conversation-status-pill.tsx; use Nest SessionViewerPhase, not proto A/B/C/D labels
export function StatusPill({ session }: { session: Session }) {
  const viewer = useCouplePrototype().viewerId;
  const own = session.responses.find((response) => response.memberId === viewer);
  const all = session.responses.length > 1 && session.responses.every((response) => response.submitted);
  const label =
    session.status === "in_discussion"
      ? "In discussion"
      : all || session.status === "revealed"
        ? "Ready to reveal"
        : own?.submitted
          ? "Waiting together"
          : "Your turn";
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-3 text-xs font-semibold ${
        own?.submitted && !all
          ? "bg-waiting-soft text-waiting-foreground"
          : "bg-accent-soft text-accent-foreground"
      }`}
    >
      {label}
    </span>
  );
}

// EXTRACTION [rewrite] ConversationCard
// → molecules/conversation-card.tsx; CTA must never say "Reveal together"
export function ConversationCard({ session }: { session: Session }) {
  const viewer = useCouplePrototype().viewerId;
  const own = session.responses.find((response) => response.memberId === viewer);
  const all = session.responses.every((response) => response.submitted);
  const action =
    session.status === "in_discussion"
      ? "Continue talking"
      : all
        ? "Reveal together"
        : own?.submitted
          ? "View waiting space"
          : "Answer privately";
  return (
    <article className="rounded-card border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <StatusPill session={session} />
        <span className="text-xs text-muted-foreground">Just now</span>
      </div>
      <h3 className="mt-4 font-display text-xl leading-snug">{session.prompt.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {session.prompt.text}
      </p>
      <Button asChild variant="outline" className="mt-5 h-11 w-full">
        <Link to="/conversation/$id" params={{ id: session.id }}>
          {action}
        </Link>
      </Button>
    </article>
  );
}

// EXTRACTION [rewrite] InviteStatusCard
// → Prefer existing InvitePartnerForm / InviteLinkDisplay; do not port toast or example.com stubs
export function InviteStatusCard({ partner }: { partner: Member }) {
  const copy = async () => {
    await navigator.clipboard?.writeText("https://example.com/invite/couple-1");
    toast.success("Invite link copied");
  };
  return (
    <section className="rounded-card border border-border bg-card p-6 shadow-soft">
      <div className="grid size-11 place-items-center rounded-full bg-waiting-soft text-waiting-foreground">
        <Clock3 className="size-5" />
      </div>
      <h2 className="mt-5 font-display text-2xl">Your space is ready.</h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Waiting for <span className="font-medium text-foreground">{partner.email}</span> to join.
      </p>
      <div className="mt-5 flex items-center gap-2 text-sm text-waiting-foreground">
        <span className="size-2 rounded-full bg-waiting" />
        Invite sent · awaiting acceptance
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button
          variant="secondary"
          className="h-11"
          onClick={() => toast.success("Invite sent again")}
        >
          <RotateCcw />
          Resend invite
        </Button>
        <Button variant="outline" className="h-11" onClick={copy}>
          <Copy />
          Copy invite link
        </Button>
      </div>
    </section>
  );
}

// EXTRACTION [rewrite] ThemeCard
// → molecules/theme-card.tsx
export function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: Theme;
  selected: boolean;
  onSelect(): void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="min-h-32 rounded-card border border-border bg-card p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[selected=true]:border-accent data-[selected=true]:bg-accent-soft"
      data-selected={selected}
    >
      <span className="text-xl text-accent-foreground" aria-hidden>
        {theme.symbol}
      </span>
      <strong className="mt-3 block font-display text-lg">{theme.title}</strong>
      <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
        {theme.description}
      </span>
    </button>
  );
}

// EXTRACTION [rewrite] PromptComposer — later (T3), not walking skeleton
// → organisms/prompt-composer.tsx; Textarea via add-via-shadcn
export function PromptComposer({ onStart }: { onStart(value: string): void }) {
  const [value, setValue] = useState("");
  const max = 280;
  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-soft">
      <label htmlFor="custom-prompt" className="font-display text-xl">
        Write something you'd both like to talk about
      </label>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Keep it open, specific, and kind. Avoid sharing sensitive information you would not want
        saved.
      </p>
      <Textarea
        id="custom-prompt"
        value={value}
        maxLength={max}
        onChange={(event) => setValue(event.target.value)}
        className="mt-5 min-h-36 resize-none bg-surface p-4 leading-relaxed"
        placeholder="What would you like to understand better together?"
      />
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>A thoughtful question is enough.</span>
        <span>
          {value.length}/{max}
        </span>
      </div>
      <Button
        className="mt-5 h-11 w-full"
        disabled={!value.trim()}
        onClick={() => onStart(value.trim())}
      >
        Start this conversation
      </Button>
    </div>
  );
}

// EXTRACTION [rewrite] AnswerCard
// → molecules/answer-card.tsx
export function AnswerCard({ member, text }: { member: Member; text: string }) {
  return (
    <article className="rounded-card border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent-foreground">
          {memberName(member).slice(0, 1)}
        </span>
        <h3 className="font-semibold">{memberName(member)}</h3>
      </div>
      <p className="mt-5 text-[1.05rem] leading-8">{text}</p>
    </article>
  );
}

// EXTRACTION [rewrite] RevealPanel
// → organisms/session-reveal-panel.tsx; proto auto-reveals — gate on per-user Reveal in web
export function RevealPanel({ session }: { session: Session }) {
  const { couple } = useCouplePrototype();
  return (
    <section aria-live="polite" className="reveal-once">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent-foreground">
          <Sparkles className="size-4" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase text-accent-foreground">Revealed together</p>
          <h2 className="font-display text-2xl">Both answers are here</h2>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {couple.members.map((member) => (
          <AnswerCard
            key={member.id}
            member={member}
            text={session.responses.find((response) => response.memberId === member.id)?.text ?? ""}
          />
        ))}
      </div>
    </section>
  );
}

// EXTRACTION [rewrite] WaitingState
// → molecules/session-waiting.tsx; update copy for per-user Reveal
export function WaitingState({ partner }: { partner: Member }) {
  return (
    <section
      aria-live="polite"
      className="rounded-card border border-waiting-border bg-waiting-soft p-7 text-center"
    >
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-card text-waiting-foreground shadow-soft">
        <Clock3 className="size-5" />
      </span>
      <h2 className="mt-5 font-display text-2xl">Waiting for {memberName(partner)}.</h2>
      <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted-foreground">
        Your answer is safely submitted. Take your time—we'll reveal both answers together.
      </p>
      <p className="mt-5 text-sm text-waiting-foreground">We'll let you know when it's time to reveal.</p>
    </section>
  );
}

// EXTRACTION [rewrite] FollowUpCard — later (T5)
// → organisms/follow-up-card.tsx
export function FollowUpCard({
  sessionId,
  followUp,
}: {
  sessionId: string;
  followUp: FollowUp;
}) {
  const { couple, viewerId, submitFollowUp } = useCouplePrototype();
  const [answer, setAnswer] = useState("");
  const own = followUp.responses.find((response) => response.memberId === viewerId);
  const partner = couple.members.find((member) => member.id !== viewerId);
  const all =
    couple.members.length > 1 &&
    couple.members.every((member) =>
      followUp.responses.some(
        (response) => response.memberId === member.id && response.submitted,
      ),
    );
  return (
    <article className="rounded-card border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase text-accent-foreground">Follow-up</p>
      <h3 className="mt-2 font-display text-xl leading-snug">{followUp.question}</h3>
      {all ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {couple.members.map((member) => (
            <AnswerCard
              key={member.id}
              member={member}
              text={
                followUp.responses.find((response) => response.memberId === member.id)?.text ?? ""
              }
            />
          ))}
        </div>
      ) : own?.submitted ? (
        <p className="mt-5 rounded-md bg-waiting-soft p-4 text-sm leading-relaxed text-waiting-foreground">
          Your response is saved. Waiting for {partner ? memberName(partner) : "your partner"}; both
          responses will appear together.
        </p>
      ) : (
        <div className="mt-5">
          <Textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            className="min-h-28 resize-none bg-surface"
            placeholder="Your private response"
            aria-label={`Your response to ${followUp.question}`}
          />
          <Button
            className="mt-3 h-11"
            disabled={!answer.trim()}
            onClick={() => submitFollowUp(sessionId, followUp.id, answer.trim())}
          >
            Submit response
          </Button>
        </div>
      )}
    </article>
  );
}

// EXTRACTION [skip] DirectedQuestionCard
// → ignore for MVP; anonymous /start pool instead
export function DirectedQuestionCard({
  sessionId,
  question,
}: {
  sessionId: string;
  question: DirectedQuestion;
}) {
  const { couple, viewerId, answerDirectedQuestion } = useCouplePrototype();
  const [answer, setAnswer] = useState("");
  const from = couple.members.find((member) => member.id === question.fromMemberId);
  const isRecipient = viewerId === question.toMemberId;
  return (
    <article className="rounded-card border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        Question from {from ? memberName(from) : "your partner"}
      </p>
      <h3 className="mt-2 font-display text-xl">{question.question}</h3>
      {question.answer ? (
        <div className="mt-5 border-t border-border pt-5">
          <p className="text-xs font-semibold uppercase text-accent-foreground">Answer</p>
          <p className="mt-2 leading-7">{question.answer}</p>
        </div>
      ) : isRecipient ? (
        <div className="mt-5">
          <Textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            className="min-h-28 resize-none bg-surface"
            placeholder="Your answer"
          />
          <Button
            className="mt-3 h-11"
            disabled={!answer.trim()}
            onClick={() => answerDirectedQuestion(sessionId, question.id, answer.trim())}
          >
            Share answer
          </Button>
        </div>
      ) : (
        <p className="mt-5 rounded-md bg-waiting-soft p-4 text-sm text-waiting-foreground">
          Waiting for their answer.
        </p>
      )}
    </article>
  );
}

// EXTRACTION [rewrite] DisabledSettings
// → optional molecule; Tooltip via add-via-shadcn; low priority
export function DisabledSettings() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block">
            <Button disabled variant="ghost" className="h-11">
              <Settings2 />
              Couple settings
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Coming soon</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// EXTRACTION [skip] PrototypeControls — DEV only
// → never extract; teaches wrong A/B/C/D status machine
export function PrototypeControls() {
  const {
    couple,
    sessions,
    viewerId,
    setViewerId,
    setCoupleActive,
    setSessionState,
    setFollowUpState,
  } = useCouplePrototype();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "p" && (event.ctrlKey || event.metaKey)) {
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  if (!import.meta.env.DEV) return null;
  return (
    <aside className="fixed bottom-4 right-4 z-40">
      <Button
        size="icon"
        variant="secondary"
        aria-label="Toggle prototype controls"
        title="Prototype controls"
        onClick={() => setOpen((value) => !value)}
      >
        <Settings2 />
      </Button>
      {open && (
        <div className="absolute bottom-14 right-0 w-[min(21rem,calc(100vw-2rem))] rounded-card border border-border bg-popover p-4 text-popover-foreground shadow-panel">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Prototype controls</p>
              <p className="text-xs text-muted-foreground">Development only</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Close controls" onClick={() => setOpen(false)}>
              <X />
            </Button>
          </div>
          <label className="mt-4 block text-xs font-semibold">Viewing as</label>
          <select
            className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={viewerId}
            onChange={(event) => setViewerId(event.target.value)}
          >
            {couple.members.map((member) => (
              <option key={member.id} value={member.id}>
                {memberName(member)}
              </option>
            ))}
          </select>
          <label className="mt-4 block text-xs font-semibold">Couple state</label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={() => setCoupleActive(false)}>
              Invite pending
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCoupleActive(true)}>
              Active
            </Button>
          </div>
          {sessions.map((session) => (
            <div key={session.id} className="mt-4 border-t border-border pt-4">
              <p className="truncate text-xs font-semibold">{session.prompt.title}</p>
              <div className="mt-2 grid grid-cols-4 gap-1">
                {(["A", "B", "C", "D"] as const).map((state) => (
                  <Button
                    key={state}
                    size="sm"
                    variant="outline"
                    onClick={() => setSessionState(session.id, state)}
                  >
                    {state}
                  </Button>
                ))}
              </div>
              {session.followUps.map((followUp, index) => (
                <div key={followUp.id} className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Follow-up {index + 1}</span>
                  <div className="flex gap-1">
                    {(["A", "B", "C"] as const).map((state) => (
                      <Button
                        key={state}
                        size="sm"
                        variant="ghost"
                        onClick={() => setFollowUpState(session.id, followUp.id, state)}
                      >
                        {state}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
