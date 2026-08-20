import type { Metadata } from "next";
import {
  HeroSection,
  TrustBar,
  ServicesGrid,
  StatsBand,
  HowItWorksSection,
  WhyUsSection,
  GuaranteeBand,
  TestimonialsSection,
  AreasSection,
  FAQSection,
  FindUsSection,
  BottomCTASection,
} from "@/components/sections/HomePageSections";
import { SITE, FAQS } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description:
    "MA Removals — house moves, office relocations, and furniture deliveries across Glasgow, Edinburgh, and Dundee. Fixed prices, fully insured, book online in minutes.",
  alternates: {
    canonical: SITE.url,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "MovingCompany",
  "@id": `${SITE.url}/#organization`,
  name: SITE.name,
  alternateName: "M&A Removals",
  url: SITE.url,
  logo: `${SITE.url}/images/logo.png`,
  image: `${SITE.url}/images/hero/hero-01.jpg`,
  telephone: SITE.phone,
  email: SITE.email,
  priceRange: "££",
  description:
    "Professional removals across Glasgow, Edinburgh and Dundee. Fully insured house moves, van with man, office relocations and furniture deliveries with fixed prices.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Glasgow",
    addressRegion: "Scotland",
    addressCountry: "GB",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: SITE.maps.latitude,
    longitude: SITE.maps.longitude,
  },
  hasMap: SITE.maps.profileUrl,
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: SITE.maps.rating,
    reviewCount: SITE.maps.reviewCount,
    bestRating: 5,
    worstRating: 1,
  },
  areaServed: ["Glasgow", "Edinburgh", "Dundee", "Aberdeen", "Stirling", "Inverness", "Perth", "Paisley", "Falkirk", "Livingston", "Kilmarnock", "Ayr", "Dunfermline", "Kirkcaldy", "St Andrews", "Galashiels", "Dumfries", "Fort William", "Oban", "Scotland"].map(
    (name) => ({ "@type": "City", name })
  ),
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "06:00",
      closes: "22:00",
    },
  ],
  sameAs: [SITE.social.instagram, SITE.social.tiktok, SITE.social.facebook, SITE.maps.profileUrl],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE.url}/#website`,
  url: SITE.url,
  name: SITE.name,
  publisher: { "@id": `${SITE.url}/#organization` },
  inLanguage: "en-GB",
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE.url}/areas?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE.url}/#faq`,
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <HeroSection />
      <TrustBar />
      <ServicesGrid />
      <StatsBand />
      <HowItWorksSection />
      <WhyUsSection />
      <GuaranteeBand />
      <TestimonialsSection />
      <AreasSection />
      <FindUsSection />
      <FAQSection />
      <BottomCTASection />
    </>
  );
}
