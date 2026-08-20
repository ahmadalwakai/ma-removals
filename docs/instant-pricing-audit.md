# Instant Pricing Architecture Audit

## Existing Architecture Found

- Next.js App Router on Next 16 with React 19 and TypeScript strict mode.
- Chakra UI 3, existing token helpers in `src/lib/tokens`, and existing booking components under `src/components/booking`.
- Prisma 7 with Neon Postgres through `@prisma/adapter-pg`; shared client lives in `src/lib/db.ts`.
- NextAuth v5 credentials auth with role checks used by admin routes.
- Existing Mapbox route/address utilities in booking APIs; new quote pricing uses server-side Mapbox only.
- Stripe payment intents were already used by booking APIs; the quote flow now uses stored quote totals only.
- Existing notification path uses `AdminNotification` plus optional FCM push.
- Pricing values already existed in `PricingConfig`, but complete operational instant-quote inputs did not. Fixed quote publication is blocked until an admin creates and activates a complete pricing version.

## New Pricing Flow

1. Customer submits a Zod-validated quote request to `/api/quotes`.
2. Server resolves item IDs to authoritative inventory data.
3. Server calculates route distance/duration through Mapbox.
4. The pure pricing domain evaluates the active `PricingVersion` snapshot.
5. The quote is persisted with immutable input, inventory, route, vehicle, crew, customer breakdown, internal breakdown, total pence, expiry, and manual-review reasons.
6. Customer responses expose only customer-safe fields.
7. Acceptance, payment intent creation, and booking confirmation all reload the stored quote and use its stored amount.

## Pricing Rule Order

The domain applies:

1. Base service charge
2. Vehicle charge
3. Labour charge
4. Distance charge
5. Travel time charge
6. Inventory handling charge
7. Access charge
8. Additional stop charge
9. Optional service charge
10. Heavy and specialist item charge
11. Schedule surcharge
12. Regional charge
13. Parking or toll allowance
14. Contingency
15. Permitted discounts
16. Minimum booking amount
17. Rounding up to the configured increment
18. VAT only when `vat_enabled` is explicitly `1`

## Manual Review Gates

Manual review is triggered for missing active pricing, missing route, duplicate addresses, invalid or incomplete catalogue data, custom items, inactive items, vehicle capacity or payload overflow, low margin, high quote amount, past dates, and pricing invariants.

## Database Notes

The migration `20260805120000_instant_quotes` adds:

- `QuoteStatus` and `PricingVersionStatus` enums.
- `PricingVersion`, `VehicleClassConfig`, `Quote`, and `PricingAuditLog`.
- Quote linkage on `Booking`.
- Authoritative inventory fields on `Item`.

The connected Neon database was non-empty without a Prisma migration baseline, so `migrate deploy` returned `P3005`. The additive migration SQL was applied in a transaction, then marked applied with `prisma migrate resolve --applied 20260805120000_instant_quotes`; `migrate status` now reports the database schema is up to date.
