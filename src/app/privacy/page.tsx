import type { Metadata } from "next";
import { Box, Container, Heading, Text, VStack, Badge } from "@chakra-ui/react";
import { SITE } from "@/lib/constants";
import { colors } from "@/lib/tokens";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How MA Removals collects, uses and protects your personal data. Read our privacy policy covering bookings, contact details, cookies and your rights under UK GDPR.",
  alternates: { canonical: `${SITE.url}/privacy` },
};

const LAST_UPDATED = "1 June 2026";

export default function PrivacyPage() {
  return (
    <>
      <Box bg={colors.midnight} pt={{ base: 14, md: 20 }} pb={{ base: 12, md: 16 }}>
        <Container maxW="3xl" px={{ base: 4, md: 6 }}>
          <VStack gap={4} align={{ base: "start", md: "center" }} textAlign={{ base: "left", md: "center" }}>
            <Badge
              bg="rgba(16,185,129,0.1)"
              color={colors.emerald}
              borderRadius="full"
              px={4}
              py={1.5}
              fontSize="xs"
              fontWeight={600}
              letterSpacing="0.5px"
              textTransform="uppercase"
            >
              Legal
            </Badge>
            <Heading as="h1" fontSize={{ base: "3xl", md: "4xl", lg: "5xl" }} fontWeight={800} color="white">
              Privacy Policy
            </Heading>
            <Text fontSize="sm" color="rgba(255,255,255,0.5)">
              Last updated: {LAST_UPDATED}
            </Text>
          </VStack>
        </Container>
      </Box>

      <Box as="section" py={{ base: 12, md: 16 }} bg={colors.surface}>
        <Container maxW="3xl" px={{ base: 4, md: 6 }}>
          <VStack align="start" gap={8}>
            <LegalIntro>
              This Privacy Policy explains how {SITE.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;)
              collects, uses and protects your personal data when you use our website, request a quote, or book a
              removals service. We are committed to protecting your privacy and complying with the UK General Data
              Protection Regulation (UK GDPR) and the Data Protection Act 2018.
            </LegalIntro>

            <Section title="Who we are">
              <Para>
                {SITE.name} is a removals company based in {SITE.address}. For any privacy-related queries, you can
                contact us by email at {SITE.email} or by phone on {SITE.phoneDisplay}.
              </Para>
            </Section>

            <Section title="Information we collect">
              <Para>We may collect and process the following information:</Para>
              <List
                items={[
                  "Contact details — your name, email address and phone number.",
                  "Booking details — pickup and delivery addresses, move date, property type, and a list of items to be moved.",
                  "Communications — messages you send us by phone, WhatsApp, email or our online forms.",
                  "Payment information — processed securely by our payment provider; we do not store full card details.",
                  "Technical data — IP address, browser type, device information and pages visited, collected via cookies and analytics.",
                ]}
              />
            </Section>

            <Section title="How we use your information">
              <Para>We use your personal data to:</Para>
              <List
                items={[
                  "Provide quotes and carry out the removals services you request.",
                  "Communicate with you about your booking, including confirmations and updates.",
                  "Process payments and issue invoices.",
                  "Improve our website, services and customer experience.",
                  "Comply with our legal and regulatory obligations.",
                ]}
              />
            </Section>

            <Section title="Legal basis for processing">
              <Para>
                We process your data on the basis of performance of a contract (to deliver the service you book),
                your consent (for marketing and non-essential cookies), and our legitimate interests (to operate and
                improve our business), as well as to comply with legal obligations.
              </Para>
            </Section>

            <Section title="Sharing your information">
              <Para>
                We do not sell your personal data. We may share it with trusted third parties who help us run our
                business — such as our drivers, payment processors, email and messaging providers, and analytics
                services — strictly for the purposes described above. We may also disclose information where required
                by law.
              </Para>
            </Section>

            <Section title="Data retention">
              <Para>
                We keep your personal data only for as long as necessary to fulfil the purposes we collected it for,
                including to satisfy any legal, accounting or reporting requirements. Booking and invoice records are
                typically retained for up to 7 years in line with UK tax law.
              </Para>
            </Section>

            <Section title="Your rights">
              <Para>Under UK GDPR, you have the right to:</Para>
              <List
                items={[
                  "Access the personal data we hold about you.",
                  "Request correction of inaccurate or incomplete data.",
                  "Request erasure of your data in certain circumstances.",
                  "Object to or restrict our processing of your data.",
                  "Request a copy of your data in a portable format.",
                  "Withdraw consent at any time where processing is based on consent.",
                ]}
              />
              <Para>
                To exercise any of these rights, contact us at {SITE.email}. You also have the right to lodge a
                complaint with the Information Commissioner&apos;s Office (ICO) at ico.org.uk.
              </Para>
            </Section>

            <Section title="Cookies">
              <Para>
                Our website uses cookies to function correctly and to understand how visitors use the site. You can
                manage your preferences at any time. For full details, please see our Cookie Policy.
              </Para>
            </Section>

            <Section title="Changes to this policy">
              <Para>
                We may update this Privacy Policy from time to time. Any changes will be posted on this page with an
                updated &ldquo;last updated&rdquo; date.
              </Para>
            </Section>

            <Section title="Contact us">
              <Para>
                If you have any questions about this Privacy Policy or how we handle your data, please contact us at{" "}
                {SITE.email} or {SITE.phoneDisplay}.
              </Para>
            </Section>
          </VStack>
        </Container>
      </Box>
    </>
  );
}

function LegalIntro({ children }: { children: React.ReactNode }) {
  return (
    <Text fontSize={{ base: "md", md: "lg" }} color={colors.ink} lineHeight="tall">
      {children}
    </Text>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <VStack align="start" gap={3} w="full">
      <Heading as="h2" fontSize={{ base: "xl", md: "2xl" }} fontWeight={800} color={colors.midnight}>
        {title}
      </Heading>
      {children}
    </VStack>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return (
    <Text fontSize="md" color={colors.ink} lineHeight="tall">
      {children}
    </Text>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <VStack as="ul" align="start" gap={2} pl={5} w="full" style={{ listStyleType: "disc" }}>
      {items.map((item) => (
        <Text as="li" key={item} fontSize="md" color={colors.ink} lineHeight="tall">
          {item}
        </Text>
      ))}
    </VStack>
  );
}
