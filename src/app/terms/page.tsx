import type { Metadata } from "next";
import { Box, Container, Heading, Text, VStack, Badge } from "@chakra-ui/react";
import { SITE } from "@/lib/constants";
import { colors } from "@/lib/tokens";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "The terms and conditions for using MA Removals services and website, covering quotes, bookings, payments, liability and insurance.",
  alternates: { canonical: `${SITE.url}/terms` },
};

const LAST_UPDATED = "1 June 2026";

export default function TermsPage() {
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
              Terms &amp; Conditions
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
            <Text fontSize={{ base: "md", md: "lg" }} color={colors.ink} lineHeight="tall">
              These Terms &amp; Conditions govern your use of the {SITE.name} website and the removals services we
              provide. By requesting a quote or booking a service, you agree to these terms.
            </Text>

            <Section title="1. Our services">
              <Para>
                {SITE.name} provides removals, deliveries and related services across Glasgow, Edinburgh, Dundee and
                surrounding areas. The scope of each job is as agreed at the time of booking.
              </Para>
            </Section>

            <Section title="2. Quotes and pricing">
              <Para>
                Quotes are based on the information you provide, including item lists, addresses and access details.
                If the actual job differs significantly from what was described — for example additional items,
                difficult access or extra time — the final price may be adjusted. We will always discuss any changes
                with you before proceeding where possible.
              </Para>
            </Section>

            <Section title="3. Bookings and cancellations">
              <Para>
                A booking is confirmed once you receive confirmation from us. If you need to cancel or reschedule,
                please give us as much notice as possible. Cancellations made at very short notice may incur a charge
                to cover costs already committed.
              </Para>
            </Section>

            <Section title="4. Payment">
              <Para>
                Payment is due as set out in your booking confirmation. We accept the payment methods shown at
                checkout. We reserve the right to withhold delivery of goods until payment has been received in full.
              </Para>
            </Section>

            <Section title="5. Your responsibilities">
              <List
                items={[
                  "Ensure items are ready and accessible at the agreed time.",
                  "Provide accurate information about items, addresses and access.",
                  "Obtain any necessary parking permits or access permissions.",
                  "Declare any items that are fragile, hazardous or of high value.",
                ]}
              />
            </Section>

            <Section title="6. Liability and insurance">
              <Para>
                We carry {SITE.insurance} covering your belongings while in transit, subject to the terms of that
                policy. We are not liable for damage caused by inherent defects in items, inadequate packing by the
                customer, or events outside our reasonable control. Claims should be reported to us promptly and in
                writing.
              </Para>
            </Section>

            <Section title="7. Items we cannot move">
              <Para>
                For safety and legal reasons, we may decline to move certain items, including hazardous materials,
                perishable goods, plants, and items prohibited by law. Please discuss any unusual items with us in
                advance.
              </Para>
            </Section>

            <Section title="8. Delays">
              <Para>
                We make every effort to arrive and complete jobs on time. However, we are not liable for delays caused
                by traffic, weather, access issues or other circumstances beyond our control.
              </Para>
            </Section>

            <Section title="9. Governing law">
              <Para>
                These terms are governed by the laws of Scotland, and any disputes will be subject to the exclusive
                jurisdiction of the Scottish courts.
              </Para>
            </Section>

            <Section title="10. Contact us">
              <Para>
                If you have any questions about these terms, please contact us at {SITE.email} or {SITE.phoneDisplay}.
              </Para>
            </Section>
          </VStack>
        </Container>
      </Box>
    </>
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
