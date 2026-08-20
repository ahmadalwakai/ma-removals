import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    bookingId: string;
    participantIds: string[];
  };

  if (!body.bookingId)
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  // Include the creator if not already in list
  const allIds = Array.from(new Set([session.user.id, ...(body.participantIds ?? [])]));

  // Check if conversation already exists for these participants
  const existing = await db.conversation.findFirst({
    where: {
      bookingId: body.bookingId,
      participants: { some: { userId: session.user.id } },
    },
    include: { participants: true },
  });

  if (existing) {
    return NextResponse.json({ conversation: existing });
  }

  const conversation = await db.conversation.create({
    data: {
      bookingId: body.bookingId,
      title: "Booking Support",
      participants: {
        create: allIds.map((uid) => ({ userId: uid })),
      },
    },
    include: { participants: true },
  });

  return NextResponse.json({ conversation });
}
