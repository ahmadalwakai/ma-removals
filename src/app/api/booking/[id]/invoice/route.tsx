import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// Dynamic import for react-pdf to avoid SSR issues
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COMPANY_DETAILS = {
  name: "MA REMOVALS LTD",
  number: "Company number SC763776",
  phone: "07426467112",
  email: "info@maremovals.co.uk",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // id can be booking DB id or reference
  const booking = await db.booking.findFirst({
    where: { OR: [{ id }, { reference: id }] },
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      driver: { include: { user: { select: { name: true } } } },
    },
  });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Auth check: must be customer, driver, or admin
  const url = new URL(req.url);
  const emailParam = url.searchParams.get("email")?.toLowerCase().trim();

  const session = await auth();
  const isAuthed =
    session?.user?.role === "ADMIN" ||
    session?.user?.role === "DRIVER" ||
    session?.user?.id === booking.customerId;
  const emailMatch =
    emailParam && booking.customer.email?.toLowerCase() === emailParam;

  if (!isAuthed && !emailMatch) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate PDF using @react-pdf/renderer
  const { renderToBuffer, Document, Page, Text, View, Image, StyleSheet } =
    await import("@react-pdf/renderer");
  const logoBuffer = await readFile(
    join(process.cwd(), "public", "images", "logo.png")
  );
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  const styles = StyleSheet.create({
    page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#334155" },
    header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
    logo: { width: 64, height: 64 },
    brandName: { fontSize: 14, fontWeight: "bold", color: "#0B1120" },
    companyLine: { fontSize: 9.5, color: "#475569", marginTop: 2 },
    companyContact: { fontSize: 9.5, color: "#2563EB", marginTop: 2 },
    invLabel: { fontSize: 22, fontWeight: "bold", color: "#0B1120", textAlign: "right" },
    invRef: { fontSize: 11, color: "#64748B", textAlign: "right", marginTop: 2 },
    divider: { borderBottom: "1pt solid #E2E8F0", marginVertical: 12 },
    section: { marginBottom: 16 },
    sectionTitle: { fontSize: 9, fontWeight: "bold", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
    row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
    label: { color: "#64748B" },
    value: { fontWeight: "bold", color: "#0B1120" },
    totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, marginTop: 4 },
    totalLabel: { fontSize: 13, fontWeight: "bold", color: "#0B1120" },
    totalValue: { fontSize: 13, fontWeight: "bold", color: "#2563EB" },
    footer: { marginTop: 32, paddingTop: 12, borderTop: "1pt solid #E2E8F0", fontSize: 9, color: "#94A3B8", textAlign: "center" },
    policyText: { fontSize: 9, color: "#64748B", lineHeight: 1.4, marginTop: 4 },
  });

  const schedDate = booking.scheduledDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const pdf = await renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Image style={styles.logo} src={logoSrc} />
            <View>
              <Text style={styles.brandName}>{COMPANY_DETAILS.name}</Text>
              <Text style={styles.companyLine}>{COMPANY_DETAILS.number}</Text>
              <Text style={styles.companyContact}>{COMPANY_DETAILS.phone}</Text>
              <Text style={styles.companyContact}>{COMPANY_DETAILS.email}</Text>
            </View>
          </View>
          <View>
            <Text style={styles.invLabel}>INVOICE</Text>
            <Text style={styles.invRef}>INV-{booking.reference.replace("MAR-", "")}</Text>
            <Text style={styles.invRef}>Date: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill To */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={{ color: "#0B1120", fontWeight: "bold" }}>{booking.customer.name ?? "Customer"}</Text>
          <Text style={{ marginTop: 2 }}>{booking.customer.email}</Text>
          {booking.customer.phone && <Text style={{ marginTop: 2 }}>{booking.customer.phone}</Text>}
        </View>

        <View style={styles.divider} />

        {/* Service Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Details</Text>
          <Text style={{ color: "#0B1120", fontWeight: "bold" }}>
            {booking.serviceName}{booking.serviceVariant ? ` (${booking.serviceVariant})` : ""}
          </Text>
          <Text style={{ marginTop: 4 }}>
            {booking.pickupAddress} → {booking.dropoffAddress}
          </Text>
          <Text style={{ marginTop: 2, color: "#64748B" }}>
            {schedDate} · {booking.scheduledTime}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Breakdown</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Base Price ({booking.serviceName})</Text>
            <Text style={styles.value}>£{booking.basePrice.toFixed(2)}</Text>
          </View>
          {booking.distanceMiles > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Distance ({booking.distanceMiles.toFixed(1)} miles)</Text>
              <Text style={styles.value}>included</Text>
            </View>
          )}
          {booking.helpersCount > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>{booking.helpersCount} Helper{booking.helpersCount > 1 ? "s" : ""}</Text>
              <Text style={styles.value}>included</Text>
            </View>
          )}
          {booking.needsPacking && (
            <View style={styles.row}>
              <Text style={styles.label}>Packing Service</Text>
              <Text style={styles.value}>included</Text>
            </View>
          )}
          {booking.needsAssembly && (
            <View style={styles.row}>
              <Text style={styles.label}>Assembly Service</Text>
              <Text style={styles.value}>included</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL PAID</Text>
          <Text style={styles.totalValue}>£{booking.totalPaid.toFixed(2)}</Text>
        </View>
        <View style={{ flexDirection: "row", marginTop: 4 }}>
          <Text style={{ color: "#64748B", fontSize: 9 }}>
            Payment Status: {booking.paymentStatus}
            {booking.stripePaymentId ? `  ·  Ref: ${booking.stripePaymentId.slice(0, 16)}...` : ""}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Insurance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insurance</Text>
          <Text style={styles.policyText}>
            All moves are covered by Goods in Transit Insurance for your peace of mind.
          </Text>
        </View>

        {/* Cancellation Policy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cancellation Policy</Text>
          <Text style={styles.policyText}>
            Free cancellation 48h+ before move · 50% refund 24–48h before move · No refund within 24h of move
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>{COMPANY_DETAILS.name} · {COMPANY_DETAILS.number}</Text>
          <Text>{COMPANY_DETAILS.email} · {COMPANY_DETAILS.phone} · www.maremovals.co.uk</Text>
        </View>
      </Page>
    </Document>
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${booking.reference}.pdf"`,
    },
  });
}
