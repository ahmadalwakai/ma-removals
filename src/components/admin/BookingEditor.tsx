"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AddressAutocomplete } from "@/components/booking/AddressAutocomplete";
import type { AddressData } from "@/types/booking";
import { SERVICE_LABELS, TIME_SLOTS } from "@/types/booking";

// ─── Service variants (mirrors ServiceStep.tsx) ────────────────────────────
const HOUSE_VARIANTS = ["Studio", "1 Bed", "2 Bed", "3 Bed", "4 Bed", "5+ Bed"];
const BUSINESS_VARIANTS = ["Small Office", "Medium Office", "Large Office", "Retail Shop", "Restaurant/Café", "Warehouse"];

function getVariants(slug: string): string[] | null {
  if (slug === "house-move") return HOUSE_VARIANTS;
  if (slug === "business-removals" || slug === "office-removals") return BUSINESS_VARIANTS;
  return null;
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface RecalcResult {
  newPrice: number;
  originalPrice: number;
  totalPaid: number;
  breakdown: {
    basePrice: number;
    distanceSurcharge: number;
    floorSurcharge: number;
    helpersSurcharge: number;
    packingSurcharge: number;
    assemblySurcharge: number;
    staticSubtotal: number;
    urgencyMultiplier: number;
    calendarMultiplier: number;
  };
}

interface BookingEditorProps {
  booking: {
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
    scheduledDate: string; // ISO string
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
  };
  onSave: () => void;
  onCancel: () => void;
}

// ─── Shared input style ─────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0F172A",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#F1F5F9",
  fontSize: 13,
  padding: "8px 12px",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#94A3B8",
  marginBottom: 4,
  display: "block",
};

const sectionHeadStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#2563EB",
  textTransform: "uppercase" as const,
  letterSpacing: "0.07em",
  marginBottom: 12,
  marginTop: 20,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 22, borderRadius: 11,
          background: checked ? "#2563EB" : "#334155",
          border: "none", cursor: "pointer",
          position: "relative", transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute", top: 3, left: checked ? 20 : 4,
          width: 16, height: 16, borderRadius: "50%",
          background: "white", transition: "left 0.2s",
        }} />
      </button>
      <span style={{ fontSize: 13, color: "#CBD5E1" }}>{label}</span>
    </div>
  );
}

function Counter({ value, onChange, min = 0, max = 10 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        style={{ width: 32, height: 32, borderRadius: 8, background: "#1E293B", border: "1px solid #334155", color: "#F1F5F9", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
      >−</button>
      <span style={{ fontSize: 15, fontWeight: 600, color: "#F1F5F9", minWidth: 24, textAlign: "center" }}>{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        style={{ width: 32, height: 32, borderRadius: 8, background: "#1E293B", border: "1px solid #334155", color: "#F1F5F9", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
      >+</button>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export function BookingEditor({ booking, onSave, onCancel }: BookingEditorProps) {
  // Service
  const [serviceSlug, setServiceSlug] = useState(booking.serviceSlug);
  const [serviceVariant, setServiceVariant] = useState(booking.serviceVariant ?? "");

  // Addresses
  const [pickupAddress, setPickupAddress] = useState<AddressData | null>({
    fullAddress: booking.pickupAddress,
    postcode: booking.pickupPostcode,
    lat: booking.pickupLat ?? 0,
    lng: booking.pickupLng ?? 0,
    city: "",
  });
  const [pickupFloor, setPickupFloor] = useState(booking.pickupFloor);
  const [pickupHasLift, setPickupHasLift] = useState(booking.pickupHasLift);
  const [dropoffAddress, setDropoffAddress] = useState<AddressData | null>({
    fullAddress: booking.dropoffAddress,
    postcode: booking.dropoffPostcode,
    lat: booking.dropoffLat ?? 0,
    lng: booking.dropoffLng ?? 0,
    city: "",
  });
  const [dropoffFloor, setDropoffFloor] = useState(booking.dropoffFloor);
  const [dropoffHasLift, setDropoffHasLift] = useState(booking.dropoffHasLift);

  // Schedule
  const scheduledDateObj = new Date(booking.scheduledDate);
  const toDateInput = (d: Date) => d.toISOString().slice(0, 10);
  const [scheduledDate, setScheduledDate] = useState(toDateInput(scheduledDateObj));
  const [scheduledTime, setScheduledTime] = useState(booking.scheduledTime);

  // Options
  const [helpersCount, setHelpersCount] = useState(booking.helpersCount);
  const [needsPacking, setNeedsPacking] = useState(booking.needsPacking);
  const [needsAssembly, setNeedsAssembly] = useState(booking.needsAssembly);

  // Customer info
  const [customerName, setCustomerName] = useState(booking.customer.name ?? "");
  const [customerEmail, setCustomerEmail] = useState(booking.customer.email ?? "");
  const [customerPhone, setCustomerPhone] = useState(booking.customer.phone ?? "");

  // Notes
  const [notes, setNotes] = useState(booking.notes ?? "");

  // Price recalculation
  const [recalcResult, setRecalcResult] = useState<RecalcResult | null>(null);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [priceAction, setPriceAction] = useState<"keep" | "update" | "custom">("keep");
  const [customPrice, setCustomPrice] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ─── Price-affecting fields for recalculation ────────────────────────────
  const recalculate = useCallback(async () => {
    if (!pickupAddress || !dropoffAddress) return;

    setRecalcLoading(true);
    try {
      // Calculate distance if addresses changed
      const pickupLat = pickupAddress.lat;
      const pickupLng = pickupAddress.lng;
      const dropoffLat = dropoffAddress.lat;
      const dropoffLng = dropoffAddress.lng;

      let distanceMiles = booking.distanceMiles;
      if (
        Math.abs(pickupLat - (booking.pickupLat ?? 0)) > 0.0001 ||
        Math.abs(pickupLng - (booking.pickupLng ?? 0)) > 0.0001 ||
        Math.abs(dropoffLat - (booking.dropoffLat ?? 0)) > 0.0001 ||
        Math.abs(dropoffLng - (booking.dropoffLng ?? 0)) > 0.0001
      ) {
        const R = 3958.8;
        const dLat = ((dropoffLat - pickupLat) * Math.PI) / 180;
        const dLon = ((dropoffLng - pickupLng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((pickupLat * Math.PI) / 180) * Math.cos((dropoffLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
        distanceMiles = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
      }

      const res = await fetch(`/api/admin/bookings/${booking.id}/recalculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceSlug,
          serviceVariant: serviceVariant || null,
          distanceMiles,
          pickupFloor,
          pickupHasLift,
          dropoffFloor,
          dropoffHasLift,
          helpersCount,
          needsPacking,
          needsAssembly,
          scheduledDate,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as RecalcResult;
        setRecalcResult(data);
        setPriceAction("keep");
      }
    } catch {
      // Silently fail — don't disrupt edit flow
    } finally {
      setRecalcLoading(false);
    }
  }, [
    booking.id, booking.distanceMiles, booking.pickupLat, booking.pickupLng,
    booking.dropoffLat, booking.dropoffLng,
    serviceSlug, serviceVariant, pickupAddress, dropoffAddress,
    pickupFloor, pickupHasLift, dropoffFloor, dropoffHasLift,
    helpersCount, needsPacking, needsAssembly, scheduledDate,
  ]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void recalculate(); }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [recalculate]);

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    const pickupLat = pickupAddress?.lat;
    const pickupLng = pickupAddress?.lng;
    const dropoffLat = dropoffAddress?.lat;
    const dropoffLng = dropoffAddress?.lng;

    let distanceMiles = booking.distanceMiles;
    if (pickupLat && pickupLng && dropoffLat && dropoffLng) {
      const R = 3958.8;
      const dLat = ((dropoffLat - pickupLat) * Math.PI) / 180;
      const dLon = ((dropoffLng - pickupLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((pickupLat * Math.PI) / 180) * Math.cos((dropoffLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      distanceMiles = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
    }

    const payload = {
      serviceSlug,
      serviceName: SERVICE_LABELS[serviceSlug] ?? serviceSlug,
      serviceVariant: serviceVariant || null,
      pickupAddress: pickupAddress?.fullAddress ?? booking.pickupAddress,
      pickupPostcode: pickupAddress?.postcode ?? booking.pickupPostcode,
      pickupLat: pickupAddress?.lat ?? booking.pickupLat,
      pickupLng: pickupAddress?.lng ?? booking.pickupLng,
      pickupFloor,
      pickupHasLift,
      dropoffAddress: dropoffAddress?.fullAddress ?? booking.dropoffAddress,
      dropoffPostcode: dropoffAddress?.postcode ?? booking.dropoffPostcode,
      dropoffLat: dropoffAddress?.lat ?? booking.dropoffLat,
      dropoffLng: dropoffAddress?.lng ?? booking.dropoffLng,
      dropoffFloor,
      dropoffHasLift,
      distanceMiles,
      scheduledDate,
      scheduledTime,
      helpersCount,
      needsPacking,
      needsAssembly,
      notes: notes || null,
      customerName,
      customerEmail,
      customerPhone: customerPhone || null,
      priceAction,
      newPrice: recalcResult?.newPrice,
      customPrice: customPrice ? parseFloat(customPrice) : undefined,
    };

    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; refundError?: string };
      if (!res.ok) {
        setSaveError(data.error ?? "Save failed");
      } else {
        if (data.refundError) {
          setSaveError(`Saved, but: ${data.refundError}`);
          // Still call onSave to reload the page
        }
        onSave();
      }
    } catch {
      setSaveError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  // ─── Price diff ───────────────────────────────────────────────────────────
  const priceChanged = recalcResult && recalcResult.newPrice !== recalcResult.originalPrice;
  const priceDiff = recalcResult ? recalcResult.newPrice - recalcResult.originalPrice : 0;

  const variants = getVariants(serviceSlug);

  return (
    <div style={{
      background: "#1E293B",
      borderRadius: 12,
      border: "1px solid #334155",
      padding: "24px 28px",
      marginTop: 16,
      color: "#F1F5F9",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", margin: 0 }}>Edit Booking</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: "8px 16px", borderRadius: 8, background: "transparent", border: "1px solid #475569", color: "#94A3B8", fontSize: 13, cursor: "pointer" }}
          >
            Discard Changes
          </button>
          <button
            type="button"
            onClick={() => { void handleSave(); }}
            disabled={saving}
            style={{ padding: "8px 20px", borderRadius: 8, background: saving ? "#1E293B" : "#2563EB", border: "none", color: saving ? "#64748B" : "white", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {saveError && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#FCA5A5", marginBottom: 16 }}>
          {saveError}
        </div>
      )}

      {/* ── Section 1: Service Details ───────────────────────────────────── */}
      <p style={sectionHeadStyle}>1 · Service Details</p>
      <div style={{ display: "grid", gridTemplateColumns: variants ? "1fr 1fr" : "1fr", gap: 12 }}>
        <Field label="Service Type">
          <select
            value={serviceSlug}
            onChange={(e) => {
              setServiceSlug(e.target.value);
              setServiceVariant("");
            }}
            style={{ ...inputStyle }}
          >
            {Object.entries(SERVICE_LABELS).map(([slug, label]) => (
              <option key={slug} value={slug}>{label}</option>
            ))}
          </select>
        </Field>
        {variants && (
          <Field label="Variant">
            <select
              value={serviceVariant}
              onChange={(e) => setServiceVariant(e.target.value)}
              style={{ ...inputStyle }}
            >
              <option value="">— Select variant —</option>
              {variants.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {/* ── Section 2: Addresses ─────────────────────────────────────────── */}
      <p style={sectionHeadStyle}>2 · Addresses</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <Field label="Pickup Address">
            <div style={{ position: "relative" }}>
              <AddressAutocomplete
                value={pickupAddress}
                onChange={setPickupAddress}
                placeholder="Pickup address…"
              />
            </div>
          </Field>
          <Field label="Pickup Floor">
            <Counter value={pickupFloor} onChange={setPickupFloor} max={20} />
          </Field>
          <Toggle label="Has lift at pickup" checked={pickupHasLift} onChange={setPickupHasLift} />
        </div>
        <div>
          <Field label="Dropoff Address">
            <AddressAutocomplete
              value={dropoffAddress}
              onChange={setDropoffAddress}
              placeholder="Dropoff address…"
            />
          </Field>
          <Field label="Dropoff Floor">
            <Counter value={dropoffFloor} onChange={setDropoffFloor} max={20} />
          </Field>
          <Toggle label="Has lift at dropoff" checked={dropoffHasLift} onChange={setDropoffHasLift} />
        </div>
      </div>

      {/* ── Section 3: Schedule ──────────────────────────────────────────── */}
      <p style={sectionHeadStyle}>3 · Schedule</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Date">
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            style={{ ...inputStyle, colorScheme: "dark" } as React.CSSProperties}
          />
        </Field>
        <Field label="Time Slot">
          <select
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            style={{ ...inputStyle }}
          >
            {TIME_SLOTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* ── Section 4: Options ───────────────────────────────────────────── */}
      <p style={sectionHeadStyle}>4 · Options</p>
      <Field label="Number of Helpers">
        <Counter value={helpersCount} onChange={setHelpersCount} max={6} />
      </Field>
      <Toggle label="Needs Packing Service" checked={needsPacking} onChange={setNeedsPacking} />
      <Toggle label="Needs Assembly / Disassembly" checked={needsAssembly} onChange={setNeedsAssembly} />

      {/* ── Section 5: Customer Info ─────────────────────────────────────── */}
      <p style={sectionHeadStyle}>5 · Customer Info</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="Name">
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Email">
          <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Phone">
          <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={inputStyle} />
        </Field>
      </div>

      {/* ── Section 6: Notes ─────────────────────────────────────────────── */}
      <p style={sectionHeadStyle}>6 · Admin Notes</p>
      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Field>

      {/* ── Price Recalculation Panel ────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid #334155", marginTop: 20, paddingTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#F1F5F9" }}>Price</span>
          {recalcLoading && (
            <span style={{ fontSize: 12, color: "#94A3B8", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 14, border: "2px solid #334155", borderTop: "2px solid #2563EB", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
              Recalculating…
            </span>
          )}
        </div>

        {priceChanged && recalcResult && (
          <div style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#2563EB" }}>Price has changed</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 2 }}>Original price</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9" }}>£{recalcResult.originalPrice.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 2 }}>New price</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: priceDiff < 0 ? "#2563EB" : "#EF4444" }}>£{recalcResult.newPrice.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 2 }}>Difference</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: priceDiff < 0 ? "#2563EB" : "#EF4444" }}>
                  {priceDiff < 0 ? "" : "+"}{priceDiff.toFixed(2)}
                </div>
              </div>
            </div>
            {recalcResult.totalPaid > 0 && (
              <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 14 }}>
                Customer has already paid <strong style={{ color: "#F1F5F9" }}>£{recalcResult.totalPaid.toFixed(2)}</strong>
              </div>
            )}
            {/* Options */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Keep original */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="priceAction"
                  value="keep"
                  checked={priceAction === "keep"}
                  onChange={() => setPriceAction("keep")}
                  style={{ accentColor: "#2563EB" }}
                />
                <span style={{ fontSize: 13, color: "#CBD5E1" }}>Keep original price (no refund)</span>
              </label>
              {/* Update to new */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="priceAction"
                  value="update"
                  checked={priceAction === "update"}
                  onChange={() => setPriceAction("update")}
                  style={{ accentColor: "#2563EB" }}
                />
                <span style={{ fontSize: 13, color: "#CBD5E1" }}>
                  Update to new price
                  {recalcResult.totalPaid > 0 && recalcResult.newPrice < recalcResult.totalPaid && (
                    <span style={{ color: "#2563EB", marginLeft: 6 }}>
                      (refund £{(recalcResult.totalPaid - recalcResult.newPrice).toFixed(2)})
                    </span>
                  )}
                </span>
              </label>
              {/* Custom */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="priceAction"
                  value="custom"
                  checked={priceAction === "custom"}
                  onChange={() => setPriceAction("custom")}
                  style={{ accentColor: "#2563EB" }}
                />
                <span style={{ fontSize: 13, color: "#CBD5E1" }}>Set custom price:</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "#94A3B8", fontSize: 13 }}>£</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={customPrice}
                    onChange={(e) => { setCustomPrice(e.target.value); setPriceAction("custom"); }}
                    placeholder="0.00"
                    style={{ ...inputStyle, width: 90, padding: "6px 10px" }}
                  />
                </span>
              </label>
            </div>
          </div>
        )}

        {!priceChanged && recalcResult && !recalcLoading && (
          <div style={{ fontSize: 13, color: "#64748B" }}>
            Price unchanged: <strong style={{ color: "#F1F5F9" }}>£{recalcResult.originalPrice.toFixed(2)}</strong>
          </div>
        )}
      </div>

      {/* Spinner keyframes */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
