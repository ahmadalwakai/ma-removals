import type { Metadata } from "next";
import { Box, Container, Heading, Text, VStack, Badge } from "@chakra-ui/react";
import { SITE } from "@/lib/constants";
import { colors } from "@/lib/tokens";

export const metadata: Metadata = {
  title: "Cancellation Policy",
  description:
    "MA Removals cancellation policy. Free cancellation up to 48 hours before your booking. Cancellations within 48 hours are charged at 25% of the booking fee.",
  alternates: { canonical: `${SITE.url}/cancellation` },
};

const LAST_UPDATED = "1 June 2026";

export default function CancellationPage() {
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
              Cancellation Policy
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
              We understand that plans can change. This policy explains how cancellations work for bookings made with{" "}
              {SITE.name}, including any charges that may apply.
            </Text>

            {/* Highlight card */}
            <Box
              w="full"
              bg={colors.slate}
              border="1px solid rgba(16,185,129,0.2)"
              borderLeft={`4px solid ${colors.emerald}`}
              borderRadius="xl"
              p={{ base: 5, md: 6 }}
            >
              <VStack align="start" gap={3}>
                <Heading as="h2" fontSize={{ base: "lg", md: "xl" }} fontWeight={800} color={colors.midnight}>
                  At a glance
                </Heading>
                <Text fontSize="md" color={colors.ink} lineHeight="tall">
                  <Text as="span" fontWeight={700} color={colors.emerald}>
                    Free cancellation
                  </Text>{" "}
                  up to <Text as="span" fontWeight={700}>48 hours</Text>{" "}
                  before your booking&apos;s scheduled date and time.
                </Text>
                <Text fontSize="md" color={colors.ink} lineHeight="tall">
                  Cancellations made <Text as="span" fontWeight={700}>within 48 hours</Text> of the booking are charged
                  at <Text as="span" fontWeight={700}>25% of the booking fee</Text>.
                </Text>
              </VStack>
            </Box>

            <Section title="Free cancellation">
              <Para>
                You can cancel your booking free of charge at any time up to 48 hours before the scheduled date and
                time of your move. No cancellation fee will apply, and any deposit paid will be refunded in full.
              </Para>
            </Section>

            <Section title="Cancellations within 48 hours">
              <Para>
                If you cancel within 48 hours of your booking&apos;s scheduled date and time, a cancellation charge of
                25% of the total booking fee will apply. This helps cover the cost of the time slot and resources we
                have reserved for your move.
              </Para>
            </Section>

            <Section title="How to cancel">
              <Para>
                To cancel or amend your booking, please contact us as soon as possible by phone on {SITE.phoneDisplay},
                by WhatsApp, or by email at {SITE.email}. The cancellation takes effect from the time we receive your
                request, so earlier notice always helps you avoid charges.
              </Para>
            </Section>

            <Section title="Rescheduling">
              <Para>
                Where possible, we&apos;re happy to reschedule your move to a new date instead of cancelling. If you
                let us know at least 48 hours in advance, rescheduling is free of charge, subject to availability.
              </Para>
            </Section>

            <Section title="Refunds">
              <Para>
                Any refund due will be processed using your original payment method. Refunds are typically completed
                within 5–10 business days, depending on your bank or card provider.
              </Para>
            </Section>

            <Section title="Cancellations by us">
              <Para>
                In the rare event that we need to cancel your booking — for example due to circumstances beyond our
                control — we will contact you as soon as possible and offer you an alternative date or a full refund.
              </Para>
            </Section>

            <Section title="Contact us">
              <Para>
                If you have any questions about this Cancellation Policy, please contact us at {SITE.email} or{" "}
                {SITE.phoneDisplay}.
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
