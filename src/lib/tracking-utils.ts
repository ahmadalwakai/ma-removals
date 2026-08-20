import { db } from "@/lib/db";
import { triggerEvent } from "@/lib/pusher-server";

export interface TrackingEventPayload {
  bookingId: string;
  type: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  isPublic?: boolean;
}

/**
 * Create a TrackingEvent record and broadcast it via Pusher.
 * Never throws — safe to call fire-and-forget.
 */
export async function createTrackingEvent(data: TrackingEventPayload) {
  const event = await db.trackingEvent.create({
    data: {
      bookingId: data.bookingId,
      type: data.type,
      title: data.title,
      description: data.description ?? null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      isPublic: data.isPublic ?? true,
    },
  });

  triggerEvent(`booking-${data.bookingId}`, "tracking-event", {
    id: event.id,
    type: event.type,
    title: event.title,
    description: event.description,
    metadata: data.metadata ?? null,
    isPublic: event.isPublic,
    timestamp: event.timestamp.toISOString(),
  });

  return event;
}

/**
 * Record a status transition in BookingStatusHistory and broadcast via Pusher.
 */
export async function recordStatusChange(params: {
  bookingId: string;
  fromStatus?: string;
  toStatus: string;
  changedBy?: string;
  changedByRole?: string;
  note?: string;
}) {
  const history = await db.bookingStatusHistory.create({
    data: {
      bookingId: params.bookingId,
      fromStatus: params.fromStatus ?? null,
      toStatus: params.toStatus,
      changedBy: params.changedBy ?? null,
      changedByRole: params.changedByRole ?? null,
      note: params.note ?? null,
    },
  });

  triggerEvent(`booking-${params.bookingId}`, "status-update", {
    status: params.toStatus,
    timestamp: history.timestamp.toISOString(),
  });

  return history;
}

/** Human-readable event titles for each status transition */
export const STATUS_EVENT_TITLES: Record<string, string> = {
  PENDING: "Booking received — awaiting confirmation",
  CONFIRMED: "Booking confirmed",
  IN_PROGRESS: "Move is underway",
  COMPLETED: "Move completed",
  CANCELLED: "Booking cancelled",
  REFUNDED: "Booking refunded",
};
