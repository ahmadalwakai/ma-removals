"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";

const CONSENT_KEY = "ma-cookie-consent";
const CONSENT_EVENT = "ma-cookie-consent-change";
const DEFAULT_GOOGLE_ADS_ID = "AW-16762014050";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWindow = Window & Record<string, any>;

function consentSettings(granted: boolean) {
  return {
    ad_storage: granted ? "granted" : "denied",
    ad_user_data: granted ? "granted" : "denied",
    ad_personalization: granted ? "granted" : "denied",
    analytics_storage: granted ? "granted" : "denied",
  };
}

function safePageLocation() {
  const url = new URL(window.location.href);
  for (const key of ["email", "phone", "name", "customer", "customerEmail"]) {
    url.searchParams.delete(key);
  }
  return url.toString();
}

function ensureGtag() {
  const w = window as AnyWindow;
  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag !== "function") {
    w.gtag = (...args: unknown[]) => {
      w.dataLayer.push(args);
    };
  }
  if (!w.__maGtagInitialized) {
    w.gtag("consent", "default", consentSettings(false));
    w.gtag("js", new Date());
    w.__maGtagInitialized = true;
  }
  return w.gtag as (...args: unknown[]) => void;
}

export function AnalyticsPixels() {
  const [consent, setConsent] = useState<string | null>(null);

  useEffect(() => {
    const readConsent = () => {
      try {
        return localStorage.getItem(CONSENT_KEY);
      } catch {
        return null;
      }
    };

    const updateConsent = () => setConsent(readConsent());

    updateConsent();
    window.addEventListener("storage", updateConsent);
    window.addEventListener(CONSENT_EVENT, updateConsent);

    return () => {
      window.removeEventListener("storage", updateConsent);
      window.removeEventListener(CONSENT_EVENT, updateConsent);
    };
  }, []);

  const GA_ID = process.env.NEXT_PUBLIC_GA4_ID;
  const GOOGLE_ADS_ID =
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? DEFAULT_GOOGLE_ADS_ID;
  const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
  const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
  const googleIds = useMemo(
    () => [GOOGLE_ADS_ID, GA_ID].filter(Boolean) as string[],
    [GA_ID, GOOGLE_ADS_ID]
  );
  const primaryGoogleId = googleIds[0];
  const hasMarketingConsent = consent === "all";

  useEffect(() => {
    if (!primaryGoogleId || googleIds.length === 0) return;

    const gtag = ensureGtag();
    gtag("consent", "update", consentSettings(hasMarketingConsent));
    for (const id of googleIds) {
      gtag("config", id, {
        page_location: safePageLocation(),
        page_path: window.location.pathname,
        page_title: document.title,
      });
    }
  }, [googleIds, hasMarketingConsent, primaryGoogleId]);

  return (
    <>
      {/* Google tag with Consent Mode. Google Ads uses this tag for conversion measurement. */}
      {primaryGoogleId && (
        <>
          <Script
            id="gtag-consent-default"
            strategy="afterInteractive"
          >{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}if(!window.__maGtagInitialized){gtag('consent','default',${JSON.stringify(
            consentSettings(false)
          )});gtag('js',new Date());window.__maGtagInitialized=true;}`}</Script>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${primaryGoogleId}`}
            strategy="afterInteractive"
          />
        </>
      )}

      {/* Facebook Pixel */}
      {hasMarketingConsent && FB_PIXEL_ID && (
        <Script id="fb-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${FB_PIXEL_ID}');fbq('track','PageView');`}</Script>
      )}

      {/* TikTok Pixel */}
      {hasMarketingConsent && TIKTOK_PIXEL_ID && (
        <Script id="tiktok-pixel" strategy="afterInteractive">{`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${TIKTOK_PIXEL_ID}');ttq.page();}(window,document,'ttq');`}</Script>
      )}
    </>
  );
}
