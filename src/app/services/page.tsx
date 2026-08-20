import type { Metadata } from "next";
import { Box, Container, Heading, Text, VStack, SimpleGrid, Badge, HStack } from "@chakra-ui/react";
import Link from "next/link";
import { HiArrowRight } from "react-icons/hi";
import { SERVICES, SITE } from "@/lib/constants";
import { colors } from "@/lib/tokens";
import { Card } from "@/components/ui/Card";
import { CTAButton } from "@/components/ui/CTAButton";

export const metadata: Metadata = {
  title: "Our Services | MA Removals",
  description:
    "House moves, van with man, furniture removals, office relocations, piano moves and more. Professional removals across Scotland.",
  alternates: { canonical: `${SITE.url}/services` },
};

export default function ServicesIndexPage() {
  return (
    <>
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
              What we do
            </Badge>
            <Heading as="h1" fontSize={{ base: "3xl", md: "4xl", lg: "5xl" }} fontWeight={800} color="white">
              Every type of move. One company.
            </Heading>
            <Text fontSize={{ base: "lg", md: "xl" }} color="rgba(255,255,255,0.65)" maxW="480px">
              From a single item delivery to a full commercial relocation — we handle it all across Glasgow, Edinburgh and Dundee.
            </Text>
          </VStack>
        </Container>
      </Box>

      <Box as="section" py={{ base: 14, md: 18 }} bg={colors.slate}>
        <Container maxW="7xl" px={{ base: 4, md: 6 }}>
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={6}>
            {SERVICES.map((service) => (
              <Card
                key={service.slug}
                hover
                href={`/services/${service.slug}`}
                p={7}
                display="flex"
                flexDirection="column"
                gap={4}
                cursor="pointer"
                _hover={{ textDecoration: "none" }}
              >
                <Text fontSize="3xl">{service.icon}</Text>
                <VStack align="start" gap={2} flex={1}>
                  <Heading as="h2" fontFamily="heading" fontWeight={800} fontSize="xl" color={colors.midnight}>
                    {service.name}
                  </Heading>
                  <Text fontSize="sm" color={colors.muted} lineHeight="tall">
                    Professional {service.name.toLowerCase()} service across Glasgow, Edinburgh &amp; Dundee. Fully insured, fixed prices.
                  </Text>
                </VStack>
                <HStack justify="space-between" align="center">
                  <Text fontFamily="mono" fontWeight={600} fontSize="lg" color={colors.emerald}>
                    From £{service.basePrice}
                  </Text>
                  <HStack gap={1} color={colors.emerald}>
                    <Text fontSize="sm" fontWeight={600}>Book now</Text>
                    <HiArrowRight size={14} />
                  </HStack>
                </HStack>
              </Card>
            ))}
          </SimpleGrid>
        </Container>
      </Box>
    </>
  );
}
