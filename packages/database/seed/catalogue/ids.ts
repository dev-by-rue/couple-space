import { createHash } from "node:crypto";

/**
 * Namespace for every catalogue id. Changing it changes every id, so never edit it.
 */
const NAMESPACE = "bd363184-b8e8-44c6-a8aa-bc9107f19cfc";

/**
 * Builds a name-based UUID (RFC 9562 version 5).
 *
 * @remarks
 * The same name and namespace always give the same id, which is what keeps
 * catalogue ids stable across deploys without storing them by hand.
 *
 * @param name - The text the id is derived from.
 * @param namespace - A UUID that scopes the name.
 * @returns The UUID string.
 */
export function uuidv5(name: string, namespace: string): string {
  const hash = createHash("sha1")
    .update(Buffer.from(namespace.replaceAll("-", ""), "hex"))
    .update(name, "utf8")
    .digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Id for a theme.
 *
 * @remarks The prefix keeps theme, prompt and tag ids apart even if a slug and a key match.
 * @returns The theme's UUID.
 */
export const themeId = (slug: string) => uuidv5(`theme:${slug}`, NAMESPACE);

/**
 * Id for a curated prompt.
 *
 * @returns The prompt's UUID.
 */
export const promptId = (key: string) => uuidv5(`prompt:${key}`, NAMESPACE);

/**
 * Id for a follow-up.
 *
 * @remarks Position-based within its question, so follow-ups are append-only.
 * @param key - The parent question's key.
 * @param position - 1-based position in `followUps`.
 * @returns The follow-up's UUID.
 */
export const followUpId = (key: string, position: number) =>
  uuidv5(`prompt:${key}/${position}`, NAMESPACE);

/**
 * Id for a tag.
 *
 * @returns The tag's UUID.
 */
export const tagId = (slug: string) => uuidv5(`tag:${slug}`, NAMESPACE);
