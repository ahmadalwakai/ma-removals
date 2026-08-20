import { db } from "@/lib/db";

/** Called when booking is confirmed — creates Customer ↔ Admin conversation */
export async function createBookingConversation(bookingId: string, customerId: string) {
  const admins = await db.user.findMany({ where: { role: "ADMIN" } });

  const conversation = await db.conversation.create({
    data: {
      bookingId,
      title: "Booking Support",
      participants: {
        create: [
          { userId: customerId },
          ...admins.map((a) => ({ userId: a.id })),
        ],
      },
    },
  });
  return conversation;
}

/** Called when driver is assigned — adds them to existing conversation */
export async function addDriverToConversation(bookingId: string, driverUserId: string) {
  const conversation = await db.conversation.findFirst({
    where: { bookingId },
  });
  if (!conversation) return;

  const existing = await db.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId: conversation.id,
        userId: driverUserId,
      },
    },
  });

  if (!existing) {
    await db.conversationParticipant.create({
      data: { conversationId: conversation.id, userId: driverUserId },
    });
  }

  await db.message.create({
    data: {
      conversationId: conversation.id,
      senderId: null,
      senderRole: "SYSTEM",
      content: "A driver has been assigned to this booking.",
    },
  });
}
