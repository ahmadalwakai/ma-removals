import assert from "node:assert/strict";
import test from "node:test";
import {
  attachPricePreviewScope,
  filterPricePreviewsByScope,
  shouldAcceptPricePreviewResponse,
} from "../src/lib/booking/price-preview-cache";

test("scoped price previews reject stale calendar prices after priced inputs change", () => {
  const oldScope = "items:sofa:4";
  const newScope = "items:sofa:5";

  const oldPreview = attachPricePreviewScope(
    [{ key: "2026-09-01::1", totalPence: 40000 }],
    oldScope
  )[0];

  assert.ok(oldPreview);

  const staleFiltered = filterPricePreviewsByScope(
    {
      [oldPreview.key]: oldPreview,
    },
    newScope
  );

  assert.deepEqual(staleFiltered, {});

  const newPreview = attachPricePreviewScope(
    [{ key: "2026-09-01::1", totalPence: 45500 }],
    newScope
  )[0];

  assert.ok(newPreview);

  const filtered = filterPricePreviewsByScope(
    {
      [newPreview.key]: newPreview,
    },
    newScope
  );

  assert.deepEqual(Object.keys(filtered), ["2026-09-01::1"]);
  assert.equal(filtered["2026-09-01::1"]?.totalPence, 45500);
  assert.equal(filtered["2026-09-01::1"]?.pricingScopeKey, newScope);
});

test("price preview responses are rejected after request invalidation", () => {
  assert.equal(
    shouldAcceptPricePreviewResponse({
      responseRequestId: 3,
      activeRequestId: 4,
      responsePricingScopeKey: "items:sofa:4",
      activePricingScopeKey: "items:sofa:4",
    }),
    false
  );

  assert.equal(
    shouldAcceptPricePreviewResponse({
      responseRequestId: 4,
      activeRequestId: 4,
      responsePricingScopeKey: "items:sofa:4",
      activePricingScopeKey: "items:sofa:5",
    }),
    false
  );

  assert.equal(
    shouldAcceptPricePreviewResponse({
      responseRequestId: 4,
      activeRequestId: 4,
      responsePricingScopeKey: "items:sofa:5",
      activePricingScopeKey: "items:sofa:5",
    }),
    true
  );
});
