import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const bookingId = url.searchParams.get("bookingId");

  const where = bookingId
    ? {
        bookingId,
        participants: { some: { userId: session.user.id } },
      }
    : {
        participants: { some: { userId: session.user.id } },
      };

  const conversations = await db.conversation.findMany({
    where,
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, role: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { name: true, role: true } } },
      },
      booking: { select: { reference: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const myParticipation = await db.conversationParticipant.findMany({
    where: { userId: session.user.id },
    select: { conversationId: true, lastReadAt: true },
  });
  const readMap = new Map(myParticipation.map((p) => [p.conversationId, p.lastReadAt]));

  const result = await Promise.all(
    conversations.map(async (conv) => {
      const lastReadAt = readMap.get(conv.id);
      const unreadCount = await db.message.count({
        where: {
          conversationId: conv.id,
          senderId: { not: session.user!.id },
          createdAt: lastReadAt ? { gt: lastReadAt } : undefined,
        },
      });

      const lastMsg = conv.messages[0];
      return {
        id: conv.id,
        title: conv.title,
        bookingId: conv.bookingId,
        bookingRef: conv.booking.reference,
        lastMessage: lastMsg
          ? {
              content: lastMsg.content,
              senderRole: lastMsg.senderRole,
              senderName: lastMsg.sender?.name,
              createdAt: lastMsg.createdAt,
            }
          : null,
        unreadCount,
        participants: conv.participants.map((p) => ({
          userId: p.userId,
          name: p.user.name,
          role: p.user.role,
        })),
        updatedAt: conv.updatedAt,
      };
    })
  );

  return NextResponse.json({ conversations: result });
}
