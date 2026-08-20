import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Booking Confirmed | MA Removals",
  description: "Your MA Removals booking has been confirmed.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams?: Promise<{ reference?: string }>;
}) {
  const params = await searchParams;
  const reference = params?.reference?.trim() ?? "";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F8FAFC",
        color: "#0F172A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 12,
          boxShadow: "0 18px 45px rgba(15,23,42,0.10)",
          padding: "32px 28px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: "0 0 10px",
            color: "#10B981",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Booking confirmed
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: 32,
            lineHeight: 1.12,
            fontWeight: 900,
            letterSpacing: 0,
          }}
        >
          Thank you. Your move is booked.
        </h1>
        <p
          style={{
            margin: "14px 0 0",
            color: "#475569",
            fontSize: 15,
            lineHeight: 1.6,
          }}
        >
          A confirmation email is on its way. Keep your booking reference handy
          in case you need to contact the team.
        </p>

        {reference ? (
          <div
            style={{
              margin: "24px auto 0",
              padding: "14px 16px",
              borderRadius: 10,
              background: "#ECFDF5",
              border: "1px solid #A7F3D0",
            }}
          >
            <p
              style={{
                margin: "0 0 4px",
                color: "#047857",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Booking reference
            </p>
            <p
              style={{
                margin: 0,
                color: "#064E3B",
                fontFamily: "var(--font-mono)",
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              {reference}
            </p>
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginTop: 26,
          }}
        >
          <a
            href={`tel:${SITE.phone}`}
            style={{
              padding: "13px 14px",
              borderRadius: 10,
              background: "#0B1120",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            Call us
          </a>
          <a
            href={`https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(
              `Hi MA Removals, my booking reference is ${reference || "[reference]"}.`
            )}`}
            style={{
              padding: "13px 14px",
              borderRadius: 10,
              background: "#25D366",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            WhatsApp
          </a>
        </div>

        <Link
          href="/booking/track"
          style={{
            display: "inline-block",
            marginTop: 18,
            color: "#2563EB",
            fontSize: 14,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          Track your move
        </Link>
      </section>
    </main>
  );
}
