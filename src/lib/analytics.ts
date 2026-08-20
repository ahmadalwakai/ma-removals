// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWindow = Record<string, any>;

const GOOGLE_ADS_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "AW-16762014050";
const GOOGLE_ADS_BOOKING_CONVERSION_LABEL =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_BOOKING_CONVERSION_LABEL;
const GOOGLE_ADS_CONTACT_CONVERSION_LABEL =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_CONTACT_CONVERSION_LABEL;

function trackGoogleAdsConversion(
  label: string | undefined,
  params: Record<string, unknown> = {}
) {
  if (!label || typeof window === "undefined") return;
  const w = window as unknown as AnyWindow;
  if (typeof w.gtag !== "function") return;
  w.gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${label}`,
    ...params,
  });
}

export function trackPurchase(value: number, transactionId: string) {
  if (typeof window === "undefined") return;
  const w = window as unknown as AnyWindow;
  if (typeof w.gtag === "function")
    w.gtag("event", "purchase", {
      value,
      currency: "GBP",
      transaction_id: transactionId,
    });
  trackGoogleAdsConversion(GOOGLE_ADS_BOOKING_CONVERSION_LABEL, {
    value,
    currency: "GBP",
    transaction_id: transactionId,
  });
  if (typeof w.fbq === "function")
    w.fbq("track", "Purchase", { value, currency: "GBP" });
  if (w.ttq && typeof w.ttq.track === "function")
    w.ttq.track("CompletePayment", { value, currency: "GBP" });
}

export function trackContact(method: "call" | "whatsapp" | "email" | "sms") {
  if (typeof window === "undefined") return;
  const w = window as unknown as AnyWindow;
  if (typeof w.gtag === "function")
    w.gtag("event", "contact", { method });
  trackGoogleAdsConversion(GOOGLE_ADS_CONTACT_CONVERSION_LABEL, {
    event_category: "contact",
    event_label: method,
  });
  if (typeof w.fbq === "function")
    w.fbq("track", "Contact", { contact_method: method });
  if (w.ttq && typeof w.ttq.track === "function")
    w.ttq.track("Contact", { contact_method: method });
}

export function trackLead(source?: string) {
  if (typeof window === "undefined") return;
  const w = window as unknown as AnyWindow;
  if (typeof w.gtag === "function")
    w.gtag("event", "generate_lead", source ? { source } : undefined);
  if (typeof w.fbq === "function") w.fbq("track", "Lead");
  if (w.ttq && typeof w.ttq.track === "function") w.ttq.track("SubmitForm");
}

export function trackBookingStart() {
  if (typeof window === "undefined") return;
  const w = window as unknown as AnyWindow;
  if (typeof w.gtag === "function") w.gtag("event", "begin_checkout");
  if (typeof w.fbq === "function") w.fbq("track", "InitiateCheckout");
  if (w.ttq && typeof w.ttq.track === "function")
    w.ttq.track("InitiateCheckout");
}

export function trackAddToCart(serviceName: string, value: number) {
  if (typeof window === "undefined") return;
  const w = window as unknown as AnyWindow;
  if (typeof w.gtag === "function")
    w.gtag("event", "add_to_cart", {
      items: [{ item_name: serviceName }],
      value,
      currency: "GBP",
    });
  if (typeof w.fbq === "function")
    w.fbq("track", "AddToCart", {
      content_name: serviceName,
      value,
      currency: "GBP",
    });
  if (w.ttq && typeof w.ttq.track === "function")
    w.ttq.track("AddToCart", {
      content_name: serviceName,
      value,
      currency: "GBP",
    });
}
