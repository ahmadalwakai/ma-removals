import { NextResponse } from "next/server";
import { quoteReferenceSchema } from "@/lib/quotes/schemas";
import { getQuoteForCustomer } from "@/lib/quotes/service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;
  const parsed = quoteReferenceSchema.safeParse(reference);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid quote reference" }, { status: 400 });
  }

  const quote = await getQuoteForCustomer(parsed.data);
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  return NextResponse.json({ quote });
}
