import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { runQuoteRecovery } from "@/lib/quotes/recovery";

const recoveryRequestSchema = z.object({
  send: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(25),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = recoveryRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid recovery request" }, { status: 400 });
  }

  const result = await runQuoteRecovery(parsed.data);
  return NextResponse.json(result);
}
