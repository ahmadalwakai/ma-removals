import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { colors, shadows } from "@/lib/tokens";
import { BookingDetailActions } from "@/components/admin/bookings/BookingDetailActions";
import { AdminChatPanel } from "@/components/admin/bookings/AdminChatPanel";
import { AdminStatusControls } from "@/components/admin/bookings/AdminStatusControls";
import { EditBookingToggle } from "@/components/admin/bookings/EditBookingToggle";

export const dynamic = "force-dynamic";

const STATUS_FLOW = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"];

function badge(status: string, bg: string, color: string) {
  return <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600, background: bg, color }}>{status.replace(/_/g," ")}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", borderRadius: 12, border: "1px solid #E2E8F0", padding: "20px 24px", marginBottom: 16, boxShadow: shadows.card }}>
      <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 14, fontWeight: 700, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid #F8FAFC" }}>
      <span style={{ fontSize: 13, color: colors.muted, minWidth: 140 }}>{label}</span>
      <span style={{ fontSize: 13, color: colors.ink, fontWeight: 500, textAlign: "right", flex: 1 }}>{value ?? "—"}</span>
    </div>
  );
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      customer: true,
      driver: { include: { user: true } },
      bookingItems: { include: { item: { include: { category: true } } } },
      payments: true,
      reviews: true,
      conversations: { select: { id: true }, take: 1 },
    },
  });

  if (!booking) notFound();

  const drivers = await db.driverProfile.findMany({
    where: { isActive: true },
    include: { user: { select: { id: true, name: true } } },
  });

  const statusIndex = STATUS_FLOW.indexOf(booking.status);

  const serialised = {
    ...booking,
    scheduledDate: booking.scheduledDate.toISOString(),
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    customer: booking.customer,
    driver: booking.driver
      ? { ...booking.driver, user: booking.driver.user }
      : null,
    payments: booking.payments.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    bookingItems: booking.bookingItems.map((bi) => ({
      ...bi,
      createdAt: bi.createdAt.toISOString(),
      item: {
        ...bi.item,
        createdAt: bi.item.createdAt.toISOString(),
        updatedAt: bi.item.updatedAt.toISOString(),
        category: {
          ...bi.item.category,
          createdAt: bi.item.category.createdAt.toISOString(),
          updatedAt: bi.item.category.updatedAt.toISOString(),
        },
      },
    })),
    reviews: booking.reviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  };

  const driverOptions = drivers.map((d) => ({ id: d.id, name: d.user.name ?? "Driver" }));

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Back + header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <Link href="/admin/bookings" style={{ fontSize: 13, color: colors.muted, textDecoration: "none" }}>← All Bookings</Link>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: colors.ink }}>{booking.reference}</span>
        {badge(booking.status,
          booking.status === "CONFIRMED" ? "rgba(37,99,235,0.12)" : booking.status === "CANCELLED" ? "rgba(239,68,68,0.12)" : "#F1F5F9",
            booking.status === "CONFIRMED" ? "#2563EB" : booking.status === "CANCELLED" ? "#EF4444" : "#64748B"
        )}
      </div>

      {/* Edit toggle */}
      <EditBookingToggle booking={{
        id: booking.id,
        serviceSlug: booking.serviceSlug,
        serviceName: booking.serviceName,
        serviceVariant: booking.serviceVariant,
        pickupAddress: booking.pickupAddress,
        pickupPostcode: booking.pickupPostcode,
        pickupLat: booking.pickupLat,
        pickupLng: booking.pickupLng,
        pickupFloor: booking.pickupFloor,
        pickupHasLift: booking.pickupHasLift,
        dropoffAddress: booking.dropoffAddress,
        dropoffPostcode: booking.dropoffPostcode,
        dropoffLat: booking.dropoffLat,
        dropoffLng: booking.dropoffLng,
        dropoffFloor: booking.dropoffFloor,
        dropoffHasLift: booking.dropoffHasLift,
        distanceMiles: booking.distanceMiles,
        scheduledDate: booking.scheduledDate.toISOString(),
        scheduledTime: booking.scheduledTime,
        helpersCount: booking.helpersCount,
        needsPacking: booking.needsPacking,
        needsAssembly: booking.needsAssembly,
        notes: booking.notes,
        quotedPrice: booking.quotedPrice,
        totalPaid: booking.totalPaid,
        customer: {
          name: booking.customer.name,
          email: booking.customer.email,
          phone: booking.customer.phone,
        },
      }} />

      {/* Status Timeline */}
      <Section title="Status Timeline">
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {STATUS_FLOW.map((s, i) => {
            const done = i <= statusIndex;
            const current = i === statusIndex;
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto" }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: done ? colors.emerald : "#E2E8F0",
                    border: current ? `2px solid ${colors.emerald}` : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, color: done ? "white" : colors.muted,
                    fontWeight: 700,
                  }}>
                    {done && !current ? "✓" : i + 1}
                  </div>
                  <div style={{ fontSize: 10, marginTop: 4, color: done ? colors.ink : colors.muted, fontWeight: current ? 700 : 400, whiteSpace: "nowrap" }}>
                    {s.replace("_"," ")}
                  </div>
                </div>
                {i < STATUS_FLOW.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: i < statusIndex ? colors.emerald : "#E2E8F0", margin: "0 4px", marginBottom: 18 }} />
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Customer */}
        <Section title="Customer">
          <Row label="Name" value={booking.customer.name} />
          <Row label="Email" value={<a href={`mailto:${booking.customer.email}`} style={{ color: colors.emerald }}>{booking.customer.email}</a>} />
          <Row label="Phone" value={booking.customer.phone} />
          <Row label="Customer since" value={new Date(booking.customer.createdAt).toLocaleDateString("en-GB")} />
        </Section>

        {/* Payment */}
        <Section title="Payment">
          <Row label="Total Paid" value={<span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>£{booking.totalPaid.toFixed(2)}</span>} />
          <Row label="Payment Status" value={booking.paymentStatus} />
          <Row label="Stripe ID" value={<span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{booking.stripePaymentId ?? "—"}</span>} />
          <Row label="Is Paid" value={booking.isPaid ? "Yes" : "No"} />
        </Section>

        {/* Service */}
        <Section title="Service Details">
          <Row label="Service" value={booking.serviceName} />
          <Row label="Variant" value={booking.serviceVariant} />
          <Row label="Helpers" value={booking.helpersCount} />
          <Row label="Packing" value={booking.needsPacking ? "Yes" : "No"} />
          <Row label="Assembly" value={booking.needsAssembly ? "Yes" : "No"} />
          <Row label="Notes" value={booking.notes} />
        </Section>

        {/* Schedule */}
        <Section title="Schedule">
          <Row label="Date" value={booking.scheduledDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
          <Row label="Time Slot" value={booking.scheduledTime} />
          <Row label="Distance" value={`${booking.distanceMiles.toFixed(1)} miles`} />
          <Row label="Booked On" value={new Date(booking.createdAt).toLocaleDateString("en-GB")} />
        </Section>
      </div>

      {/* Addresses */}
      <Section title="Addresses">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: colors.emerald, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Pickup</div>
            <div style={{ fontSize: 13, color: colors.ink }}>{booking.pickupAddress}</div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
              Floor {booking.pickupFloor} · {booking.pickupHasLift ? "Has lift" : "No lift"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Dropoff</div>
            <div style={{ fontSize: 13, color: colors.ink }}>{booking.dropoffAddress}</div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
              Floor {booking.dropoffFloor} · {booking.dropoffHasLift ? "Has lift" : "No lift"}
            </div>
          </div>
        </div>
      </Section>

      {/* Items */}
      {booking.bookingItems.length > 0 && (
        <Section title="Items">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {booking.bookingItems.map((bi) => (
              <span key={bi.id} style={{ padding: "4px 12px", background: "#F1F5F9", borderRadius: 20, fontSize: 13, color: colors.ink }}>
                {bi.item.name} × {bi.quantity}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Pricing */}
      <Section title="Pricing">
        <Row label="Base Price" value={`£${booking.basePrice.toFixed(2)}`} />
        <Row label="Quoted Price" value={`£${booking.quotedPrice.toFixed(2)}`} />
        <Row label="Total Paid" value={<span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>£{booking.totalPaid.toFixed(2)}</span>} />
        {booking.finalPrice && <Row label="Final Price" value={`£${booking.finalPrice.toFixed(2)}`} />}
      </Section>

      {/* Driver */}
      <Section title="Driver Assignment">
        {booking.driver ? (
          <Row label="Assigned Driver" value={booking.driver.user.name} />
        ) : (
          <div style={{ fontSize: 13, color: colors.muted, marginBottom: 12 }}>No driver assigned yet.</div>
        )}
      </Section>

      {/* Action Buttons */}
      <BookingDetailActions booking={serialised} drivers={driverOptions} />

      {/* Status Controls & Tracking */}
      <AdminStatusControls bookingId={booking.id} currentStatus={booking.status} />

      {/* Chat */}
      <AdminChatPanel
        bookingId={booking.id}
        conversationId={booking.conversations[0]?.id ?? null}
        currentUserId={session?.user?.id ?? ""}
      />
    </div>
  );
}
