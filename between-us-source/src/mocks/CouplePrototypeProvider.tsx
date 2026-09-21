import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Couple, PrototypeConversationState, Session } from "@/types/couple";
import { initialCouple, initialSessions, themes } from "./data";

type PrototypeContextValue = {
  couple: Couple;
  sessions: Session[];
  themes: typeof themes;
  viewerId: string;
  firstVisit: boolean;
  setFirstVisit(value: boolean): void;
  setViewerId(id: string): void;
  setCoupleActive(active: boolean): void;
  setSessionState(id: string, state: PrototypeConversationState): void;
  setFollowUpState(sessionId: string, followUpId: string, state: "A" | "B" | "C"): void;
  submitResponse(sessionId: string, text: string): void;
  submitFollowUp(sessionId: string, followUpId: string, text: string): void;
  addDirectedQuestion(sessionId: string, question: string): void;
  answerDirectedQuestion(sessionId: string, questionId: string, answer: string): void;
  startPrompt(promptId: string): string;
  startCustomPrompt(text: string): string;
};

const PrototypeContext = createContext<PrototypeContextValue | null>(null);

function responseFor(memberId: string, text: string, submitted: boolean) {
  return { memberId, text, submitted };
}

export function CouplePrototypeProvider({ children }: { children: ReactNode }) {
  const [couple, setCouple] = useState(initialCouple);
  const [sessions, setSessions] = useState(initialSessions);
  const [viewerId, setViewerId] = useState(initialCouple.members[0]?.id ?? "");
  const [firstVisit, setFirstVisit] = useState(true);

  const setCoupleActive = (active: boolean) => {
    setCouple((current) => ({
      ...current,
      members: current.members.map((member, index) => index === 1 ? { ...member, inviteAccepted: active } : member),
    }));
  };

  const setSessionState = (id: string, state: PrototypeConversationState) => {
    setSessions((current) => current.map((session) => {
      if (session.id !== id) return session;
      const [viewer, partner] = couple.members;
      if (!viewer || !partner) return session;
      const actualViewer = couple.members.find((member) => member.id === viewerId) ?? viewer;
      const actualPartner = couple.members.find((member) => member.id !== actualViewer.id) ?? partner;
      const submitted = (memberId: string, fallback: string) => responseFor(memberId, fallback, true);
      if (state === "A") return { ...session, status: "awaiting_responses", responses: [responseFor(actualViewer.id, "", false), responseFor(actualPartner.id, "", false)] };
      if (state === "B") return { ...session, status: "awaiting_responses", responses: [submitted(actualViewer.id, "A private answer waiting to be revealed."), responseFor(actualPartner.id, "", false)] };
      return { ...session, status: state === "C" ? "revealed" : "in_discussion", responses: [submitted(actualViewer.id, "Making tea together before the rest of the evening begins."), submitted(actualPartner.id, "The walk home when we were both tired and still made each other laugh.")] };
    }));
  };

  const setFollowUpState = (sessionId: string, followUpId: string, state: "A" | "B" | "C") => {
    setSessions((current) => current.map((session) => session.id !== sessionId ? session : {
      ...session,
      followUps: session.followUps.map((followUp) => followUp.id !== followUpId ? followUp : {
        ...followUp,
        responses: state === "A" ? [] : state === "B"
          ? [responseFor(viewerId, "A private follow-up answer.", true)]
          : couple.members.map((member, index) => responseFor(member.id, index === 0 ? "I noticed how much care was in the details." : "I was surprised we chose such similar moments.", true)),
      }),
    }));
  };

  const submitResponse = (sessionId: string, text: string) => setSessions((current) => current.map((session) => session.id !== sessionId ? session : {
    ...session,
    responses: session.responses.map((response) => response.memberId === viewerId ? { ...response, text, submitted: true } : response),
  }));

  const submitFollowUp = (sessionId: string, followUpId: string, text: string) => setSessions((current) => current.map((session) => session.id !== sessionId ? session : {
    ...session,
    followUps: session.followUps.map((followUp) => followUp.id !== followUpId ? followUp : { ...followUp, responses: [...followUp.responses.filter((response) => response.memberId !== viewerId), responseFor(viewerId, text, true)] }),
  }));

  const addDirectedQuestion = (sessionId: string, question: string) => setSessions((current) => current.map((session) => session.id !== sessionId ? session : {
    ...session,
    directedQuestions: [...session.directedQuestions, { id: crypto.randomUUID(), fromMemberId: viewerId, toMemberId: couple.members.find((member) => member.id !== viewerId)?.id ?? "", question }],
  }));

  const answerDirectedQuestion = (sessionId: string, questionId: string, answer: string) => setSessions((current) => current.map((session) => session.id !== sessionId ? session : {
    ...session,
    directedQuestions: session.directedQuestions.map((question) => question.id === questionId ? { ...question, answer } : question),
  }));

  const startPrompt = (promptId: string) => {
    const prompt = themes.flatMap((theme) => theme.prompts).find((item) => item.id === promptId);
    if (!prompt) return initialSessions[0]?.id ?? "";
    const id = `conversation-${Date.now()}`;
    setSessions((current) => [...current, { id, prompt, status: "awaiting_responses", responses: couple.members.map((member) => responseFor(member.id, "", false)), followUps: initialSessions[0]?.followUps.map((item) => ({ ...item, responses: [] })) ?? [], directedQuestions: [] }]);
    return id;
  };

  const startCustomPrompt = (text: string) => {
    const id = `custom-${Date.now()}`;
    const prompt = { id: `${id}-prompt`, title: "A question from you", description: "A question you chose together.", themeId: "custom", text, kind: "custom" as const };
    setSessions((current) => [...current, { id, prompt, status: "awaiting_responses", responses: couple.members.map((member) => responseFor(member.id, "", false)), followUps: initialSessions[0]?.followUps.slice(0, 2).map((item) => ({ ...item, responses: [] })) ?? [], directedQuestions: [] }]);
    return id;
  };

  // TODO(product): Decide whether prototype state should survive a page refresh.
  useEffect(() => {}, []);

  const value = useMemo(() => ({ couple, sessions, themes, viewerId, firstVisit, setFirstVisit, setViewerId, setCoupleActive, setSessionState, setFollowUpState, submitResponse, submitFollowUp, addDirectedQuestion, answerDirectedQuestion, startPrompt, startCustomPrompt }), [couple, sessions, viewerId, firstVisit]);
  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>;
}

export function useCouplePrototype() {
  const value = useContext(PrototypeContext);
  if (!value) throw new Error("useCouplePrototype must be used inside CouplePrototypeProvider");
  return value;
}