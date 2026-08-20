"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BookingEditor } from "@/components/admin/BookingEditor";
import { colors } from "@/lib/tokens";

interface BookingForEditor {
  id: string;
  serviceSlug: string;
  serviceName: string;
  serviceVariant: string | null;
  pickupAddress: string;
  pickupPostcode: string;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupFloor: number;
  pickupHasLift: boolean;
  dropoffAddress: string;
  dropoffPostcode: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  dropoffFloor: number;
  dropoffHasLift: boolean;
  distanceMiles: number;
  scheduledDate: string;
  scheduledTime: string;
  helpersCount: number;
  needsPacking: boolean;
  needsAssembly: boolean;
  notes: string | null;
  quotedPrice: number;
  totalPaid: number;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
}

interface EditBookingToggleProps {
  booking: BookingForEditor;
}

export function EditBookingToggle({ booking }: EditBookingToggleProps) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  const handleSave = useCallback(() => {
    setEditing(false);
    router.refresh();
  }, [router]);

  const handleCancel = useCallback(() => {
    setEditing(false);
  }, []);

  if (editing) {
    return (
      <BookingEditor
        booking={booking}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 18px",
        borderRadius: 8,
        background: "transparent",
        border: `1px solid ${colors.emerald}`,
        color: colors.emerald,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        marginTop: 8,
        marginBottom: 8,
      }}
    >
      ✏️ Edit Booking
    </button>
  );
}
