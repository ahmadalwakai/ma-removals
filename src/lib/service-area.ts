export interface ServiceAreaAddress {
  fullAddress?: string | null;
  postcode?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export const SCOTLAND_PICKUP_MESSAGE =
  "We only collect from Scotland. You can still choose a delivery address in England.";

export const BERMUDA_ADDRESS_MESSAGE =
  "Bermuda addresses are not supported. Please choose a UK address.";

const SCOTTISH_POSTCODE_AREAS = new Set([
  "AB",
  "DD",
  "DG",
  "EH",
  "FK",
  "G",
  "HS",
  "IV",
  "KA",
  "KW",
  "KY",
  "ML",
  "PA",
  "PH",
  "TD",
  "ZE",
]);

function cleanText(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

export function postcodeArea(postcode?: string | null): string {
  const compact = (postcode ?? "").toUpperCase().replace(/\s+/g, "");
  return compact.match(/^[A-Z]{1,2}/)?.[0] ?? "";
}

export function isBermudaAddress(address?: ServiceAreaAddress | null): boolean {
  if (!address) return false;

  const region = cleanText(address.region);
  const country = cleanText(address.country);
  const fullAddress = cleanText(address.fullAddress);
  const city = cleanText(address.city);
  const combined = [region, country, fullAddress, city].filter(Boolean).join(" ");

  if (country === "bm" || country === "bermuda") return true;
  if (/\bbermuda\b/i.test(combined)) return true;

  // BM is not a UK postcode area, so this catches Bermuda postcodes without
  // blocking Birmingham (B) or other UK postcode districts.
  return postcodeArea(address.postcode) === "BM";
}

function postcodeDistrictNumber(postcode?: string | null): number | null {
  const compact = (postcode ?? "").toUpperCase().replace(/\s+/g, "");
  const match = compact.match(/^[A-Z]{1,2}(\d{1,2})/);
  if (!match?.[1]) return null;
  const number = Number(match[1]);
  return Number.isFinite(number) ? number : null;
}

export function isScottishPostcode(postcode?: string | null): boolean {
  const area = postcodeArea(postcode);
  if (!SCOTTISH_POSTCODE_AREAS.has(area)) return false;

  // TD15 covers Berwick-upon-Tweed / Northumberland, so do not accept it by
  // postcode alone unless the geocoder explicitly says Scotland elsewhere.
  if (area === "TD" && postcodeDistrictNumber(postcode) === 15) return false;

  return true;
}

export function isCoordinateInScotland(lat?: number | null, lng?: number | null): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  return lat >= 54.55 && lat <= 61.05 && lng >= -8.85 && lng <= -0.65;
}

export function isScotlandAddress(address?: ServiceAreaAddress | null): boolean {
  if (!address) return false;

  const region = cleanText(address.region);
  const country = cleanText(address.country);
  const fullAddress = cleanText(address.fullAddress);
  const city = cleanText(address.city);
  const combined = [region, country, fullAddress, city].filter(Boolean).join(" ");

  if (/\b(scotland|alba)\b/i.test(combined)) return true;
  if (/\b(england|wales|northern ireland)\b/i.test(combined)) return false;
  if (isScottishPostcode(address.postcode)) return true;

  return isCoordinateInScotland(address.lat, address.lng);
}
