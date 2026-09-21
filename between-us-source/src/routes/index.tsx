import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CoupleMark, ConversationCard, DisabledSettings, InviteStatusCard, PageShell, PageSkeleton, Steps } from "@/components/couple-space";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCouplePrototype } from "@/mocks/CouplePrototypeProvider";
import { memberName } from "@/types/couple";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Your space — Between Us" },
    { name: "description", content: "A calm, private place for you and your partner to talk." },
    { property: "og:title", content: "Your space — Between Us" },
    { property: "og:description", content: "A calm, private place for you and your partner to talk." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  pendingComponent: PageSkeleton,
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  const { couple, sessions, viewerId, firstVisit, setFirstVisit } = useCouplePrototype();
  const viewer = couple.members.find((member) => member.id === viewerId) ?? couple.members[0];
  const partner = couple.members.find((member) => member.id !== viewer?.id);
  if (!viewer || !partner) return <PageShell><p role="alert">We couldn't load your couple space.</p></PageShell>;
  const active = couple.members.every((member) => member.emailVerified && member.inviteAccepted);

  return <PageShell><header className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Good evening</p><h1 className="mt-1 font-display text-4xl leading-tight">You &amp; {memberName(partner)}</h1></div><CoupleMark members={couple.members} /></header>{!active ? <div className="mt-10 space-y-8"><InviteStatusCard partner={partner} /><section className="py-4"><h2 className="text-center font-display text-2xl">Something thoughtful to share</h2><p className="mx-auto mt-2 max-w-lg text-center leading-relaxed text-muted-foreground">Once you're both here, you'll answer thoughtful questions separately, then reveal them together.</p><div className="mt-7"><Steps /></div></section><TooltipProvider><Tooltip><TooltipTrigger asChild><span className="block"><Button disabled className="h-12 w-full">Start a conversation</Button></span></TooltipTrigger><TooltipContent>Your partner needs to join first</TooltipContent></Tooltip></TooltipProvider></div> : <div className="mt-10">{firstVisit && <section className="relative mb-8 overflow-hidden rounded-card bg-accent-soft p-6"><Button size="icon" variant="ghost" className="absolute right-2 top-2" aria-label="Dismiss welcome" onClick={() => setFirstVisit(false)}><X /></Button><Heart className="size-5 text-accent-foreground" /><h2 className="mt-4 font-display text-2xl">This space belongs to both of you.</h2><p className="mt-2 max-w-lg leading-relaxed text-muted-foreground">There is no right way to answer. Take your time, be honest, and meet each other with curiosity.</p></section>}<section><h2 className="font-display text-2xl">A little time for the two of you</h2><p className="mt-2 leading-relaxed text-muted-foreground">Choose a question, answer separately, and open your answers together.</p><Button asChild className="mt-6 h-12 w-full sm:w-auto"><Link to="/start">Start a conversation</Link></Button></section><section className="mt-12"><div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase text-accent-foreground">In your space</p><h2 className="mt-1 font-display text-2xl">Your conversations</h2></div></div>{sessions.length ? <div className="grid gap-4">{sessions.map((session) => <ConversationCard key={session.id} session={session} />)}</div> : <div className="rounded-card border border-dashed border-border p-8 text-center text-muted-foreground">Your conversations will appear here.</div>}</section><Collapsible className="mt-10 border-y border-border py-2"><CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between text-sm font-semibold">How it works <ChevronDown className="size-4" /></CollapsibleTrigger><CollapsibleContent className="pb-5 pt-3"><Steps compact /></CollapsibleContent></Collapsible><footer className="mt-8 flex justify-center"><DisabledSettings /></footer></div>}</PageShell>;
}
