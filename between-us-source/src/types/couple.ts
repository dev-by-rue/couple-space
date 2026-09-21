export type Member = {
  id: string;
  email: string;
  emailVerified: boolean;
  inviteAccepted: boolean;
};

export type Couple = {
  id: string;
  members: Member[];
};

export type Prompt = {
  id: string;
  title: string;
  description: string;
  themeId: string;
  text: string;
  kind: "curated" | "custom";
};

export type Theme = {
  id: string;
  title: string;
  description: string;
  symbol: string;
  prompts: Prompt[];
};

export type Response = {
  memberId: string;
  text: string;
  submitted: boolean;
};

export type ConversationStatus = "awaiting_responses" | "revealed" | "in_discussion";
export type PrototypeConversationState = "A" | "B" | "C" | "D";

export type FollowUp = {
  id: string;
  question: string;
  responses: Response[];
};

export type DirectedQuestion = {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  question: string;
  answer?: string;
};

export type Session = {
  id: string;
  prompt: Prompt;
  status: ConversationStatus;
  responses: Response[];
  followUps: FollowUp[];
  directedQuestions: DirectedQuestion[];
};

export interface CoupleDataSource {
  getCouple(): Couple;
  getThemes(): Theme[];
  getSessions(): Session[];
}

export function memberName(member: Member) {
  const localPart = member.email.split("@")[0] ?? "Partner";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}