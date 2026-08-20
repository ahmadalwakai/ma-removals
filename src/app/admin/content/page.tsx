import { colors, shadows } from "@/lib/tokens";

export default function AdminContentPage() {
  return (
    <div>
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #E2E8F0", padding: 40, textAlign: "center", boxShadow: shadows.card }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✏️</div>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 700, color: colors.ink, marginBottom: 8 }}>
          Site Content Management
        </h2>
        <p style={{ fontSize: 14, color: colors.muted, maxWidth: 400, margin: "0 auto" }}>
          Edit homepage copy, service descriptions, testimonials, and area content. Coming in Phase 5.
        </p>
      </div>
    </div>
  );
}
