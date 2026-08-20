import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { triggerEvent } from "@/lib/pusher-server";
import { sendEmail } from "@/lib/email-sender";
import { newMessageHtml } from "@/lib/emails/templates";
import type { MessageSenderRole } from "@prisma/client";

async function assertParticipant(conversationId: string, userId: string) {
  const p = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  return !!p;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const isParticipant = await assertParticipant(id, session.user.id);
  if (!isParticipant)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

  const messages = await db.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  const hasMore = messages.length > limit;
  const page = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? page[page.length - 1]?.id : null;

  return NextResponse.json({ messages: page, nextCursor });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const isParticipant = await assertParticipant(id, session.user.id);
  if (!isParticipant)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { content: string };
  if (!body.content?.trim())
    return NextResponse.json({ error: "Content required" }, { status: 400 });

  const content = body.content.slice(0, 1000);
  const senderRole = (session.user.role ?? "CUSTOMER") as MessageSenderRole;

  const [message] = await db.$transaction([
    db.message.create({
      data: {
        conversationId: id,
        senderId: session.user.id,
        senderRole,
        content,
      },
      include: { sender: { select: { id: true, name: true, role: true } } },
    }),
    db.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    }),
  ]);

  // Real-time push
  triggerEvent(`conversation-${id}`, "new-message", message);

  // Email offline participants (not active in last 5 min)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const participants = await db.conversationParticipant.findMany({
    where: {
      conversationId: id,
      userId: { not: session.user.id },
    },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  const conv = await db.conversation.findUnique({
    where: { id },
    include: { booking: { select: { reference: true } } },
  });

  for (const p of participants) {
    const isOffline = !p.lastReadAt || p.lastReadAt < fiveMinAgo;
    if (isOffline && p.user.email) {
      await sendEmail({
        to: p.user.email,
        subject: `New message about your booking ${conv?.booking.reference ?? ""}`,
        html: newMessageHtml({
          recipientName: p.user.name ?? "there",
          senderName: session.user.name ?? "Someone",
          reference: conv?.booking.reference ?? "",
          messagePreview: content.slice(0, 100),
        }),
      });
    }
  }

  return NextResponse.json({ message });
}
