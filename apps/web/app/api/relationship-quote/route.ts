import { NextResponse } from "next/server";

type NinjaQuote = {
  quote: string;
  author?: string;
  categories: string[];
};

const ALLOWED_CATEGORIES = new Set([
  "life",
  "relationships",
  "love",
  "happiness",
]);

const DEFAULT_CATEGORY = "relationships";

function parseCategories(raw: string | null): string {
  if (!raw) return DEFAULT_CATEGORY;

  const cleaned = raw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => ALLOWED_CATEGORIES.has(c));

  return cleaned.length > 0 ? cleaned.join(",") : DEFAULT_CATEGORY;
}

export async function GET(request: Request) {
  const baseUrl = process.env.NEXT_QUOTE_API_URL;
  const apiKey = process.env.NEXT_QUOTE_API_KEY;

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { error: "Quote API is not configured" },
      { status: 503 },
    );
  }

  const categories = parseCategories(
    new URL(request.url).searchParams.get("categories"),
  );


  const endpoint = new URL(baseUrl);
  endpoint.searchParams.set("categories", categories);

  const res = await fetch(endpoint, {
    headers: { "X-Api-Key": apiKey },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Quote upstream ${res.status}` },
      { status: 502 },
    );
  }

  const data = (await res.json()) as NinjaQuote[];
  const quote = data[0];

  console.log(quote)
  console.log(categories)
  console.log(data)
  if (!quote?.quote) {
    return NextResponse.json({ error: "No quote returned" }, { status: 502 });
  }

  return NextResponse.json({
    quote: quote.quote,
    author: quote.author ?? null,
  });
}
