import type { Metadata } from "next";
import { Box, Container, Heading, Text, VStack, Badge } from "@chakra-ui/react";
import { SITE } from "@/lib/constants";
import { colors } from "@/lib/tokens";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "How MA Removals uses cookies and similar technologies on our website, the types of cookies we use, and how you can manage your preferences.",
  alternates: { canonical: `${SITE.url}/cookies` },
};

const LAST_UPDATED = "1 June 2026";

export default function CookiesPage() {
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
              Cookie Policy
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
              This Cookie Policy explains how {SITE.name} uses cookies and similar technologies on our website to
              recognise you when you visit, and how you can control them.
            </Text>

            <Section title="What are cookies?">
              <Para>
                Cookies are small text files placed on your device when you visit a website. They help the site work
                properly, remember your preferences, and provide information to the site owners about how visitors use
                their site.
              </Para>
            </Section>

            <Section title="Types of cookies we use">
              <List
                items={[
                  "Essential cookies — required for the website to function, such as remembering items in your booking and keeping the site secure. These cannot be switched off.",
                  "Analytics cookies — help us understand how visitors interact with our website so we can improve it. These collect anonymous, aggregated information.",
                  "Preference cookies — remember choices you make, such as cookie consent settings.",
                ]}
              />
            </Section>

            <Section title="Managing your preferences">
              <Para>
                When you first visit our website, we ask for your consent to use non-essential cookies. You can change
                or withdraw your consent at any time through your browser settings. Most browsers let you refuse or
                delete cookies — please note that disabling some cookies may affect how the website works.
              </Para>
            </Section>

            <Section title="Third-party cookies">
              <Para>
                Some cookies may be set by third-party services that appear on our pages, such as analytics or
                messaging providers. We do not control these cookies, so please refer to the relevant third
                party&apos;s own privacy and cookie policies for more information.
              </Para>
            </Section>

            <Section title="Changes to this policy">
              <Para>
                We may update this Cookie Policy from time to time. Any changes will be posted on this page with an
                updated &ldquo;last updated&rdquo; date.
              </Para>
            </Section>

            <Section title="Contact us">
              <Para>
                If you have any questions about our use of cookies, please contact us at {SITE.email} or{" "}
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
