import { db } from "@/lib/db";
import { sendAdminPush } from "@/lib/fcm";

export async function notifyNewBooking(
  bookingRef: string,
  customerName: string,
  total: number,
  bookingId?: string,
) {
  const bookingPath = bookingId ? `/admin/bookings/${bookingId}` : "/admin/bookings";

  await db.adminNotification.create({
    data: {
      type: "new_booking",
      title: "New Booking Confirmed",
      body: `${customerName} just booked — ref ${bookingRef} · £${total.toFixed(2)}`,
      href: bookingPath,
      metadata: { bookingRef, bookingId: bookingId ?? null, customerName, total },
    },
  });

  // Best-effort push to the admin mobile app. Never blocks the
  // booking confirmation flow on FCM availability.
  void sendAdminPush({
    title: "New booking confirmed",
    body: `${customerName} · ref ${bookingRef} · £${total.toFixed(2)}`,
    deeplink: bookingPath,
    type: "new_booking",
    ref: bookingRef,
  }).catch(() => {});
}

export async function notifyManualReviewQuote(
  quoteRef: string,
  customerName: string,
  reasons: string[]
) {
  const reasonText = reasons.slice(0, 3).join(" · ");
  await db.adminNotification.create({
    data: {
      type: "manual_review_quote",
      title: "Quote needs manual review",
      body: `${customerName} submitted ${quoteRef}${reasonText ? ` — ${reasonText}` : ""}`,
      href: `/admin/quotes`,
      metadata: { quoteRef, customerName, reasons },
    },
  });

  void sendAdminPush({
    title: "Quote needs manual review",
    body: `${customerName} · ${quoteRef}`,
    deeplink: "/admin/quotes",
    type: "manual_review_quote",
    ref: quoteRef,
  }).catch(() => {});
}
