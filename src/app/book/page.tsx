import type { Metadata } from "next";
import { InstantQuotePage } from "@/components/booking/InstantQuotePage";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Book Your Removal",
  description:
    "Book your removal online. Get an instant quote for house moves, van with man, deliveries and more across Scotland.",
  alternates: { canonical: `${SITE.url}/book` },
  openGraph: {
    title: "Book Your Removal | MA Removals",
    description:
      "Book your removal online. Get an instant quote for house moves, van with man, deliveries and more across Scotland.",
    url: `${SITE.url}/book`,
  },
};

export default function BookPage() {
  return <InstantQuotePage />;
}


