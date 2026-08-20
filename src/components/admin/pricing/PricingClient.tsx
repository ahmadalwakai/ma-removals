"use client";

import { useMemo, useState } from "react";
import { colors, shadows } from "@/lib/tokens";
import type { PricingVehicleClass } from "@/lib/pricing/domain";

interface PricingRow {
  id: string;
  key: string;
  value: number;
  description: string | null;
  category: string;
  isActive: boolean;
  updatedAt: string;
}

interface VersionRow {
  id: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  label: string | null;
  createdAt: string;
  activatedAt: string | null;
  validation: { ok: boolean; reasons: string[] };
}

interface CampaignRow {
  id: string;
  type: string;
  internalName: string;
  customerLabel: string;
  active: boolean;
  percentageReduction: number | null;
  fixedReductionPence: number | null;
  maximumDiscountPence: number | null;
  campaignBudgetPence: number | null;
  spentBudgetPence: number;
  redemptionCount: number;
  startsAt: string | null;
  endsAt: string | null;
  pausedAt: string | null;
}

interface PromotionCodeRow {
  id: string;
  code: string;
  customerLabel: string;
  active: boolean;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  maximumDiscountPence: number | null;
  redemptionCount: number;
  startsAt: string | null;
  endsAt: string | null;
}

interface CompetitorBenchmarkRow {
  id: string;
  region: string;
  moveType: string;
  propertySize: string;
  serviceLevel: string;
  packingIncluded: boolean;
  distanceBandMinMiles: number;
  distanceBandMaxMiles: number | null;
  benchmarkPricePence: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceNote: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BeatCampaignRow {
  id: string;
  enabled: boolean;
  internalName: string;
  competitorLabel: string;
  applicableRegions: string[];
  applicableMoveTypes: string[];
  applicablePropertySizes: string[];
  beatPercentage: number;
  beatFixedAmountPence: number | null;
  minimumPricePence: number | null;
  minimumContributionPence: number | null;
  minimumMarginPercent: number | null;
  maximumDiscountPence: number | null;
  allowZeroMargin: boolean;
  allowNegativeMargin: boolean;
  maximumPermittedLossPence: number | null;
  startsAt: string | null;
  endsAt: string | null;
  dailyBookingLimit: number | null;
  totalCampaignBookingLimit: number | null;
  dailyBookingCount: number;
  bookingCount: number;
  dailyBookingDate: string | null;
  autoPause: boolean;
  pausedAt: string | null;
}

interface Props {
  configs: PricingRow[];
  vehicles: PricingVehicleClass[];
  versions: VersionRow[];
  campaigns: CampaignRow[];
  codes: PromotionCodeRow[];
  benchmarks: CompetitorBenchmarkRow[];
  beatCampaigns: BeatCampaignRow[];
  requiredKeys: string[];
}

const DEFAULT_SIMULATOR = {
  moveType: "house-move",
  moveSize: "2-bedrooms",
  collection: {
    fullAddress: "Sample collection address, Glasgow, G1 1AA",
    postcode: "G1 1AA",
    lat: 55.8642,
    lng: -4.2518,
    city: "Glasgow",
    region: "Scotland",
    country: "United Kingdom",
    propertyType: "Flat",
    floor: 1,
    hasLift: false,
    internalStairs: 0,
    externalStairs: 3,
    parking: "street",
    parkingRestrictions: "",
    carryDistanceMeters: 15,
    narrowRoad: false,
    loadingBayAvailable: false,
    accessRestrictions: "",
    notes: "",
  },
  delivery: {
    fullAddress: "Sample delivery address, Edinburgh, EH1 1AA",
    postcode: "EH1 1AA",
    lat: 55.9533,
    lng: -3.1883,
    city: "Edinburgh",
    region: "Scotland",
    country: "United Kingdom",
    propertyType: "House",
    floor: 0,
    hasLift: false,
    internalStairs: 0,
    externalStairs: 0,
    parking: "on-site",
    parkingRestrictions: "",
    carryDistanceMeters: 5,
    narrowRoad: false,
    loadingBayAvailable: false,
    accessRestrictions: "",
    notes: "",
  },
  additionalStop: null,
  moveDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  arrivalWindow: "morning",
  flexibleDate: false,
  flexibleTime: false,
  exactTime: false,
  sameDay: false,
  urgent: false,
  inventory: [],
  customItems: [],
  services: {
    packing: false,
    packingMaterials: false,
    unpacking: false,
    dismantling: false,
    reassembly: false,
    furnitureProtection: false,
    mattressProtection: false,
    tvProtection: false,
    wasteDisposal: false,
    additionalMover: false,
    waitingTime: false,
    heavyItemHandling: false,
    pianoHandling: false,
  },
  customer: {
    fullName: "Admin Simulator",
    email: "simulator@example.com",
    phone: "07400000000",
    companyName: "",
    preferredContactMethod: "email",
    marketingConsent: false,
    bookingConsentAccepted: true,
    termsAccepted: true,
  },
  routeOverride: { distanceMiles: 46, durationMinutes: 72 },
};

const DEFAULT_CAMPAIGN = {
  kind: "campaign",
  campaign: {
    type: "AGGRESSIVE",
    internalName: "August acquisition draft",
    customerLabel: "Online booking price",
    active: false,
    startsAt: null,
    endsAt: null,
    percentageReduction: 0.1,
    fixedReductionPence: null,
    maximumDiscountPence: 5000,
    maximumDiscountPercent: 0.2,
    hardMinimumPricePence: 8000,
    hardMinimumContributionPence: 0,
    hardMinimumMarginPercent: 0,
    allowZeroMargin: false,
    allowNegativeMargin: false,
    campaignBudgetPence: 100000,
    dailyBudgetPence: 25000,
    maximumRedemptions: null,
    stackable: false,
    autoPauseOnBudget: true,
    rules: {
      applicableMoveTypes: ["house-move", "flat-move", "student-move"],
      applicableWeekdays: [1, 2, 3, 4],
      excludeSpecialistItems: true,
      flexibleDateOnly: false,
    },
    reason: "Create draft acquisition campaign",
  },
};

const DEFAULT_CODE = {
  kind: "code",
  code: {
    code: "MOVE10",
    internalName: "Online code draft",
    customerLabel: "Limited-time saving",
    active: false,
    discountType: "PERCENTAGE",
    discountValue: 1000,
    maximumDiscountPence: 5000,
    minimumSubtotalPence: 8000,
    maximumSubtotalPence: null,
    startsAt: null,
    endsAt: null,
    maximumRedemptions: 100,
    maximumRedemptionsPerCustomer: 1,
    applicableMoveTypes: [],
    applicableRegions: [],
    applicableWeekdays: [],
    applicableVehicleClasses: [],
    firstBookingOnly: false,
    stackable: false,
    campaignId: null,
    reason: "Create or update promotion code",
  },
};

const DEFAULT_BENCHMARK = {
  kind: "benchmark",
  benchmark: {
    region: "",
    moveType: "house-move",
    propertySize: "2-bedrooms",
    serviceLevel: "standard",
    packingIncluded: false,
    distanceBandMinMiles: 0,
    distanceBandMaxMiles: null,
    benchmarkPricePence: null,
    effectiveFrom: new Date().toISOString(),
    effectiveTo: null,
    sourceNote: "",
    active: false,
    reason: "Create competitor benchmark",
  },
};

const DEFAULT_BEAT_CAMPAIGN = {
  kind: "beatCampaign",
  campaign: {
    enabled: true,
    internalName: "Beat AnyVan by 10%",
    competitorLabel: "AnyVan",
    applicableRegions: ["Scotland", "Glasgow City", "City of Edinburgh", "Dundee City", "Glasgow", "Edinburgh", "Dundee"],
    applicableMoveTypes: [],
    applicablePropertySizes: [],
    beatPercentage: 0.1,
    beatFixedAmountPence: null,
    minimumPricePence: null,
    minimumContributionPence: 0,
    minimumMarginPercent: null,
    maximumDiscountPence: null,
    allowZeroMargin: false,
    allowNegativeMargin: true,
    maximumPermittedLossPence: null,
    startsAt: null,
    endsAt: null,
    dailyBookingLimit: null,
    totalCampaignBookingLimit: null,
    autoPause: true,
    reason: "Create beat competitor campaign",
  },
};

function pounds(value: number | null) {
  if (value == null) return "";
  return (value / 100).toFixed(2);
}

function pence(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 12, padding: 18, boxShadow: shadows.card, marginBottom: 18 }}>
      <h2 style={{ margin: "0 0 14px", fontFamily: "var(--font-heading)", color: colors.ink, fontSize: 16 }}>{title}</h2>
      {children}
    </section>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: 8, padding: "8px 10px", fontSize: 13, ...(props.style ?? {}) }} />;
}

function Button({ children, tone = "dark", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "dark" | "green" | "amber" }) {
  const background = tone === "green" ? colors.emerald : tone === "amber" ? colors.amber : colors.ink;
  const color = tone === "amber" ? colors.midnight : "white";
  return (
    <button
      {...props}
      style={{
        border: "none",
        borderRadius: 8,
        padding: "8px 12px",
        background,
        color,
        fontSize: 12,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
        ...(props.style ?? {}),
      }}
    >
      {children}
    </button>
  );
}

export function PricingClient({
  configs: initialConfigs,
  vehicles: initialVehicles,
  versions: initialVersions,
  campaigns: initialCampaigns,
  codes: initialCodes,
  benchmarks: initialBenchmarks,
  beatCampaigns: initialBeatCampaigns,
  requiredKeys,
}: Props) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [versions] = useState(initialVersions);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [codes, setCodes] = useState(initialCodes);
  const [benchmarks, setBenchmarks] = useState(initialBenchmarks);
  const [beatCampaigns, setBeatCampaigns] = useState(initialBeatCampaigns);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [newConfig, setNewConfig] = useState({ key: "", value: "", category: "general", description: "" });
  const [vehicleForm, setVehicleForm] = useState({
    name: "",
    isActive: false,
    maxUsableVolumeM3: "",
    maxPayloadKg: "",
    minCrew: "1",
    maxCrew: "2",
    baseFeePounds: "",
    perMilePounds: "",
    perHourPounds: "",
    loadingEfficiencyFactor: "",
    unloadingEfficiencyFactor: "",
    fleetCount: "",
    manualReviewThresholdM3: "",
    manualReviewPayloadKg: "",
  });
  const [simulatorJson, setSimulatorJson] = useState(JSON.stringify(DEFAULT_SIMULATOR, null, 2));
  const [simulatorResult, setSimulatorResult] = useState<unknown>(null);
  const [campaignJson, setCampaignJson] = useState(JSON.stringify(DEFAULT_CAMPAIGN, null, 2));
  const [codeJson, setCodeJson] = useState(JSON.stringify(DEFAULT_CODE, null, 2));
  const [benchmarkJson, setBenchmarkJson] = useState(JSON.stringify(DEFAULT_BENCHMARK, null, 2));
  const [beatCampaignJson, setBeatCampaignJson] = useState(JSON.stringify(DEFAULT_BEAT_CAMPAIGN, null, 2));
  const [message, setMessage] = useState("");

  const missingKeys = useMemo(() => {
    const present = new Set(configs.filter((row) => row.isActive).map((row) => row.key));
    return requiredKeys.filter((key) => !present.has(key));
  }, [configs, requiredKeys]);

  const grouped = useMemo(() => {
    const groups: Record<string, PricingRow[]> = {};
    for (const row of configs) {
      groups[row.category] ??= [];
      groups[row.category]!.push(row);
    }
    return groups;
  }, [configs]);

  async function saveConfig(row: PricingRow) {
    const raw = editing[row.id];
    if (raw == null) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const response = await fetch(`/api/admin/pricing/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value, reason: "Admin pricing update" }),
    });
    if (!response.ok) {
      setMessage("Could not save pricing config.");
      return;
    }
    setConfigs((prev) => prev.map((item) => item.id === row.id ? { ...item, value } : item));
    setEditing((prev) => {
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
    setMessage("Saved. A new draft pricing version was created.");
  }

  async function addConfig() {
    const value = Number(newConfig.value);
    if (!newConfig.key || !Number.isFinite(value)) return;
    const response = await fetch("/api/admin/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newConfig, value, reason: "Admin created missing pricing setting" }),
    });
    const data = await response.json() as { config?: PricingRow; error?: string };
    if (!response.ok || !data.config) {
      setMessage(data.error ?? "Could not add pricing setting.");
      return;
    }
    setConfigs((prev) => [...prev.filter((row) => row.id !== data.config!.id), data.config!]);
    setNewConfig({ key: "", value: "", category: "general", description: "" });
    setMessage("Pricing setting saved. A new draft pricing version was created.");
  }

  async function saveVehicle() {
    const body = {
      name: vehicleForm.name,
      isActive: vehicleForm.isActive,
      maxUsableVolumeM3: vehicleForm.maxUsableVolumeM3 ? Number(vehicleForm.maxUsableVolumeM3) : null,
      maxPayloadKg: vehicleForm.maxPayloadKg ? Number(vehicleForm.maxPayloadKg) : null,
      minCrew: Number(vehicleForm.minCrew),
      maxCrew: Number(vehicleForm.maxCrew),
      baseFeePence: pence(vehicleForm.baseFeePounds),
      perMilePence: pence(vehicleForm.perMilePounds),
      perHourPence: pence(vehicleForm.perHourPounds),
      loadingEfficiencyFactor: vehicleForm.loadingEfficiencyFactor ? Number(vehicleForm.loadingEfficiencyFactor) : null,
      unloadingEfficiencyFactor: vehicleForm.unloadingEfficiencyFactor ? Number(vehicleForm.unloadingEfficiencyFactor) : null,
      fleetCount: vehicleForm.fleetCount ? Number(vehicleForm.fleetCount) : null,
      manualReviewThresholdM3: vehicleForm.manualReviewThresholdM3 ? Number(vehicleForm.manualReviewThresholdM3) : null,
      manualReviewPayloadKg: vehicleForm.manualReviewPayloadKg ? Number(vehicleForm.manualReviewPayloadKg) : null,
      reason: "Admin vehicle configuration update",
    };
    const response = await fetch("/api/admin/pricing/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json() as { vehicle?: PricingVehicleClass; error?: string };
    if (!response.ok || !data.vehicle) {
      setMessage(data.error ?? "Could not save vehicle class.");
      return;
    }
    setVehicles((prev) => [...prev.filter((vehicle) => vehicle.id !== data.vehicle!.id), data.vehicle!]);
    setMessage("Vehicle class saved. A new draft pricing version was created.");
  }

  async function createDraft() {
    const response = await fetch("/api/admin/pricing/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "draft", reason: "Admin requested pricing snapshot" }),
    });
    if (!response.ok) {
      setMessage("Could not create draft version.");
      return;
    }
    location.reload();
  }

  async function activateVersion(versionId: string) {
    const reason = window.prompt("Reason for activating this pricing version");
    if (!reason) return;
    const response = await fetch("/api/admin/pricing/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "activate", versionId, reason }),
    });
    const data = await response.json() as { error?: string; reasons?: string[] };
    if (!response.ok) {
      setMessage(data.reasons?.join(" · ") ?? data.error ?? "Could not activate version.");
      return;
    }
    location.reload();
  }

  async function runSimulator() {
    try {
      const payload = JSON.parse(simulatorJson) as unknown;
      const response = await fetch("/api/admin/pricing/simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as unknown;
      setSimulatorResult(data);
    } catch {
      setSimulatorResult({ error: "Invalid simulator JSON" });
    }
  }

  async function savePromotion(raw: string) {
    try {
      const payload = JSON.parse(raw) as unknown;
      const response = await fetch("/api/admin/pricing/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { campaign?: CampaignRow; code?: PromotionCodeRow; error?: string; reasons?: string[] };
      if (!response.ok) {
        setMessage(data.reasons?.join(" · ") ?? data.error ?? "Could not save promotion.");
        return;
      }
      if (data.campaign) setCampaigns((prev) => [data.campaign!, ...prev.filter((campaign) => campaign.id !== data.campaign!.id)]);
      if (data.code) setCodes((prev) => [data.code!, ...prev.filter((code) => code.id !== data.code!.id)]);
      setMessage("Promotion saved and audited.");
    } catch {
      setMessage("Promotion JSON is invalid.");
    }
  }

  async function saveCompetitorPricing(raw: string) {
    try {
      const payload = JSON.parse(raw) as unknown;
      const response = await fetch("/api/admin/pricing/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as {
        benchmark?: CompetitorBenchmarkRow;
        campaign?: BeatCampaignRow;
        error?: string;
        reasons?: string[];
      };
      if (!response.ok) {
        setMessage(data.reasons?.join(" · ") ?? data.error ?? "Could not save competitor pricing.");
        return;
      }
      if (data.benchmark) {
        setBenchmarks((prev) => [data.benchmark!, ...prev.filter((benchmark) => benchmark.id !== data.benchmark!.id)]);
      }
      if (data.campaign) {
        setBeatCampaigns((prev) => [data.campaign!, ...prev.filter((campaign) => campaign.id !== data.campaign!.id)]);
      }
      setMessage("Competitor pricing saved and audited.");
    } catch {
      setMessage("Competitor pricing JSON is invalid.");
    }
  }

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-heading)", color: colors.ink, fontSize: 24 }}>Pricing</h1>
          <p style={{ color: colors.muted, fontSize: 13, margin: "4px 0 0" }}>Versioned pricing, vehicle configuration, validation, and simulator.</p>
        </div>
        <Button onClick={() => void createDraft()}>Create Draft Snapshot</Button>
      </div>

      {message && <div style={{ background: "#FFFBEB", border: "1px solid #F59E0B", borderRadius: 10, padding: 10, marginBottom: 16, color: "#92400E", fontSize: 13 }}>{message}</div>}

      <Section title="Publish Readiness">
        {missingKeys.length === 0 ? (
          <p style={{ color: colors.emerald, fontWeight: 800, margin: 0 }}>All required pricing settings exist. Vehicle validation still applies before activation.</p>
        ) : (
          <div>
            <p style={{ color: colors.crimson, fontWeight: 800, marginTop: 0 }}>Missing required settings: {missingKeys.join(", ")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 2fr auto", gap: 8 }}>
              <Input placeholder="key" value={newConfig.key} onChange={(e) => setNewConfig((prev) => ({ ...prev, key: e.target.value }))} />
              <Input placeholder="value" value={newConfig.value} onChange={(e) => setNewConfig((prev) => ({ ...prev, value: e.target.value }))} />
              <Input placeholder="category" value={newConfig.category} onChange={(e) => setNewConfig((prev) => ({ ...prev, category: e.target.value }))} />
              <Input placeholder="description" value={newConfig.description} onChange={(e) => setNewConfig((prev) => ({ ...prev, description: e.target.value }))} />
              <Button tone="green" onClick={() => void addConfig()}>Add</Button>
            </div>
          </div>
        )}
      </Section>

      <Section title="General Pricing Settings">
        {Object.entries(grouped).map(([category, rows]) => (
          <div key={category} style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, color: colors.muted, textTransform: "uppercase", margin: "0 0 8px" }}>{category}</h3>
            <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
              {rows.map((row) => (
                <div key={row.id} style={{ display: "grid", gridTemplateColumns: "minmax(200px, 1fr) 120px 80px", gap: 10, alignItems: "center", padding: 10, borderBottom: "1px solid #F1F5F9" }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 800, color: colors.ink }}>{row.key}</div>
                    <div style={{ fontSize: 11, color: colors.muted }}>{row.description}</div>
                  </div>
                  <Input value={editing[row.id] ?? String(row.value)} onChange={(e) => setEditing((prev) => ({ ...prev, [row.id]: e.target.value }))} />
                  <Button disabled={editing[row.id] == null} tone="green" onClick={() => void saveConfig(row)}>Save</Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title="Vehicle Classes">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 14 }}>
          {vehicles.map((vehicle) => (
            <div key={vehicle.id} style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: 12 }}>
              <strong>{vehicle.name}</strong>
              <div style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>
                {vehicle.isActive ? "Active" : "Inactive"} · {vehicle.maxUsableVolumeM3 ?? "?"} m3 · {vehicle.maxPayloadKg ?? "?"} kg · crew {vehicle.minCrew}-{vehicle.maxCrew}
              </div>
              <div style={{ fontSize: 12, color: colors.muted }}>
                Base £{pounds(vehicle.baseFeePence)} · mile £{pounds(vehicle.perMilePence)} · hour £{pounds(vehicle.perHourPence)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          <Input placeholder="Name" value={vehicleForm.name} onChange={(e) => setVehicleForm((prev) => ({ ...prev, name: e.target.value }))} />
          <Input placeholder="Volume m3" value={vehicleForm.maxUsableVolumeM3} onChange={(e) => setVehicleForm((prev) => ({ ...prev, maxUsableVolumeM3: e.target.value }))} />
          <Input placeholder="Payload kg" value={vehicleForm.maxPayloadKg} onChange={(e) => setVehicleForm((prev) => ({ ...prev, maxPayloadKg: e.target.value }))} />
          <Input placeholder="Min crew" value={vehicleForm.minCrew} onChange={(e) => setVehicleForm((prev) => ({ ...prev, minCrew: e.target.value }))} />
          <Input placeholder="Max crew" value={vehicleForm.maxCrew} onChange={(e) => setVehicleForm((prev) => ({ ...prev, maxCrew: e.target.value }))} />
          <Input placeholder="Base £" value={vehicleForm.baseFeePounds} onChange={(e) => setVehicleForm((prev) => ({ ...prev, baseFeePounds: e.target.value }))} />
          <Input placeholder="Per mile £" value={vehicleForm.perMilePounds} onChange={(e) => setVehicleForm((prev) => ({ ...prev, perMilePounds: e.target.value }))} />
          <Input placeholder="Per hour £" value={vehicleForm.perHourPounds} onChange={(e) => setVehicleForm((prev) => ({ ...prev, perHourPounds: e.target.value }))} />
          <Input placeholder="Load factor" value={vehicleForm.loadingEfficiencyFactor} onChange={(e) => setVehicleForm((prev) => ({ ...prev, loadingEfficiencyFactor: e.target.value }))} />
          <Input placeholder="Unload factor" value={vehicleForm.unloadingEfficiencyFactor} onChange={(e) => setVehicleForm((prev) => ({ ...prev, unloadingEfficiencyFactor: e.target.value }))} />
          <Input placeholder="Fleet count" value={vehicleForm.fleetCount} onChange={(e) => setVehicleForm((prev) => ({ ...prev, fleetCount: e.target.value }))} />
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" checked={vehicleForm.isActive} onChange={(e) => setVehicleForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
            Active
          </label>
        </div>
        <Button tone="green" style={{ marginTop: 10 }} onClick={() => void saveVehicle()}>Save Vehicle Class</Button>
      </Section>

      <Section title="Pricing Rule Version History">
        <div style={{ display: "grid", gap: 8 }}>
          {versions.map((version) => (
            <div key={version.id} style={{ display: "grid", gridTemplateColumns: "90px 100px 1fr auto", gap: 10, alignItems: "center", border: "1px solid #E2E8F0", borderRadius: 10, padding: 10 }}>
              <strong>v{version.version}</strong>
              <span style={{ color: version.status === "ACTIVE" ? colors.emerald : colors.muted, fontWeight: 800 }}>{version.status}</span>
              <span style={{ fontSize: 12, color: version.validation.ok ? colors.emerald : colors.crimson }}>
                {version.validation.ok ? "Valid" : version.validation.reasons.slice(0, 3).join(" · ")}
              </span>
              <Button disabled={version.status === "ACTIVE"} onClick={() => void activateVersion(version.id)}>Activate</Button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Promotions, Aggressive Pricing, and Codes">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 16 }}>
          {campaigns.map((campaign) => (
            <div key={campaign.id} style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: 12 }}>
              <strong>{campaign.customerLabel}</strong>
              <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                {campaign.type} · {campaign.active ? "Active" : "Inactive"}{campaign.pausedAt ? " · Paused" : ""}
              </div>
              <div style={{ fontSize: 12, color: colors.muted }}>
                Discount {campaign.percentageReduction != null ? `${Math.round(campaign.percentageReduction * 100)}%` : ""} {campaign.fixedReductionPence != null ? `£${pounds(campaign.fixedReductionPence)}` : ""} · cap £{pounds(campaign.maximumDiscountPence)}
              </div>
              <div style={{ fontSize: 12, color: colors.muted }}>
                Redemptions {campaign.redemptionCount} · budget £{pounds(campaign.spentBudgetPence)} / £{pounds(campaign.campaignBudgetPence)}
              </div>
            </div>
          ))}
          {codes.map((code) => (
            <div key={code.id} style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: 12 }}>
              <strong>{code.code}</strong>
              <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                {code.customerLabel} · {code.active ? "Active" : "Inactive"}
              </div>
              <div style={{ fontSize: 12, color: colors.muted }}>
                {code.discountType === "PERCENTAGE" ? `${code.discountValue / 100}%` : `£${pounds(code.discountValue)}`} · cap £{pounds(code.maximumDiscountPence)} · used {code.redemptionCount}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 13, color: colors.muted, textTransform: "uppercase", margin: "0 0 8px" }}>Campaign JSON</h3>
            <textarea
              value={campaignJson}
              onChange={(e) => setCampaignJson(e.target.value)}
              rows={18}
              style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: 10, padding: 12, fontFamily: "var(--font-mono)", fontSize: 12 }}
            />
            <Button tone="green" style={{ marginTop: 10 }} onClick={() => void savePromotion(campaignJson)}>Save Campaign</Button>
          </div>
          <div>
            <h3 style={{ fontSize: 13, color: colors.muted, textTransform: "uppercase", margin: "0 0 8px" }}>Promotion Code JSON</h3>
            <textarea
              value={codeJson}
              onChange={(e) => setCodeJson(e.target.value)}
              rows={18}
              style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: 10, padding: 12, fontFamily: "var(--font-mono)", fontSize: 12 }}
            />
            <Button tone="green" style={{ marginTop: 10 }} onClick={() => void savePromotion(codeJson)}>Save Code</Button>
          </div>
        </div>
      </Section>

      <Section title="Competitor Benchmarks and Beat Mode">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 16 }}>
          {benchmarks.map((benchmark) => (
            <div key={benchmark.id} style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: 12 }}>
              <strong>{benchmark.region} · {benchmark.propertySize}</strong>
              <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                {benchmark.moveType} · {benchmark.serviceLevel} · {benchmark.active ? "Active" : "Inactive"}
              </div>
              <div style={{ fontSize: 12, color: colors.muted }}>
                Benchmark £{pounds(benchmark.benchmarkPricePence)} · {benchmark.distanceBandMinMiles}-{benchmark.distanceBandMaxMiles ?? "∞"} miles · {benchmark.packingIncluded ? "Packing" : "No packing"}
              </div>
              <div style={{ fontSize: 12, color: colors.muted }}>
                From {new Date(benchmark.effectiveFrom).toLocaleDateString("en-GB")} · {benchmark.sourceNote}
              </div>
            </div>
          ))}
          {beatCampaigns.map((campaign) => (
            <div key={campaign.id} style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: 12 }}>
              <strong>{campaign.internalName || campaign.competitorLabel}</strong>
              <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                {campaign.enabled ? "Enabled" : "Disabled"}{campaign.pausedAt ? " · Paused" : ""} · beat {Math.round(campaign.beatPercentage * 100)}% {campaign.beatFixedAmountPence != null ? `+ £${pounds(campaign.beatFixedAmountPence)}` : ""}
              </div>
              <div style={{ fontSize: 12, color: colors.muted }}>
                Cap £{pounds(campaign.maximumDiscountPence)} · min £{pounds(campaign.minimumPricePence)} · bookings {campaign.bookingCount}
              </div>
              <div style={{ fontSize: 12, color: colors.muted }}>
                Daily {campaign.dailyBookingCount} / {campaign.dailyBookingLimit ?? "∞"} · total {campaign.bookingCount} / {campaign.totalCampaignBookingLimit ?? "∞"}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 13, color: colors.muted, textTransform: "uppercase", margin: "0 0 8px" }}>Benchmark JSON</h3>
            <textarea
              value={benchmarkJson}
              onChange={(e) => setBenchmarkJson(e.target.value)}
              rows={18}
              style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: 10, padding: 12, fontFamily: "var(--font-mono)", fontSize: 12 }}
            />
            <Button tone="green" style={{ marginTop: 10 }} onClick={() => void saveCompetitorPricing(benchmarkJson)}>Save Benchmark</Button>
          </div>
          <div>
            <h3 style={{ fontSize: 13, color: colors.muted, textTransform: "uppercase", margin: "0 0 8px" }}>Beat Campaign JSON</h3>
            <textarea
              value={beatCampaignJson}
              onChange={(e) => setBeatCampaignJson(e.target.value)}
              rows={18}
              style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: 10, padding: 12, fontFamily: "var(--font-mono)", fontSize: 12 }}
            />
            <Button tone="green" style={{ marginTop: 10 }} onClick={() => void saveCompetitorPricing(beatCampaignJson)}>Save Beat Campaign</Button>
          </div>
        </div>
      </Section>

      <Section title="Pricing Simulator">
        <textarea
          value={simulatorJson}
          onChange={(e) => setSimulatorJson(e.target.value)}
          rows={18}
          style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: 10, padding: 12, fontFamily: "var(--font-mono)", fontSize: 12 }}
        />
        <Button tone="amber" style={{ marginTop: 10 }} onClick={() => void runSimulator()}>Run Simulator</Button>
        {simulatorResult != null && (
          <pre style={{ whiteSpace: "pre-wrap", background: "#0B1120", color: "white", padding: 12, borderRadius: 10, marginTop: 10, maxHeight: 480, overflow: "auto" }}>
            {JSON.stringify(simulatorResult, null, 2)}
          </pre>
        )}
      </Section>
    </div>
  );
}
