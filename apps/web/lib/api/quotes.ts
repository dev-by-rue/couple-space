export type RelationshipQuote = {
  quote: string;
  author: string | null;
};

export async function fetchRelationshipQuote(
  categories = "relationships",
): Promise<RelationshipQuote> {
  const params = new URLSearchParams({ categories });
  const res = await fetch(`/api/relationship-quote?${params}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Quote ${res.status}: ${body}`);
  }
  return res.json() as Promise<RelationshipQuote>;
}
