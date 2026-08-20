import type { Metadata } from "next";
import { Box, Container, Heading, Text, VStack, SimpleGrid, Badge, HStack } from "@chakra-ui/react";
import { HiCheckCircle } from "react-icons/hi";
import { SITE } from "@/lib/constants";
import { colors } from "@/lib/tokens";
import { Card } from "@/components/ui/Card";
import { CTAButton } from "@/components/ui/CTAButton";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "MA Removals is a fully insured, family-run removals company serving Glasgow, Edinburgh and Dundee. Fixed prices, professional movers, and care for every job.",
  alternates: { canonical: `${SITE.url}/about` },
};

const VALUES = [
  {
    title: "Fully Insured",
    desc: "Every move is covered by Goods in Transit Insurance, so your belongings are protected from pickup to delivery.",
    icon: "🛡️",
  },
  {
    title: "Fixed, Honest Pricing",
    desc: "Get an instant online quote with no hidden fees. The price you see is the price you pay.",
    icon: "💷",
  },
  {
    title: "Experienced Movers",
    desc: "Our team treats your home and possessions like their own — careful, efficient and reliable every time.",
    icon: "💪",
  },
  {
    title: "Scotland-Wide",
    desc: "From Glasgow and the west to Edinburgh, Dundee and everywhere in between, we know the roads and the routes.",
    icon: "🗺️",
  },
  {
    title: "7 Days a Week",
    desc: "Open 6am–10pm every day, including weekends and short-notice moves when you need us most.",
    icon: "📅",
  },
  {
    title: "Real Support",
    desc: "Speak to a real person by phone or WhatsApp. We answer quickly and we actually turn up.",
    icon: "📞",
  },
];

const STATS = [
  { value: "500+", label: "Moves completed" },
  { value: "5.0", label: "Average rating" },
  { value: "3", label: "Cities covered" },
  { value: "7", label: "Days a week" },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <Box bg={colors.midnight} pt={{ base: 14, md: 20 }} pb={{ base: 16, md: 22 }}>
        <Container maxW="3xl" px={{ base: 4, md: 6 }}>
          <VStack gap={5} align={{ base: "start", md: "center" }} textAlign={{ base: "left", md: "center" }}>
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
              About us
            </Badge>
            <Heading as="h1" fontSize={{ base: "3xl", md: "4xl", lg: "5xl" }} fontWeight={800} color="white">
              The removal company that actually shows up.
            </Heading>
            <Text fontSize={{ base: "lg", md: "xl" }} color="rgba(255,255,255,0.65)" maxW="540px">
              We started MA Removals because we were tired of unreliable, overpriced movers. Today we&apos;re the
              trusted choice for house moves, office relocations and deliveries across Glasgow, Edinburgh and Dundee.
            </Text>
          </VStack>
        </Container>
      </Box>

      {/* Stats */}
      <Box as="section" bg={colors.surface} py={{ base: 10, md: 12 }} borderBottom="1px solid rgba(0,0,0,0.05)">
        <Container maxW="5xl" px={{ base: 4, md: 6 }}>
          <SimpleGrid columns={{ base: 2, md: 4 }} gap={6}>
            {STATS.map((stat) => (
              <VStack key={stat.label} gap={1}>
                <Text fontFamily="heading" fontWeight={800} fontSize={{ base: "3xl", md: "4xl" }} color={colors.emerald}>
                  {stat.value}
                </Text>
                <Text fontSize="sm" color={colors.muted} textAlign="center">
                  {stat.label}
                </Text>
              </VStack>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* Story */}
      <Box as="section" py={{ base: 14, md: 18 }} bg={colors.slate}>
        <Container maxW="3xl" px={{ base: 4, md: 6 }}>
          <VStack align="start" gap={5}>
            <Heading as="h2" fontSize={{ base: "2xl", md: "3xl" }} fontWeight={800} color={colors.midnight}>
              Our story
            </Heading>
            <Text fontSize={{ base: "md", md: "lg" }} color={colors.ink} lineHeight="tall">
              MA Removals is a fully insured removals company built on a simple idea: moving day should be calm, not
              chaotic. Whether you&apos;re moving a single item, a one-bed flat, or relocating an entire office, you get
              the same careful, professional service and a clear fixed price agreed up front.
            </Text>
            <Text fontSize={{ base: "md", md: "lg" }} color={colors.ink} lineHeight="tall">
              We cover all of Central Scotland — Glasgow and the west, Edinburgh and the east, Dundee and the north —
              with local knowledge that keeps your move smooth and on schedule. From pianos to packing, deliveries to
              full house moves, if it fits through a door, we&apos;ll get it where it needs to go.
            </Text>
            <VStack align="start" gap={3} pt={2}>
              {[
                "Goods in Transit Insurance on every job",
                "Fixed quotes — no surprises on the day",
                "On-time, every time",
                "Real customer support, 7 days a week",
              ].map((item) => (
                <HStack key={item} gap={3} align="start">
                  <HiCheckCircle size={20} color={colors.emerald} style={{ flexShrink: 0, marginTop: 2 }} />
                  <Text fontSize="md" fontWeight={500} color={colors.ink}>
                    {item}
                  </Text>
                </HStack>
              ))}
            </VStack>
          </VStack>
        </Container>
      </Box>

      {/* Values */}
      <Box as="section" py={{ base: 14, md: 18 }} bg={colors.surface}>
        <Container maxW="7xl" px={{ base: 4, md: 6 }}>
          <VStack gap={3} mb={10} align={{ base: "start", md: "center" }} textAlign={{ base: "left", md: "center" }}>
            <Heading as="h2" fontSize={{ base: "2xl", md: "3xl" }} fontWeight={800} color={colors.midnight}>
              What we stand for
            </Heading>
            <Text fontSize="lg" color={colors.muted} maxW="520px">
              The values behind every move we make.
            </Text>
          </VStack>
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={6}>
            {VALUES.map((value) => (
              <Card key={value.title} p={6}>
                <VStack align="start" gap={3}>
                  <Text fontSize="3xl">{value.icon}</Text>
                  <Heading as="h3" fontFamily="heading" fontWeight={800} fontSize="lg" color={colors.midnight}>
                    {value.title}
                  </Heading>
                  <Text fontSize="sm" color={colors.muted} lineHeight="tall">
                    {value.desc}
                  </Text>
                </VStack>
              </Card>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* CTA */}
      <Box as="section" py={{ base: 14, md: 18 }} bg={colors.midnight}>
        <Container maxW="3xl" px={{ base: 4, md: 6 }}>
          <VStack gap={6} textAlign="center">
            <Heading as="h2" fontSize={{ base: "2xl", md: "4xl" }} fontWeight={800} color="white">
              Ready to move with a team you can trust?
            </Heading>
            <Text fontSize={{ base: "md", md: "lg" }} color="rgba(255,255,255,0.65)" maxW="460px">
              Get your free, fixed-price quote in under two minutes — no obligation.
            </Text>
            <HStack gap={4} flexWrap="wrap" justify="center">
              <CTAButton href="/book" ctaVariant="primary" size="lg" px={8} fontSize="md">
                Get a Free Quote
              </CTAButton>
              <CTAButton href="/contact" ctaVariant="ghost" size="lg" px={6} fontSize="md">
                Contact Us
              </CTAButton>
            </HStack>
          </VStack>
        </Container>
      </Box>
    </>
  );
}
