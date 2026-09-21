import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LockKeyhole, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DirectedQuestionCard, FollowUpCard, PageShell, PageSkeleton, RevealPanel, WaitingState } from "@/components/couple-space";
import { useCouplePrototype } from "@/mocks/CouplePrototypeProvider";
import { memberName } from "@/types/couple";

export const Route = createFileRoute("/conversation/$id")({
  head: () => ({ meta: [
    { title: "A private conversation — Between Us" },
    { name: "description", content: "Answer privately, reveal together, and keep the conversation going." },
    { property: "og:title", content: "A private conversation — Between Us" },
    { property: "og:description", content: "Answer privately, reveal together, and keep the conversation going." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  pendingComponent: () => <PageSkeleton detail />,
  component: ConversationPage,
});

function ConversationPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate({ from: "/conversation/$id" });
  const { couple, sessions, viewerId, submitResponse, addDirectedQuestion } = useCouplePrototype();
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const session = sessions.find((item) => item.id === id);
  const viewer = couple.members.find((member) => member.id === viewerId);
  const partner = couple.members.find((member) => member.id !== viewerId);
  if (!session || !viewer || !partner) return <PageShell><Button variant="ghost" onClick={() => navigate({ to: "/" })}><ArrowLeft />Your space</Button><section className="mt-16 text-center"><h1 className="font-display text-3xl">This conversation isn't available.</h1><p className="mt-3 text-muted-foreground">Return to your space and choose another conversation.</p></section></PageShell>;
  const own = session.responses.find((response) => response.memberId === viewerId);
  const partnerResponse = session.responses.find((response) => response.memberId === partner.id);
  const bothSubmitted = Boolean(own?.submitted && partnerResponse?.submitted);
  const discussion = session.status === "in_discussion";
  // TODO(product): Decide whether reveal requires an explicit action from both members.

  const submit = () => { submitResponse(session.id, answer.trim()); setConfirmOpen(false); };
  return <PageShell><Button variant="ghost" className="-ml-3 h-11" onClick={() => navigate({ to: "/" })}><ArrowLeft />Your space</Button><header className="mt-8 border-b border-border pb-8"><p className="text-xs font-semibold uppercase text-accent-foreground">Tonight's question</p><h1 className="mt-3 max-w-2xl font-display text-3xl leading-snug sm:text-4xl">{session.prompt.text}</h1><p className="mt-4 text-sm text-muted-foreground">{session.prompt.kind === "custom" ? "A question from your space" : session.prompt.title}</p></header><div className="mt-8">{!own?.submitted ? <section><div className="mb-5 flex items-center gap-3 rounded-md bg-secondary p-4 text-sm leading-relaxed text-secondary-foreground"><LockKeyhole className="size-5 shrink-0" />Only you can see this until you've both answered.</div>{partnerResponse?.submitted && <p className="mb-4 text-sm font-medium text-waiting-foreground">{memberName(partner)} has answered. Yours will still stay private until you submit.</p>}<label htmlFor="answer" className="font-display text-2xl">Your answer</label><Textarea id="answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Take your time..." className="mt-4 min-h-56 resize-none bg-card p-5 text-base leading-8 shadow-soft" /><Dialog open={confirmOpen} onOpenChange={setConfirmOpen}><DialogTrigger asChild><Button className="mt-5 h-12 w-full sm:w-auto" disabled={!answer.trim()}>Submit my answer</Button></DialogTrigger><DialogContent className="max-w-md rounded-card"><DialogHeader><DialogTitle className="font-display text-2xl">Ready to submit?</DialogTitle><DialogDescription className="pt-2 leading-relaxed">Once submitted, you can't edit it. Your answer stays private until both of you have answered.</DialogDescription></DialogHeader><DialogFooter className="mt-4 gap-2"><Button variant="outline" onClick={() => setConfirmOpen(false)}>Keep writing</Button><Button onClick={submit}>Submit answer</Button></DialogFooter></DialogContent></Dialog></section> : !bothSubmitted ? <WaitingState partner={partner} /> : <RevealPanel session={session} />}</div>{bothSubmitted && discussion && <div className="mt-14 space-y-14"><section><p className="text-xs font-semibold uppercase text-accent-foreground">Keep exploring</p><h2 className="mt-2 font-display text-3xl">Curated follow-ups</h2><p className="mt-2 leading-relaxed text-muted-foreground">Answer each one separately. Both responses appear only when you are both ready.</p><div className="mt-6 space-y-4">{session.followUps.map((followUp) => <FollowUpCard key={followUp.id} sessionId={session.id} followUp={followUp} />)}</div></section><section><p className="text-xs font-semibold uppercase text-accent-foreground">A question of your own</p><h2 className="mt-2 font-display text-3xl">Ask {memberName(partner)}</h2><p className="mt-2 leading-relaxed text-muted-foreground">Pose one clear question. Their answer will be visible to both of you when they submit it.</p><div className="mt-6 rounded-card border border-border bg-card p-5"><label htmlFor="partner-question" className="text-sm font-semibold">Question from {memberName(viewer)}</label><Textarea id="partner-question" value={question} onChange={(event) => setQuestion(event.target.value)} className="mt-3 min-h-28 resize-none bg-surface" placeholder={`What would you like to ask ${memberName(partner)}?`} /><Button className="mt-3 h-11" disabled={!question.trim()} onClick={() => { addDirectedQuestion(session.id, question.trim()); setQuestion(""); }}><Send />Ask this question</Button></div><div className="mt-4 space-y-4">{session.directedQuestions.map((item) => <DirectedQuestionCard key={item.id} sessionId={session.id} question={item} />)}</div></section></div>}</PageShell>;
}