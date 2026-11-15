export type AnsweredSessionInput = {
  memberIds: string[];
  sessions: Array<{
    id: string;
    submittedUserIds: string[];
  }>;
};

/**
 * Finds the session in which the couple answered a prompt, if they have.
 *
 * @remarks
 * A prompt is answered once **every** member has submitted in one of
 * the couple's main sessions on it, whether or not they've revealed. An
 * answered prompt is never offered or started again; the web opens this
 * session instead.
 *
 * @param input - The couple's members and their main sessions on the prompt
 * @returns The first answered session's id, or `null` if none is answered
 */
export function answeredSessionId(input: AnsweredSessionInput): string | null {
  if (input.memberIds.length === 0) return null;
  const answered = input.sessions.find((session) =>
    input.memberIds.every((id) => session.submittedUserIds.includes(id)),
  );
  return answered?.id ?? null;
}
