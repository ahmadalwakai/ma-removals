import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Box, Container, Heading, Text, VStack, HStack, SimpleGrid, Badge, Flex } from "@chakra-ui/react";
import Link from "next/link";
import { HiPhone, HiCheckCircle } from "react-icons/hi";
import { FaWhatsapp } from "react-icons/fa";
import { ALL_AREAS, SERVICES, SITE } from "@/lib/constants";
import { colors } from "@/lib/tokens";
import { CTAButton } from "@/components/ui/CTAButton";
import { Card } from "@/components/ui/Card";

interface PageProps {
  params: Promise<{ area: string; service: string }>;
}

export async function generateStaticParams() {
  return ALL_AREAS.flatMap((area) =>
    SERVICES.map((service) => ({
      area: area.slug,
      service: service.slug,
    }))
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { area: areaSlug, service: serviceSlug } = await params;
  const areaData = ALL_AREAS.find((a) => a.slug === areaSlug);
  const serviceData = SERVICES.find((s) => s.slug === serviceSlug);

  if (!areaData || !serviceData) return {};

  const title = `${serviceData.name} in ${areaData.name} | MA Removals`;
  const description = `Professional ${serviceData.name.toLowerCase()} service in ${areaData.name}. Fully insured, fixed prices from £${serviceData.basePrice}. Book online or call ${SITE.phoneDisplay}.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE.url}/areas/${areaSlug}/${serviceSlug}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE.url}/areas/${areaSlug}/${serviceSlug}`,
    },
  };
}

export default async function AreaServicePage({ params }: PageProps) {
  const { area: areaSlug, service: serviceSlug } = await params;
  const areaData = ALL_AREAS.find((a) => a.slug === areaSlug);
  const serviceData = SERVICES.find((s) => s.slug === serviceSlug);

  if (!areaData || !serviceData) notFound();

  const otherServices = SERVICES.filter((s) => s.slug !== serviceSlug);
  const nearbyAreas = ALL_AREAS.filter(
    (a) => a.region === areaData.region && a.slug !== areaSlug
  ).slice(0, 6);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${serviceData.name} in ${areaData.name}`,
    provider: {
      "@type": "LocalBusiness",
      name: SITE.name,
      telephone: SITE.phone,
      email: SITE.email,
      address: {
        "@type": "PostalAddress",
        addressLocality: areaData.name,
        addressRegion: "Scotland",
        addressCountry: "GB",
      },
    },
    areaServed: {
      "@type": "City",
      name: areaData.name,
    },
    offers: {
      "@type": "Offer",
      price: serviceData.basePrice,
      priceCurrency: "GBP",
      priceSpecification: { "@type": "UnitPriceSpecification", price: serviceData.basePrice },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <Box bg={colors.midnight} borderBottom="1px solid rgba(255,255,255,0.06)" py={3}>
        <Container maxW="7xl" px={{ base: 4, md: 6 }}>
          <HStack gap={2} fontSize="sm" color="rgba(255,255,255,0.45)">
            <Box asChild _hover={{ color: colors.emerald }}><Link href="/">Home</Link></Box>
            <Text>/</Text>
            <Box asChild _hover={{ color: colors.emerald }}><Link href="/areas">Areas</Link></Box>
            <Text>/</Text>
            <Box asChild _hover={{ color: colors.emerald }}>
              <Link href={`/areas/${areaSlug}`}>{areaData.name}</Link>
            </Box>
            <Text>/</Text>
            <Text color="rgba(255,255,255,0.7)">{serviceData.name}</Text>
          </HStack>
        </Container>
      </Box>

      {/* Hero */}
      <Box
        bg={colors.midnight}
        pt={{ base: 12, md: 18 }}
        pb={{ base: 14, md: 20 }}
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
        <Container maxW="3xl" px={{ base: 4, md: 6 }} position="relative">
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
              {serviceData.icon} {serviceData.name}
            </Badge>
            <Heading
              as="h1"
              fontSize={{ base: "3xl", md: "4xl", lg: "5xl" }}
              fontWeight={800}
              color="white"
              lineHeight={1.1}
            >
              {serviceData.name} in {areaData.name}
            </Heading>
            <Text
              fontSize={{ base: "lg", md: "xl" }}
              color="rgba(255,255,255,0.65)"
              maxW="480px"
            >
              Professional {serviceData.name.toLowerCase()} service in {areaData.name}. Fully insured, fixed prices from{" "}
              <Text as="span" color={colors.emerald} fontFamily="mono" fontWeight={600}>
                £{serviceData.basePrice}
              </Text>
              . Book online or call us now.
            </Text>
            <HStack gap={4} flexWrap="wrap" justify={{ base: "start", md: "center" }}>
              <CTAButton href="/book" ctaVariant="primary" size="lg" px={8}>
                Book {serviceData.name} in {areaData.name}
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

      {/* What's included */}
      <Box as="section" py={{ base: 14, md: 18 }} bg={colors.slate}>
        <Container maxW="4xl" px={{ base: 4, md: 6 }}>
          <VStack gap={8} align={{ base: "start", md: "center" }} textAlign={{ base: "left", md: "center" }}>
            <Heading as="h2" fontSize={{ base: "2xl", md: "3xl" }} fontWeight={800} color={colors.midnight}>
              What&apos;s included with your {serviceData.name.toLowerCase()} in {areaData.name}
            </Heading>

            <SimpleGrid columns={{ base: 1, sm: 2 }} gap={3} w="full">
              {[
                `Experienced ${serviceData.name.toLowerCase()} team`,
                `Fully insured — Goods in Transit`,
                `Fixed price from £${serviceData.basePrice}`,
                `Available 7 days a week`,
                `All equipment provided`,
                `Covered across ${areaData.name} & surrounds`,
              ].map((item) => (
                <HStack key={item} gap={3} p={4} bg={colors.surface} borderRadius="xl" boxShadow="sm">
                  <HiCheckCircle size={18} color={colors.emerald} style={{ flexShrink: 0 }} />
                  <Text fontSize="sm" fontWeight={500} color={colors.ink}>{item}</Text>
                </HStack>
              ))}
            </SimpleGrid>
          </VStack>
        </Container>
      </Box>

      {/* Other services in this area */}
      <Box as="section" py={{ base: 12, md: 16 }} bg={colors.surface}>
        <Container maxW="7xl" px={{ base: 4, md: 6 }}>
          <Heading as="h2" fontSize={{ base: "xl", md: "2xl" }} fontWeight={700} color={colors.midnight} mb={6}>
            Other services in {areaData.name}
          </Heading>
          <Flex gap={3} flexWrap="wrap">
            {otherServices.map((s) => (
              <Box
                key={s.slug}
                asChild
                px={4}
                py={2}
                bg={colors.slate}
                borderRadius="full"
                fontSize="sm"
                fontWeight={500}
                color={colors.ink}
                border="1px solid rgba(0,0,0,0.06)"
                _hover={{
                  borderColor: colors.emerald,
                  color: colors.emerald,
                  textDecoration: "none",
                }}
                transition="all 0.15s"
              >
                <Link href={`/areas/${areaSlug}/${s.slug}`}>{s.icon} {s.name}</Link>
              </Box>
            ))}
          </Flex>
        </Container>
      </Box>

      {/* Nearby areas for this service */}
      {nearbyAreas.length > 0 && (
        <Box as="section" py={{ base: 10, md: 14 }} bg={colors.slate}>
          <Container maxW="7xl" px={{ base: 4, md: 6 }}>
            <Heading as="h2" fontSize={{ base: "xl", md: "2xl" }} fontWeight={700} color={colors.midnight} mb={6}>
              {serviceData.name} in nearby areas
            </Heading>
            <Flex gap={3} flexWrap="wrap">
              {nearbyAreas.map((a) => (
                <Box
                  key={a.slug}
                  asChild
                  px={4}
                  py={2}
                  bg={colors.surface}
                  borderRadius="full"
                  fontSize="sm"
                  fontWeight={500}
                  color={colors.ink}
                  border="1px solid rgba(0,0,0,0.06)"
                  _hover={{
                    borderColor: colors.emerald,
                    color: colors.emerald,
                    textDecoration: "none",
                  }}
                  transition="all 0.15s"
                >
                  <Link href={`/areas/${a.slug}/${serviceSlug}`}>{serviceData.name} in {a.name}</Link>
                </Box>
              ))}
            </Flex>
          </Container>
        </Box>
      )}

      {/* Bottom CTA */}
      <Box bg={colors.emerald} py={{ base: 12, md: 16 }}>
        <Container maxW="3xl" px={{ base: 4, md: 6 }}>
          <VStack gap={5} textAlign="center">
            <Heading as="h2" fontSize={{ base: "2xl", md: "3xl" }} fontWeight={800} color="white">
              Ready to book your {serviceData.name.toLowerCase()} in {areaData.name}?
            </Heading>
            <Text fontSize="lg" color="rgba(255,255,255,0.85)">
              Get your free quote in seconds. Fixed price, fully insured.
            </Text>
            <HStack gap={4} flexWrap="wrap" justify="center">
              <CTAButton
                href="/book"
                bg={colors.midnight}
                color="white"
                size="lg"
                px={8}
                _hover={{ bg: colors.ink }}
              >
                Book Now
              </CTAButton>
              <CTAButton
                href={`https://wa.me/${SITE.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                bg="rgba(255,255,255,0.15)"
                color="white"
                border="2px solid rgba(255,255,255,0.4)"
                size="lg"
                _hover={{ bg: "rgba(255,255,255,0.25)" }}
                display="flex"
                alignItems="center"
                gap={2}
              >
                <FaWhatsapp size={18} />
                WhatsApp
              </CTAButton>
            </HStack>
          </VStack>
        </Container>
      </Box>
    </>
  );
}
