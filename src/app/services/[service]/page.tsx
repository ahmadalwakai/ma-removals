import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Box, Container, Heading, Text, VStack, HStack, SimpleGrid, Badge, Flex } from "@chakra-ui/react";
import Link from "next/link";
import { HiPhone, HiCheckCircle } from "react-icons/hi";
import { FaWhatsapp } from "react-icons/fa";
import { SERVICES, ALL_AREAS, SITE } from "@/lib/constants";
import { colors } from "@/lib/tokens";
import { CTAButton } from "@/components/ui/CTAButton";
import { Card } from "@/components/ui/Card";

interface PageProps {
  params: Promise<{ service: string }>;
}

export async function generateStaticParams() {
  return SERVICES.map((s) => ({ service: s.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { service: slug } = await params;
  const serviceData = SERVICES.find((s) => s.slug === slug);

  if (!serviceData) return {};

  const title = `${serviceData.name} Scotland | MA Removals`;
  const description = `Professional ${serviceData.name.toLowerCase()} service across Glasgow, Edinburgh & Dundee. Fully insured, fixed prices from £${serviceData.basePrice}. Book online or call ${SITE.phoneDisplay}.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE.url}/services/${slug}` },
    openGraph: { title, description, url: `${SITE.url}/services/${slug}` },
  };
}

export default async function ServicePage({ params }: PageProps) {
  const { service: slug } = await params;
  const serviceData = SERVICES.find((s) => s.slug === slug);

  if (!serviceData) notFound();

  const otherServices = SERVICES.filter((s) => s.slug !== slug).slice(0, 5);
  const primaryAreas = ALL_AREAS.filter((a) => a.region === "glasgow").slice(0, 8);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: serviceData.name,
    provider: {
      "@type": "LocalBusiness",
      name: SITE.name,
      telephone: SITE.phone,
      email: SITE.email,
    },
    areaServed: ["Glasgow", "Edinburgh", "Dundee"].map((city) => ({
      "@type": "City",
      name: city,
      addressCountry: "GB",
    })),
    offers: {
      "@type": "Offer",
      price: serviceData.basePrice,
      priceCurrency: "GBP",
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
            <Box asChild _hover={{ color: colors.emerald }}><Link href="/services">Services</Link></Box>
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
          backgroundImage={`radial-gradient(circle at 80% 30%, ${colors.amber} 0%, transparent 50%)`}
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
              {serviceData.icon} Professional service
            </Badge>
            <Heading
              as="h1"
              fontSize={{ base: "3xl", md: "4xl", lg: "5xl" }}
              fontWeight={800}
              color="white"
              lineHeight={1.1}
            >
              {serviceData.name} Across Scotland
            </Heading>
            <Text fontSize={{ base: "lg", md: "xl" }} color="rgba(255,255,255,0.65)" maxW="520px">
              Professional {serviceData.name.toLowerCase()} service across Glasgow, Edinburgh &amp; Dundee. Fully insured with fixed prices from{" "}
              <Text as="span" color={colors.emerald} fontFamily="mono" fontWeight={600}>
                £{serviceData.basePrice}
              </Text>
              .
            </Text>
            <HStack gap={4} flexWrap="wrap" justify={{ base: "start", md: "center" }}>
              <CTAButton href="/book" ctaVariant="primary" size="lg" px={8}>
                Book {serviceData.name}
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

      {/* Features */}
      <Box as="section" py={{ base: 14, md: 18 }} bg={colors.slate}>
        <Container maxW="4xl" px={{ base: 4, md: 6 }}>
          <VStack gap={8} align={{ base: "start", md: "center" }} textAlign={{ base: "left", md: "center" }}>
            <Heading as="h2" fontSize={{ base: "2xl", md: "3xl" }} fontWeight={800} color={colors.midnight}>
              What&apos;s included
            </Heading>
            <SimpleGrid columns={{ base: 1, sm: 2 }} gap={3} w="full">
              {[
                `Professional ${serviceData.name.toLowerCase()} team`,
                "Goods in Transit Insurance",
                `Fixed price from £${serviceData.basePrice}`,
                "7 days a week availability",
                "All equipment supplied",
                "Glasgow, Edinburgh & Dundee",
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

      {/* Areas for this service */}
      <Box as="section" py={{ base: 12, md: 16 }} bg={colors.surface}>
        <Container maxW="7xl" px={{ base: 4, md: 6 }}>
          <Heading as="h2" fontSize={{ base: "xl", md: "2xl" }} fontWeight={700} color={colors.midnight} mb={6}>
            {serviceData.name} by area
          </Heading>
          <Flex gap={3} flexWrap="wrap">
            {ALL_AREAS.map((area) => (
              <Box
                key={area.slug}
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
                <Link href={`/areas/${area.slug}/${slug}`}>{serviceData.name} in {area.name}</Link>
              </Box>
            ))}
          </Flex>
        </Container>
      </Box>

      {/* Other services */}
      <Box as="section" py={{ base: 10, md: 14 }} bg={colors.slate}>
        <Container maxW="7xl" px={{ base: 4, md: 6 }}>
          <Heading as="h2" fontSize={{ base: "xl", md: "2xl" }} fontWeight={700} color={colors.midnight} mb={6}>
            Other services
          </Heading>
          <Flex gap={3} flexWrap="wrap">
            {otherServices.map((s) => (
              <Box
                key={s.slug}
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
                <Link href={`/services/${s.slug}`}>{s.icon} {s.name}</Link>
              </Box>
            ))}
          </Flex>
        </Container>
      </Box>

      {/* Bottom CTA */}
      <Box bg={colors.emerald} py={{ base: 12, md: 16 }}>
        <Container maxW="3xl" px={{ base: 4, md: 6 }}>
          <VStack gap={5} textAlign="center">
            <Heading as="h2" fontSize={{ base: "2xl", md: "3xl" }} fontWeight={800} color="white">
              Ready to book your {serviceData.name.toLowerCase()}?
            </Heading>
            <Text fontSize="lg" color="rgba(255,255,255,0.85)">
              Fixed price, fully insured. Book in seconds.
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
