import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Box, Container, Flex, Heading, Text, VStack, HStack, SimpleGrid, Badge } from "@chakra-ui/react";
import Link from "next/link";
import { HiPhone, HiCheckCircle, HiArrowRight } from "react-icons/hi";
import { FaWhatsapp } from "react-icons/fa";
import { ALL_AREAS, SERVICES, SITE, type Region } from "@/lib/constants";
import { colors } from "@/lib/tokens";
import { CTAButton } from "@/components/ui/CTAButton";
import { Card } from "@/components/ui/Card";

interface PageProps {
  params: Promise<{ area: string }>;
}

export async function generateStaticParams() {
  return ALL_AREAS.map((a) => ({ area: a.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { area: slug } = await params;
  const areaData = ALL_AREAS.find((a) => a.slug === slug);

  if (!areaData) return {};

  const title = `Removals in ${areaData.name} | MA Removals`;
  const description = `Professional furniture removals, house moves & van with man services in ${areaData.name}. Fully insured, fixed prices. Book online or call ${SITE.phoneDisplay}.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE.url}/areas/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE.url}/areas/${slug}`,
    },
  };
}

// Region display names
const REGION_LABELS: Record<Region, string> = {
  glasgow: "Glasgow & West Scotland",
  edinburgh: "Edinburgh, Lothians & Fife",
  stirling: "Stirling & Central Scotland",
  dundee: "Dundee, Perthshire & Angus",
  aberdeen: "Aberdeen & North East",
  highlands: "Highlands & Islands",
  borders: "Borders & Dumfries & Galloway",
};

export default async function AreaPage({ params }: PageProps) {
  const { area: slug } = await params;
  const areaData = ALL_AREAS.find((a) => a.slug === slug);

  if (!areaData) notFound();

  const nearbyAreas = ALL_AREAS.filter(
    (a) => a.region === areaData.region && a.slug !== slug
  ).slice(0, 8);

  const regionLabel = REGION_LABELS[areaData.region];

  // Structured data (JSON-LD)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: SITE.name,
    description: `Professional removals in ${areaData.name}`,
    telephone: SITE.phone,
    email: SITE.email,
    address: {
      "@type": "PostalAddress",
      addressLocality: areaData.name,
      addressRegion: "Scotland",
      addressCountry: "GB",
    },
    url: `${SITE.url}/areas/${slug}`,
    openingHours: "Mo-Su 06:00-22:00",
    priceRange: "££",
    areaServed: {
      "@type": "City",
      name: areaData.name,
    },
  };

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <Box
        bg={colors.midnight}
        pt={{ base: 14, md: 20 }}
        pb={{ base: 16, md: 22 }}
        position="relative"
        overflow="hidden"
      >
        <Box
          position="absolute"
          inset={0}
          opacity={0.03}
          backgroundImage={`radial-gradient(circle at 20% 50%, ${colors.emerald} 0%, transparent 60%)`}
          pointerEvents="none"
        />
        <Container maxW="4xl" px={{ base: 4, md: 6 }} position="relative">
          <VStack align={{ base: "start", md: "center" }} gap={5} textAlign={{ base: "left", md: "center" }}>
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
              {regionLabel}
            </Badge>
            <Heading
              as="h1"
              fontSize={{ base: "3xl", md: "4xl", lg: "5xl" }}
              fontWeight={800}
              color="white"
              lineHeight={1.15}
            >
              Removals in {areaData.name}
            </Heading>
            <Text
              fontSize={{ base: "lg", md: "xl" }}
              color="rgba(255,255,255,0.65)"
              maxW="520px"
            >
              Professional, fully insured furniture removals and house moves in {areaData.name} and surrounding areas. Fixed prices, book online today.
            </Text>
            <HStack gap={4} flexWrap="wrap" justify={{ base: "start", md: "center" }}>
              <CTAButton href="/book" ctaVariant="primary" size="lg" px={8}>
                Get a Free Quote
              </CTAButton>
              <CTAButton
                href={`tel:${SITE.phone}`}
                ctaVariant="ghost"
                size="lg"
                px={6}
                display="flex"
                alignItems="center"
                gap={2}
              >
                <HiPhone size={18} />
                {SITE.phoneDisplay}
              </CTAButton>
            </HStack>
          </VStack>
        </Container>
      </Box>

      {/* Services in this area */}
      <Box as="section" py={{ base: 14, md: 18 }} bg={colors.slate}>
        <Container maxW="7xl" px={{ base: 4, md: 6 }}>
          <VStack gap={3} mb={10} align={{ base: "start", md: "center" }} textAlign={{ base: "left", md: "center" }}>
            <Heading as="h2" fontSize={{ base: "2xl", md: "3xl" }} fontWeight={800} color={colors.midnight}>
              Our services in {areaData.name}
            </Heading>
            <Text fontSize="lg" color={colors.muted} maxW="480px">
              From a single item delivery to a full house move — we cover it all in {areaData.name}.
            </Text>
          </VStack>

          <SimpleGrid columns={{ base: 2, sm: 3, lg: 5 }} gap={4}>
            {SERVICES.map((service) => (
              <Card
                key={service.slug}
                hover
                href={`/areas/${slug}/${service.slug}`}
                p={5}
                display="flex"
                flexDirection="column"
                gap={3}
                cursor="pointer"
                _hover={{ textDecoration: "none" }}
              >
                <Text fontSize="2xl">{service.icon}</Text>
                <VStack align="start" gap={1}>
                  <Text fontFamily="heading" fontWeight={700} fontSize="sm" color={colors.ink} lineHeight="tight">
                    {service.name}
                  </Text>
                  <Text fontSize="xs" color={colors.muted}>From £{service.basePrice}</Text>
                </VStack>
                <HStack gap={1} color={colors.emerald} mt="auto">
                  <Text fontSize="xs" fontWeight={600}>Book</Text>
                  <HiArrowRight size={12} />
                </HStack>
              </Card>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* Why us — area specific */}
      <Box as="section" py={{ base: 14, md: 18 }} bg={colors.surface}>
        <Container maxW="4xl" px={{ base: 4, md: 6 }}>
          <VStack gap={6} align={{ base: "start", md: "center" }} textAlign={{ base: "left", md: "center" }}>
            <Heading as="h2" fontSize={{ base: "2xl", md: "3xl" }} fontWeight={800} color={colors.midnight}>
              Why choose MA Removals in {areaData.name}?
            </Heading>

            <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4} w="full">
              {[
                { icon: "🛡️", text: `Fully insured removals in ${areaData.name}` },
                { icon: "💰", text: "Fixed quotes — no hidden fees" },
                { icon: "⏰", text: "Available 7 days, 6am–10pm" },
                { icon: "🚛", text: "All van sizes — small to Luton" },
                { icon: "📍", text: `Local knowledge of ${areaData.name}` },
                { icon: "⭐", text: "5-star rated on Google" },
              ].map(({ icon, text }) => (
                <HStack key={text} gap={3} p={4} bg={colors.slate} borderRadius="xl">
                  <Text fontSize="xl" flexShrink={0}>{icon}</Text>
                  <Text fontSize="sm" fontWeight={500} color={colors.ink}>{text}</Text>
                </HStack>
              ))}
            </SimpleGrid>

            <HStack gap={4} flexWrap="wrap" justify={{ base: "start", md: "center" }}>
              <CTAButton href="/book" ctaVariant="primary" size="lg">
                Book Your Move in {areaData.name}
              </CTAButton>
              <CTAButton
                href={`https://wa.me/${SITE.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                ctaVariant="ghost"
                size="lg"
                display="flex"
                alignItems="center"
                gap={2}
              >
                <FaWhatsapp size={18} />
                WhatsApp Us
              </CTAButton>
            </HStack>
          </VStack>
        </Container>
      </Box>

      {/* Nearby areas */}
      {nearbyAreas.length > 0 && (
        <Box as="section" py={{ base: 12, md: 16 }} bg={colors.slate}>
          <Container maxW="7xl" px={{ base: 4, md: 6 }}>
            <VStack gap={3} mb={8} align={{ base: "start", md: "center" }} textAlign={{ base: "left", md: "center" }}>
              <Heading as="h2" fontSize={{ base: "xl", md: "2xl" }} fontWeight={700} color={colors.midnight}>
                Also covering nearby areas
              </Heading>
            </VStack>
            <Flex gap={3} flexWrap="wrap" justify={{ base: "start", md: "center" }}>
              {nearbyAreas.map((area) => (
                <Box
                  key={area.slug}
                  asChild
                  px={4}
                  py={2}
                  bg={colors.surface}
                  borderRadius="full"
                  fontSize="sm"
                  fontWeight={500}
                  color={colors.ink}
                  border="1px solid rgba(0,0,0,0.06)"
                  boxShadow="sm"
                  _hover={{
                    borderColor: colors.emerald,
                    color: colors.emerald,
                    textDecoration: "none",
                  }}
                  transition="all 0.15s"
                >
                  <Link href={`/areas/${area.slug}`}>Removals in {area.name}</Link>
                </Box>
              ))}
            </Flex>
          </Container>
        </Box>
      )}
    </>
  );
}
