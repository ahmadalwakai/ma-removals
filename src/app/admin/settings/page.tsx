import Link from "next/link";
import { colors, shadows } from "@/lib/tokens";

export default function AdminSettingsPage() {
  const cards = [
    {
      title: "Drivers",
      href: "/admin/settings/drivers",
      description: "Add driver accounts and set the email/password they use for the driver portal.",
      action: "Manage drivers",
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 800, color: colors.ink, margin: "0 0 6px" }}>
          Platform Settings
        </h2>
        <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>
          Manage operational settings for the admin and driver apps.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            style={{
              display: "block",
              background: "white",
              borderRadius: 12,
              border: "1px solid #E2E8F0",
              padding: 22,
              boxShadow: shadows.card,
              textDecoration: "none",
            }}
          >
            <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 800, color: colors.ink, margin: "0 0 8px" }}>
              {card.title}
            </h3>
            <p style={{ fontSize: 13, color: colors.muted, lineHeight: 1.55, margin: "0 0 18px" }}>
              {card.description}
            </p>
            <span style={{ color: colors.emerald, fontSize: 13, fontWeight: 800 }}>
              {card.action}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
