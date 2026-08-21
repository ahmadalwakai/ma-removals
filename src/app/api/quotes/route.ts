import { type NextRequest, NextResponse } from "next/server";
import { createQuoteRequestSchema } from "@/lib/quotes/schemas";
import { createQuote, QuoteInputError } from "@/lib/quotes/service";

const QUOTE_CREATION_TIMEOUT_MS = 18_000;

class QuoteCreationTimeoutError extends Error {}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  promise.catch(() => undefined);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new QuoteCreationTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createQuoteRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid quote request", issues: parsed.error.issues.map((issue) => issue.message) },
        { status: 400 }
      );
    }

    const quote = await withTimeout(createQuote(parsed.data), QUOTE_CREATION_TIMEOUT_MS);
    return NextResponse.json({ quote }, { status: 202 });
  } catch (error) {
    if (error instanceof QuoteCreationTimeoutError) {
      return NextResponse.json(
        { error: "Quote is taking longer than expected. Please try again." },
        { status: 504 }
      );
    }
    if (error instanceof QuoteInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Quote creation failed:", error);
    return NextResponse.json({ error: "Unable to create quote" }, { status: 500 });
  }
}
