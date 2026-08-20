import type { Metadata } from "next";
import { Box, Container, Heading, Text, VStack, SimpleGrid, Badge, Flex } from "@chakra-ui/react";
import Link from "next/link";
import { ALL_AREAS, SITE, type Region } from "@/lib/constants";
import { colors } from "@/lib/tokens";
import { Card } from "@/components/ui/Card";
import { CTAButton } from "@/components/ui/CTAButton";

export const metadata: Metadata = {
  title: "Removal Areas | MA Removals",
  description:
    "MA Removals serves Glasgow, Edinburgh, Dundee and all surrounding towns across Scotland. Find your area and get a free quote.",
  alternates: { canonical: `${SITE.url}/areas` },
};

const REGIONS: { key: Region; label: string; desc: string; icon: string }[] = [
  {
    key: "glasgow",
    label: "Glasgow & West Scotland",
    desc: "Glasgow, Paisley, East Kilbride, Hamilton, Lanarkshire, Renfrewshire, Dunbartonshire, Inverclyde and Ayrshire.",
    icon: "🏙️",
  },
  {
    key: "edinburgh",
    label: "Edinburgh, Lothians & Fife",
    desc: "Edinburgh, Leith, Livingston, the Lothians and across Fife — Dunfermline, Kirkcaldy, Glenrothes and St Andrews.",
    icon: "🏰",
  },
  {
    key: "stirling",
    label: "Stirling & Central Scotland",
    desc: "Stirling, Falkirk, Grangemouth, Alloa, Dunblane and the Forth Valley.",
    icon: "🌉",
  },
  {
    key: "dundee",
    label: "Dundee, Perthshire & Angus",
    desc: "Dundee, Perth, Arbroath, Montrose, Forfar and the wider Tayside area.",
    icon: "⚓",
  },
  {
    key: "aberdeen",
    label: "Aberdeen & North East",
    desc: "Aberdeen, Inverurie, Stonehaven, Peterhead, Fraserburgh and across Aberdeenshire and Moray.",
    icon: "🛢️",
  },
  {
    key: "highlands",
    label: "Highlands & Islands",
    desc: "Inverness, Fort William, Oban, Aviemore, Skye, the Western Isles, Orkney and Shetland.",
    icon: "🏔️",
  },
  {
    key: "borders",
    label: "Borders & Dumfries & Galloway",
    desc: "Galashiels, Hawick, Peebles, Kelso, Dumfries, Stranraer and the Scottish Borders.",
    icon: "🌲",
  },
];

export default function AreasIndexPage() {
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
              Coverage areas
            </Badge>
            <Heading as="h1" fontSize={{ base: "3xl", md: "4xl", lg: "5xl" }} fontWeight={800} color="white">
              We cover all of Scotland
            </Heading>
            <Text fontSize={{ base: "lg", md: "xl" }} color="rgba(255,255,255,0.65)" maxW="480px">
              Glasgow, Edinburgh, Dundee and every town in between. Click your area to see prices and book your move.
            </Text>
          </VStack>
        </Container>
      </Box>

      {/* Regions */}
      <Box as="section" py={{ base: 14, md: 18 }} bg={colors.slate}>
        <Container maxW="7xl" px={{ base: 4, md: 6 }}>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap={8}>
            {REGIONS.map(({ key, label, desc, icon }) => {
              const areas = ALL_AREAS.filter((a) => a.region === key);
              return (
                <Card key={key} p={7}>
                  <VStack align="start" gap={5}>
                    <Text fontSize="3xl">{icon}</Text>
                    <VStack align="start" gap={2}>
                      <Heading as="h2" fontSize="xl" fontWeight={800} color={colors.midnight}>
                        {label}
                      </Heading>
                      <Text fontSize="sm" color={colors.muted} lineHeight="tall">
                        {desc}
                      </Text>
                    </VStack>
                    <Flex gap={2} flexWrap="wrap">
                      {areas.map((area) => (
                        <Box
                          key={area.slug}
                          asChild
                          px={3}
                          py={1.5}
                          bg={colors.slate}
                          borderRadius="full"
                          fontSize="xs"
                          fontWeight={500}
                          color={colors.ink}
                          border="1px solid rgba(0,0,0,0.06)"
                          _hover={{
                            borderColor: colors.emerald,
                            color: colors.emerald,
                            textDecoration: "none",
                            bg: "rgba(16,185,129,0.05)",
                          }}
                          transition="all 0.15s"
                        >
                          <Link href={`/areas/${area.slug}`}>{area.name}</Link>
                        </Box>
                      ))}
                    </Flex>
                  </VStack>
                </Card>
              );
            })}
          </SimpleGrid>
        </Container>
      </Box>

      {/* CTA */}
      <Box bg={colors.midnight} py={{ base: 12, md: 16 }}>
        <Container maxW="3xl" px={{ base: 4, md: 6 }}>
          <VStack gap={5} textAlign="center">
            <Heading as="h2" fontSize={{ base: "2xl", md: "3xl" }} fontWeight={800} color="white">
              Don&apos;t see your area?
            </Heading>
            <Text fontSize="lg" color="rgba(255,255,255,0.65)">
              We cover the whole of Central Scotland. Give us a call or send a WhatsApp — we&apos;ll sort it.
            </Text>
            <CTAButton href="/book" ctaVariant="primary" size="lg" px={8}>
              Get a Free Quote
            </CTAButton>
          </VStack>
        </Container>
      </Box>
    </>
  );
}
