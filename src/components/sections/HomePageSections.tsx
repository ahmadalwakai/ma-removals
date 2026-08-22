"use client";

import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  VStack,
  HStack,
  SimpleGrid,
  Badge,
} from "@chakra-ui/react";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { staggerContainer, staggerContainerFast, fadeRise, scaleIn } from "@/lib/motion";
import { HiPhone, HiArrowRight, HiCheckCircle, HiChevronDown, HiLocationMarker, HiShieldCheck, HiCurrencyPound, HiClock, HiCalendar, HiTruck, HiUsers, HiMap, HiAnnotation, HiDeviceMobile } from "react-icons/hi";
import { FaWhatsapp, FaStar } from "react-icons/fa";
import { colors, shadows } from "@/lib/tokens";
import { SITE, SERVICES, ALL_AREAS, FAQS } from "@/lib/constants";
import { trackContact } from "@/lib/analytics";
import { CTAButton } from "@/components/ui/CTAButton";
import { Card } from "@/components/ui/Card";

const MotionBox = motion.create(Box);
const MotionFlex = motion.create(Flex);
const MotionSimpleGrid = motion.create(SimpleGrid);

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

const WHY_US = [
  {
    title: "Fully Insured",
    desc: "Every job is covered by Goods in Transit Insurance. Your belongings are protected.",
    Icon: HiShieldCheck,
    color: "#2563EB",
  },
  {
    title: "Fixed Prices",
    desc: "Get an instant online quote. No hidden fees, no surprises on the day.",
    Icon: HiCurrencyPound,
    color: "#10B981",
  },
  {
    title: "Experienced Team",
    desc: "Professional movers who treat your items like their own. Fast, careful, reliable.",
    Icon: HiUsers,
    color: "#F59E0B",
  },
  {
    title: "Book Online 24/7",
    desc: "Our booking system is always open. Pick a date, get a price, confirm in seconds.",
    Icon: HiDeviceMobile,
    color: "#8B5CF6",
  },
  {
    title: "All Scotland",
    desc: "Glasgow, Edinburgh, Dundee and everywhere in between. Local knowledge matters.",
    Icon: HiMap,
    color: "#EF4444",
  },
  {
    title: "Real-Time Tracking",
    desc: "Know exactly where your driver is. Live updates from pickup to delivery.",
    Icon: HiLocationMarker,
    color: "#2563EB",
  },
];

const TESTIMONIALS = [
  {
    name: "Kuldip Dhesi",
    location: "Trustpilot · Apr 2026",
    rating: 5,
    text: "We used this company today and I was so delighted I had to write a review. Mo and his colleague provided a first class professional service. They were polite, courteous and very careful with our furniture.",
  },
  {
    name: "Ahmmad Alfatih",
    location: "Trustpilot · Nov 2025",
    rating: 5,
    text: "They are life savers. I was in a really bad situation and had to clear the apartment. MA Removals turned up with the right van, took everything in one go and saved the day. Absolutely brilliant.",
  },
  {
    name: "Kathiyawadi in UK",
    location: "Trustpilot · Nov 2024",
    rating: 5,
    text: "Mohamad and team were absolute champions. They took great care of our things, moved everything fast, and had great communication throughout the process. Really happy — they made our move so much easier.",
  },
  {
    name: "Giulio",
    location: "Trustpilot · Jun 2024",
    rating: 5,
    text: "I had MA Removals move my belongings within the city and the service was excellent. They were really friendly and professional, handled everything with care and I don't have any complaints.",
  },
  {
    name: "Sarah M.",
    location: "Glasgow",
    rating: 5,
    text: "Absolutely brilliant service. The lads were professional, fast and careful with everything. Would 100% recommend to anyone moving in Glasgow.",
  },
  {
    name: "James K.",
    location: "Edinburgh",
    rating: 5,
    text: "Used MA Removals for my office move. Seamless from start to finish. The online booking made it so easy and the price was very fair.",
  },
  {
    name: "Priya S.",
    location: "Dundee",
    rating: 5,
    text: "They moved my piano — something every other company refused to do. Careful, professional, and on time. Brilliant.",
  },
];

const STATS = [
  { value: "500+", label: "Moves completed" },
  { value: "5.0★", label: "Average rating" },
  { value: "7", label: "Days a week" },
  { value: "100%", label: "Fully insured" },
];

const STEPS = [
  {
    step: "1",
    title: "Get your instant quote",
    desc: "Tell us what you're moving and where. Our online calculator gives you a fixed price in under 2 minutes — no waiting for a callback.",
    Icon: HiAnnotation,
    color: "#2563EB",
  },
  {
    step: "2",
    title: "Pick your date & confirm",
    desc: "Choose a slot that suits you, 7 days a week. Pay securely online or on the day. Instant confirmation straight to your inbox.",
    Icon: HiCalendar,
    color: "#10B981",
  },
  {
    step: "3",
    title: "We handle the move",
    desc: "Our insured team arrives on time, loads carefully and gets everything there safely. Track your driver live from pickup to drop-off.",
    Icon: HiTruck,
    color: "#8B5CF6",
  },
];

const HOME_SERVICE_CARDS = [
  {
    label: "Home removals",
    href: "/book",
    image: "/images/hero/hero-47.jpg",
    span: 3,
  },
  {
    label: "Furniture",
    href: "/book",
    image: "/images/items/Living_room_Furniture/armchair_rolled_accent_set_2_jpg_42kg.jpg",
    span: 3,
  },
  {
    label: "Man & van",
    href: "/book",
    image: "/images/hero/hero-40.jpg",
    span: 2,
  },
  {
    label: "Student moves",
    href: "/book",
    image: "/images/hero/hero-41.jpg",
    span: 2,
  },
  {
    label: "Other",
    href: "/book",
    image: "/images/hero/hero-46.jpg",
    span: 2,
  },
] as const;

const RECENT_MOVES = [
  {
    title: "Furniture move",
    from: "Glasgow",
    to: "Johnstone",
    image: "/images/items/Antiques_Collectibles/buffet_vintage_sideboard_jpg_85kg.jpg",
  },
  {
    title: "2-bed house move",
    from: "Paisley",
    to: "Edinburgh",
    image: "/images/hero/hero-45.jpg",
  },
  {
    title: "Single item",
    from: "Dundee",
    to: "Perth",
    image: "/images/items/Living_room_Furniture/chesterfield_sofa_2_seat_antique_tan_jpg_55kg.jpg",
  },
  {
    title: "Student move",
    from: "Stirling",
    to: "Glasgow",
    image: "/images/hero/hero-43.jpg",
  },
] as const;

const GUARANTEE_POINTS = [
  { Icon: HiShieldCheck,   title: "Goods in Transit Insurance", desc: "Covered on every single job",        color: "#2563EB" },
  { Icon: HiCurrencyPound, title: "Fixed-price guarantee",      desc: "The quote is the price — no extras", color: "#10B981" },
  { Icon: HiClock,         title: "On-time promise",            desc: "We turn up when we say we will",    color: "#F59E0B" },
  { Icon: HiLocationMarker,title: "Live driver tracking",       desc: "Know exactly where your van is",    color: "#8B5CF6" },
];

function IconBox({
  Icon,
  color,
  size = 20,
}: {
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  size?: number;
}) {
  return (
    <Box
      w={12}
      h={12}
      borderRadius="xl"
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
      style={{
        background: `linear-gradient(135deg, ${color}28, ${color}10)`,
        border: `1px solid ${color}35`,
        boxShadow: `0 0 0 1px ${color}12, 0 4px 14px ${color}18`,
      }}
    >
      <Icon size={size} color={color} />
    </Box>
  );
}

function HomeServiceCard({ card }: { card: (typeof HOME_SERVICE_CARDS)[number] }) {
  return (
    <Box
      asChild
      className="ma-ambient-card"
      gridColumn={{ base: "auto", md: `span ${card.span}` }}
      minW={{ base: "216px", md: "0" }}
      h={{ base: "174px", md: card.span === 3 ? "228px" : "184px" }}
      borderRadius="8px"
      overflow="hidden"
      bg="white"
      boxShadow="0 8px 20px rgba(11,17,32,0.14)"
      textDecoration="none"
      _hover={{ transform: "translateY(-2px)", boxShadow: "0 14px 28px rgba(11,17,32,0.18)" }}
      transition="all 0.18s ease"
    >
      <Link href={card.href} aria-label={`Book ${card.label}`}>
        <Box h="calc(100% - 54px)" bg="#F5B018" position="relative">
          <Image
            src={card.image}
            alt=""
            fill
            sizes="(max-width: 768px) 216px, 360px"
            style={{ objectFit: "cover" }}
            priority={card.label === "Home removals"}
          />
        </Box>
        <Flex h="54px" px={4} align="center" justify="space-between" bg="white">
          <Text color="#112033" fontWeight={800} fontSize={{ base: "md", md: "lg" }}>
            {card.label}
          </Text>
          <Box
            w="28px"
            h="28px"
            borderRadius="full"
            bg="#111827"
            color="white"
            display="flex"
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <HiArrowRight size={15} />
          </Box>
        </Flex>
      </Link>
    </Box>
  );
}

export function HeroSection() {
  return (
    <Box as="section" bg="#2563EB" overflow="hidden" position="relative">
      <Container maxW="7xl" px={{ base: 4, md: 6 }} py={{ base: 8, md: 12, lg: 14 }}>
        <Flex
          direction={{ base: "column", lg: "row" }}
          align={{ base: "stretch", lg: "center" }}
          gap={{ base: 8, lg: 12 }}
        >
          <VStack align="start" gap={5} flex="0 0 36%" color="white">
            <MotionBox initial="hidden" animate="visible" custom={0} variants={fadeUp}>
              <Heading
                className="ma-text-reveal"
                as="h1"
                fontSize={{ base: "4xl", md: "5xl", lg: "64px" }}
                fontWeight={900}
                lineHeight={0.96}
                letterSpacing="0"
                maxW="420px"
              >
                <Box as="span" className="ma-hero-line">
                  Let&apos;s get your
                </Box>
                <Box as="span" className="ma-hero-line ma-hero-line--late">
                  move on
                </Box>
              </Heading>
            </MotionBox>

            <MotionBox initial="hidden" animate="visible" custom={1} variants={fadeUp}>
              <Text className="ma-text-reveal ma-text-reveal--later" fontSize={{ base: "lg", md: "xl" }} lineHeight={1.5} maxW="430px" color="rgba(255,255,255,0.92)">
                Find a price that&apos;s right up your street, with clear booking and secure online payment.
              </Text>
            </MotionBox>

            <MotionBox initial="hidden" animate="visible" custom={2} variants={fadeUp}>
              <ChakraHeroLink href="/booking/track" label="Already received a quote?" />
            </MotionBox>

            <MotionBox initial="hidden" animate="visible" custom={3} variants={fadeUp}>
              <HStack
                gap={3}
                bg="rgba(255,255,255,0.16)"
                border="1px solid rgba(255,255,255,0.28)"
                borderRadius="full"
                px={4}
                py={2.5}
                flexWrap="wrap"
              >
                <Text fontSize="sm" fontWeight={800} color="white">
                  Google
                </Text>
                <HStack gap="2px">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <FaStar key={i} size={13} color={i < Math.round(SITE.maps.rating) ? "#FFB900" : "rgba(255,255,255,0.5)"} />
                  ))}
                </HStack>
                <Text fontSize="sm" fontWeight={700} color="white">
                  {SITE.maps.rating.toFixed(1)}
                </Text>
              </HStack>
            </MotionBox>
          </VStack>

          <MotionBox
            flex={1}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.55 }}
          >
            <Box
              display={{ base: "flex", md: "grid" }}
              gridTemplateColumns={{ md: "repeat(6, minmax(0, 1fr))" }}
              gap={4}
              overflowX={{ base: "auto", md: "visible" }}
              pb={{ base: 2, md: 0 }}
              scrollSnapType={{ base: "x mandatory", md: "none" }}
              css={{
                "& > a": { scrollSnapAlign: "start" },
                "&::-webkit-scrollbar": { height: "6px" },
                "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.4)", borderRadius: "999px" },
              }}
            >
              {HOME_SERVICE_CARDS.map((card) => (
                <HomeServiceCard key={card.label} card={card} />
              ))}
            </Box>
          </MotionBox>
        </Flex>
      </Container>
    </Box>
  );
}

function ChakraHeroLink({ href, label }: { href: string; label: string }) {
  return (
    <Box
      asChild
      display="inline-flex"
      alignItems="center"
      gap={2}
      color="white"
      fontWeight={800}
      textDecoration="underline"
      textUnderlineOffset="4px"
      _hover={{ color: "#FFE7A3" }}
    >
      <Link href={href}>
        <Text as="span">{label}</Text>
        <HiArrowRight size={16} />
      </Link>
    </Box>
  );
}

function RecentMoveCard({ move }: { move: (typeof RECENT_MOVES)[number] }) {
  return (
    <Box
      className="ma-ambient-card ma-lift-on-hover"
      bg="white"
      border="1px solid #DCE7EF"
      borderRadius="8px"
      overflow="hidden"
      minW={{ base: "250px", md: "0" }}
      boxShadow="0 2px 8px rgba(11,17,32,0.06)"
    >
      <Box position="relative" h="138px" bg="#F2B31A">
        <Image
          src={move.image}
          alt=""
          fill
          sizes="(max-width: 768px) 250px, 280px"
          style={{ objectFit: "cover" }}
        />
      </Box>
      <VStack align="stretch" gap={3} p={4}>
        <VStack align="start" gap={0}>
          <Text fontWeight={800} color="#13253A">
            {move.title}
          </Text>
          <Text fontSize="sm" color={colors.muted}>
            {move.from} to {move.to}
          </Text>
        </VStack>
        <HStack gap={2} color="#2563EB" fontSize="sm" fontWeight={800}>
          <HiTruck size={17} />
          <Text>Recent completed move</Text>
        </HStack>
      </VStack>
    </Box>
  );
}

export function TrustBar() {
  return (
    <Box as="section" bg="#F4F9FC" py={{ base: 10, md: 12 }} borderBottom="1px solid #DCE7EF">
      <Container maxW="7xl" px={{ base: 4, md: 6 }}>
        <Flex
          align={{ base: "start", md: "end" }}
          justify="space-between"
          gap={5}
          direction={{ base: "column", md: "row" }}
          mb={6}
        >
          <VStack align="start" gap={2}>
            <Heading as="h2" fontSize={{ base: "2xl", md: "4xl" }} color="#13253A" fontWeight={900} letterSpacing="0">
              Recent moves and reviews
            </Heading>
            <Text color={colors.muted} fontSize={{ base: "md", md: "lg" }}>
              Local move examples with simple, fixed online pricing.
            </Text>
          </VStack>
          <CTAButton href="/book" ctaVariant="primary" size="md" px={6}>
            Get prices
          </CTAButton>
        </Flex>

        <Box
          display={{ base: "flex", lg: "grid" }}
          gridTemplateColumns={{ lg: "repeat(4, minmax(0, 1fr))" }}
          gap={4}
          overflowX={{ base: "auto", lg: "visible" }}
          pb={{ base: 2, lg: 0 }}
        >
          {RECENT_MOVES.map((move) => (
            <RecentMoveCard key={`${move.from}-${move.to}`} move={move} />
          ))}
        </Box>
      </Container>
    </Box>
  );
}

export function ServicesGrid() {
  return (
    <Box as="section" py={{ base: 16, md: 20 }} bg={colors.slate}>
      <Container maxW="7xl" px={{ base: 4, md: 6 }}>
        <VStack gap={3} mb={12} align={{ base: "start", md: "center" }} textAlign={{ base: "left", md: "center" }}>
          <Badge
            bg="rgba(37,99,235,0.1)"
            color={colors.emerald}
            borderRadius="full"
            px={4}
            py={1}
            fontSize="xs"
            fontWeight={600}
            letterSpacing="0.5px"
            textTransform="uppercase"
          >
            What we do
          </Badge>
          <Heading as="h2" fontSize={{ base: "3xl", md: "4xl" }} fontWeight={800} color={colors.midnight}>
            Every type of move. One company.
          </Heading>
          <Text fontSize="lg" color={colors.muted} maxW="520px">
            From single-item deliveries to full commercial relocations — we handle it all with the same care and professionalism.
          </Text>
        </VStack>

        <MotionSimpleGrid
          columns={{ base: 2, sm: 3, lg: 5 }}
          gap={4}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={staggerContainer}
        >
          {SERVICES.map((service) => (
            <MotionBox
              key={service.slug}
              variants={fadeRise}
              whileHover={{ y: -6, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                hover
                href={`/services/${service.slug}`}
                p={5}
                display="flex"
                flexDirection="column"
                gap={3}
                cursor="pointer"
                _hover={{ textDecoration: "none" }}
              >
                <motion.div
                  whileHover={{ y: -2, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  style={{ display: "inline-flex" }}
                >
                  <Text fontSize="2xl">{service.icon}</Text>
                </motion.div>
                <VStack align="start" gap={1}>
                  <Text
                    fontFamily="heading"
                    fontWeight={700}
                    fontSize="sm"
                    color={colors.ink}
                    lineHeight="tight"
                  >
                    {service.name}
                  </Text>
                  <Text fontSize="xs" color={colors.muted}>
                    From £{service.basePrice}
                  </Text>
                </VStack>
                <HStack gap={1} color={colors.emerald} mt="auto">
                  <Text fontSize="xs" fontWeight={600}>Book now</Text>
                  <HiArrowRight size={12} />
                </HStack>
              </Card>
            </MotionBox>
          ))}
        </MotionSimpleGrid>
      </Container>
    </Box>
  );
}

export function WhyUsSection() {
  return (
    <Box as="section" py={{ base: 16, md: 20 }} bg={colors.surface}>
      <Container maxW="7xl" px={{ base: 4, md: 6 }}>
        <Flex
          direction={{ base: "column", lg: "row" }}
          gap={{ base: 12, lg: 16 }}
          align="start"
        >
          {/* Left */}
          <VStack align="start" gap={5} flex={1} maxW={{ lg: "380px" }}>
            <Badge
              bg="rgba(16,185,129,0.1)"
              color={colors.emerald}
              borderRadius="full"
              px={4}
              py={1}
              fontSize="xs"
              fontWeight={600}
              letterSpacing="0.5px"
              textTransform="uppercase"
            >
              Why choose us
            </Badge>
            <Heading as="h2" fontSize={{ base: "3xl", md: "4xl" }} fontWeight={800} color={colors.midnight}>
              The removal company that actually shows up.
            </Heading>
            <Text fontSize="lg" color={colors.muted} lineHeight="tall">
              We built MA Removals because we were tired of unreliable, overpriced removal companies. Now we&apos;re the alternative.
            </Text>
            <VStack align="start" gap={3}>
              {[
                "Fully insured on every job",
                "Fixed quotes — no surprises",
                "On-time, every time",
                "Real customer support",
              ].map((item) => (
                <HStack key={item} gap={3}>
                  <HiCheckCircle size={18} color={colors.emerald} style={{ flexShrink: 0 }} />
                  <Text fontSize="sm" fontWeight={500} color={colors.ink}>{item}</Text>
                </HStack>
              ))}
            </VStack>
            <CTAButton href="/book" ctaVariant="primary" size="lg" mt={2}>
              Get Your Free Quote
            </CTAButton>
          </VStack>

          {/* Right grid */}
          <MotionSimpleGrid
            columns={{ base: 1, sm: 2 }}
            gap={4}
            flex={1}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {WHY_US.map((item) => (
              <MotionBox
                key={item.title}
                variants={fadeRise}
                whileTap={{ scale: 0.98 }}
              >
                <Box
                  p={5}
                  bg="white"
                  borderRadius="xl"
                  border="1px solid rgba(0,0,0,0.05)"
                  h="full"
                  position="relative"
                  overflow="hidden"
                  style={{ boxShadow: "0 1px 4px rgba(11,17,32,0.05)" }}
                  _hover={{ boxShadow: "0 8px 24px rgba(11,17,32,0.08)" }}
                  transition="box-shadow 0.25s"
                >
                  {/* Accent top border in icon color */}
                  <Box
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                    h="3px"
                    borderTopRadius="xl"
                    style={{ background: `linear-gradient(to right, ${item.color}, ${item.color}55)` }}
                  />
                  <VStack align="start" gap={3} pt={1}>
                    <IconBox Icon={item.Icon} color={item.color} size={18} />
                    <Text fontFamily="heading" fontWeight={700} fontSize="sm" color={colors.midnight}>
                      {item.title}
                    </Text>
                    <Text fontSize="sm" color={colors.muted} lineHeight="tall">
                      {item.desc}
                    </Text>
                  </VStack>
                </Box>
              </MotionBox>
            ))}
          </MotionSimpleGrid>
        </Flex>
      </Container>
    </Box>
  );
}

export function TestimonialsSection() {
  // Split into two rows that scroll in opposite directions.
  const half = Math.ceil(TESTIMONIALS.length / 2);
  const rowA = TESTIMONIALS.slice(0, half);
  const rowB = TESTIMONIALS.slice(half);

  return (
    <Box as="section" py={{ base: 16, md: 20 }} bg={colors.midnight} overflow="hidden">
      <Container maxW="7xl" px={{ base: 4, md: 6 }}>
        <VStack gap={3} mb={12} align={{ base: "start", md: "center" }} textAlign={{ base: "left", md: "center" }}>
          <Badge
            bg="rgba(37,99,235,0.1)"
            color={colors.emerald}
            borderRadius="full"
            px={4}
            py={1}
            fontSize="xs"
            fontWeight={600}
            letterSpacing="0.5px"
            textTransform="uppercase"
          >
            Reviews
          </Badge>
          <Heading as="h2" fontSize={{ base: "3xl", md: "4xl" }} fontWeight={800} color="white">
            What our customers say
          </Heading>
          <HStack gap={2} mt={1}>
            <HStack gap={0.5}>
              {Array.from({ length: 5 }).map((_, i) => (
                <FaStar key={i} size={16} color={i < Math.round(SITE.maps.rating) ? "#FFB900" : "rgba(255,255,255,0.35)"} />
              ))}
            </HStack>
            <Text fontSize="sm" color="rgba(255,255,255,0.6)">
              Rated <Text as="span" fontWeight={700} color="white">{SITE.maps.rating.toFixed(1)}</Text> on{" "}
              <Text as="span" fontWeight={700} color="#FFB900">Google</Text>
            </Text>
          </HStack>
        </VStack>
      </Container>

      {/* Moving marquee rows — full-bleed, edge-faded */}
      <Box
        position="relative"
        css={{
          maskImage:
            "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
        }}
      >
        <VStack gap={5} align="stretch">
          <MarqueeRow items={[...rowA, ...rowB]} duration={48} />
          <MarqueeRow items={[...rowB, ...rowA]} duration={60} reverse />
        </VStack>
      </Box>
    </Box>
  );
}

type Testimonial = (typeof TESTIMONIALS)[number];

function MarqueeRow({
  items,
  duration,
  reverse = false,
}: {
  items: Testimonial[];
  duration: number;
  reverse?: boolean;
}) {
  // Duplicate the list so the -50% translate loops seamlessly.
  const loop = [...items, ...items];
  return (
    <Box overflow="hidden" css={{ "&:hover .ma-track": { animationPlayState: "paused" } }}>
      <Flex
        className="ma-track"
        gap={5}
        w="max-content"
        css={{
          animation: `maMarquee ${duration}s linear infinite`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        {loop.map((t, i) => (
          <TestimonialCard key={`${t.name}-${i}`} t={t} />
        ))}
      </Flex>
    </Box>
  );
}

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
                  <Box
      flex="0 0 auto"
      w={{ base: "300px", md: "380px" }}
      p={6}
      bg="rgba(37,99,235,0.04)"
      border="1px solid rgba(37,99,235,0.35)"
      borderRadius="2xl"
      position="relative"
      overflow="hidden"
      boxShadow="0 0 0 1px rgba(37,99,235,0.15), 0 0 18px rgba(37,99,235,0.25), inset 0 0 24px rgba(37,99,235,0.06)"
      transition="box-shadow 0.3s ease, border-color 0.3s ease, transform 0.3s ease"
      _hover={{
        borderColor: "rgba(37,99,235,0.7)",
        boxShadow:
          "0 0 0 1px rgba(37,99,235,0.4), 0 0 28px rgba(37,99,235,0.55), 0 0 60px rgba(37,99,235,0.3), inset 0 0 28px rgba(37,99,235,0.1)",
        transform: "translateY(-4px)",
      }}
    >
      <Box
        position="absolute"
        top={3}
        right={4}
        fontSize="6xl"
        lineHeight={1}
        color="rgba(255,255,255,0.06)"
        fontFamily="var(--font-heading)"
        fontWeight={800}
        pointerEvents="none"
      >
        &ldquo;
      </Box>
      <VStack align="start" gap={4} h="full">
        <HStack gap={0.5}>
          {Array.from({ length: t.rating }).map((_, j) => (
            <FaStar key={j} size={14} color={colors.amber} />
          ))}
        </HStack>
        <Text fontSize="sm" color="rgba(255,255,255,0.75)" lineHeight="tall" fontStyle="italic">
          &ldquo;{t.text}&rdquo;
        </Text>
        <HStack gap={2} mt="auto">
          <Box
            w={8}
            h={8}
            borderRadius="full"
            bg={colors.emerald}
            display="flex"
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <Text fontSize="xs" fontWeight={700} color="white">
              {t.name[0]}
            </Text>
          </Box>
          <VStack align="start" gap={0}>
            <Text fontSize="sm" fontWeight={600} color="white">{t.name}</Text>
            <Text fontSize="xs" color="rgba(255,255,255,0.4)">{t.location}</Text>
          </VStack>
        </HStack>
      </VStack>
    </Box>
  );
}

export function AreasSection() {
  const regions = [
    { key: "glasgow" as const, label: "Glasgow & West" },
    { key: "edinburgh" as const, label: "Edinburgh, Lothians & Fife" },
    { key: "stirling" as const, label: "Stirling & Central" },
    { key: "dundee" as const, label: "Dundee, Perthshire & Angus" },
    { key: "aberdeen" as const, label: "Aberdeen & North East" },
    { key: "highlands" as const, label: "Highlands & Islands" },
    { key: "borders" as const, label: "Borders & Dumfries" },
  ];

  return (
    <Box as="section" py={{ base: 16, md: 20 }} bg={colors.slate}>
      <Container maxW="7xl" px={{ base: 4, md: 6 }}>
        <VStack gap={3} mb={12} align={{ base: "start", md: "center" }} textAlign={{ base: "left", md: "center" }}>
          <Badge
            bg="rgba(16,185,129,0.1)"
            color={colors.emerald}
            borderRadius="full"
            px={4}
            py={1}
            fontSize="xs"
            fontWeight={600}
            letterSpacing="0.5px"
            textTransform="uppercase"
          >
            Coverage
          </Badge>
          <Heading as="h2" fontSize={{ base: "3xl", md: "4xl" }} fontWeight={800} color={colors.midnight}>
            We cover the whole of Scotland
          </Heading>
          <Text fontSize="lg" color={colors.muted} maxW="520px">
            Glasgow, Edinburgh, Dundee, Aberdeen, Stirling, the Highlands and the Borders — and every town in between. Local knowledge, Scotland-wide coverage.
          </Text>
        </VStack>

        <SimpleGrid columns={{ base: 1, md: 3 }} gap={6}>
          {regions.map(({ key, label }) => {
            const areas = ALL_AREAS.filter((a) => a.region === key);
            return (
              <Card key={key} p={6}>
                <VStack align="start" gap={4}>
                  <Text fontFamily="heading" fontWeight={800} fontSize="lg" color={colors.midnight}>
                    {label}
                  </Text>
                  <MotionFlex
                    gap={2}
                    flexWrap="wrap"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={staggerContainerFast}
                  >
                    {areas.map((area) => (
                      <MotionBox
                        key={area.slug}
                        variants={scaleIn}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      >
                        <Box
                          asChild
                          px={3}
                          py={1.5}
                          bg={colors.slate}
                          borderRadius="full"
                          fontSize="xs"
                          fontWeight={500}
                          color={colors.ink}
                          border="1px solid transparent"
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
                      </MotionBox>
                    ))}
                  </MotionFlex>
                </VStack>
              </Card>
            );
          })}
        </SimpleGrid>
      </Container>
    </Box>
  );
}

export function BottomCTASection() {
  return (
    <Box
      as="section"
      py={{ base: 16, md: 20 }}
      bg={colors.emerald}
      position="relative"
      overflow="hidden"
    >
      {/* Diagonal stripe texture */}
      <Box
        position="absolute"
        inset={0}
        pointerEvents="none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, transparent, transparent 14px, rgba(255,255,255,0.035) 14px, rgba(255,255,255,0.035) 28px)",
        }}
      />
      {/* Left glow orb */}
      <Box
        position="absolute"
        top="-40%"
        left="-10%"
        w="500px"
        h="500px"
        borderRadius="full"
        bg="rgba(255,255,255,0.07)"
        pointerEvents="none"
        style={{ filter: "blur(80px)" }}
      />
      {/* Right glow orb */}
      <Box
        position="absolute"
        bottom="-30%"
        right="-5%"
        w="400px"
        h="400px"
        borderRadius="full"
        bg="rgba(0,0,0,0.08)"
        pointerEvents="none"
        style={{ filter: "blur(60px)" }}
      />
      <Box
        position="absolute"
        inset={0}
        opacity={0.05}
        backgroundImage="radial-gradient(circle at 30% 50%, white 0%, transparent 60%)"
        pointerEvents="none"
      />
      <Container maxW="4xl" px={{ base: 4, md: 6 }} position="relative">
        <VStack gap={6} textAlign="center">
          <Heading
            as="h2"
            fontSize={{ base: "3xl", md: "4xl", lg: "5xl" }}
            fontWeight={800}
            color="white"
            lineHeight={1.1}
          >
            Ready to move?
          </Heading>
          <Text fontSize="xl" color="rgba(255,255,255,0.85)" maxW="480px">
            Get your free quote in seconds. Book online, pay securely, and we&apos;ll handle the rest.
          </Text>
          <HStack gap={4} flexWrap="wrap" justify="center">
            <CTAButton
              href="/book"
              bg={colors.midnight}
              color="white"
              size="lg"
              px={8}
              fontSize="md"
              _hover={{ bg: colors.ink }}
            >
              Book Your Move
            </CTAButton>
            <CTAButton
              href={`tel:${SITE.phone}`}
              bg="rgba(255,255,255,0.15)"
              color="white"
              border="2px solid rgba(255,255,255,0.4)"
              size="lg"
              px={6}
              fontSize="md"
              _hover={{ bg: "rgba(255,255,255,0.25)" }}
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
  );
}

export function StatsBand() {
  return (
    <Box
      as="section"
      bg={colors.midnight}
      py={{ base: 10, md: 12 }}
      borderTop="1px solid rgba(255,255,255,0.06)"
      position="relative"
      overflow="hidden"
    >
      {/* Subtle radial glow in the centre */}
      <Box
        position="absolute"
        top="50%"
        left="50%"
        w="600px"
        h="300px"
        pointerEvents="none"
        style={{
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(ellipse at center, rgba(37,99,235,0.12) 0%, transparent 70%)",
        }}
      />
      <Container maxW="6xl" px={{ base: 4, md: 6 }} position="relative">
        <MotionSimpleGrid
          columns={{ base: 2, md: 4 }}
          gap={0}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={staggerContainerFast}
        >
          {STATS.map((s, i) => (
            <MotionBox key={s.label} variants={scaleIn} textAlign="center" position="relative">
              {/* Vertical divider (between items on desktop) */}
              {i > 0 && (
                <Box
                  display={{ base: "none", md: "block" }}
                  position="absolute"
                  left={0}
                  top="50%"
                  h="48px"
                  w="1px"
                  style={{
                    transform: "translateY(-50%)",
                    background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.12), transparent)",
                  }}
                />
              )}
              <Box py={{ base: 4, md: 6 }} px={{ base: 2, md: 6 }}>
                <Text
                  fontFamily="heading"
                  fontWeight={800}
                  fontSize={{ base: "3xl", md: "4xl" }}
                  bgGradient="linear(135deg, #2563EB, #2563EB)"
                  bgClip="text"
                  lineHeight={1}
                >
                  {s.value}
                </Text>
                <Text fontSize={{ base: "xs", md: "sm" }} color="rgba(255,255,255,0.5)" mt={2} fontWeight={500}>
                  {s.label}
                </Text>
              </Box>
            </MotionBox>
          ))}
        </MotionSimpleGrid>
      </Container>
    </Box>
  );
}

export function HowItWorksSection() {
  return (
    <Box as="section" py={{ base: 16, md: 20 }} bg={colors.surface}>
      <Container maxW="7xl" px={{ base: 4, md: 6 }}>
        <VStack gap={3} mb={12} align={{ base: "start", md: "center" }} textAlign={{ base: "left", md: "center" }}>
          <Badge
            bg="rgba(16,185,129,0.1)"
            color={colors.emerald}
            borderRadius="full"
            px={4}
            py={1}
            fontSize="xs"
            fontWeight={600}
            letterSpacing="0.5px"
            textTransform="uppercase"
          >
            How it works
          </Badge>
          <Heading as="h2" fontSize={{ base: "3xl", md: "4xl" }} fontWeight={800} color={colors.midnight}>
            Booked in 3 simple steps
          </Heading>
          <Text fontSize="lg" color={colors.muted} maxW="520px">
            No phone tag, no waiting around. Get a price and lock in your move in minutes.
          </Text>
        </VStack>

        <MotionSimpleGrid
          columns={{ base: 1, md: 3 }}
          gap={6}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={staggerContainer}
        >
          {STEPS.map((step, i) => (
            <MotionBox key={step.step} variants={fadeRise} position="relative">
              <Box
                p={6}
                bg={colors.slate}
                borderRadius="2xl"
                border="1px solid rgba(0,0,0,0.04)"
                h="full"
                position="relative"
                overflow="hidden"
              >
                <Text
                  position="absolute"
                  top={2}
                  right={4}
                  fontFamily="heading"
                  fontWeight={800}
                  fontSize="6xl"
                  color="rgba(16,185,129,0.08)"
                  lineHeight={1}
                  pointerEvents="none"
                >
                  {step.step}
                </Text>
                <VStack align="start" gap={3}>
                  <IconBox Icon={step.Icon} color={step.color} size={20} />
                  <Heading as="h3" fontSize="lg" fontWeight={700} color={colors.midnight}>
                    {step.title}
                  </Heading>
                  <Text fontSize="sm" color={colors.muted} lineHeight="tall">
                    {step.desc}
                  </Text>
                </VStack>
              </Box>
              {i < STEPS.length - 1 && (
                <Box
                  display={{ base: "none", md: "flex" }}
                  position="absolute"
                  top="50%"
                  right={-5}
                  transform="translateY(-50%)"
                  color={colors.emerald}
                  zIndex={1}
                >
                  <HiArrowRight size={20} />
                </Box>
              )}
            </MotionBox>
          ))}
        </MotionSimpleGrid>

        <Flex justify="center" mt={10}>
          <CTAButton href="/book" ctaVariant="primary" size="lg" px={8} fontSize="md">
            Start Your Free Quote
          </CTAButton>
        </Flex>
      </Container>
    </Box>
  );
}

export function GuaranteeBand() {
  return (
    <Box as="section" py={{ base: 12, md: 14 }} bg={colors.slate} position="relative" overflow="hidden">
      {/* Dot grid decoration */}
      <Box
        position="absolute"
        inset={0}
        pointerEvents="none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(37,99,235,0.08) 1.5px, transparent 1.5px)",
          backgroundSize: "28px 28px",
        }}
      />
      <Container maxW="7xl" px={{ base: 4, md: 6 }} position="relative">
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={4}>
          {GUARANTEE_POINTS.map((p) => (
            <Box
              key={p.title}
              p={5}
              bg="white"
              borderRadius="2xl"
              border="1px solid rgba(0,0,0,0.05)"
              position="relative"
              overflow="hidden"
              style={{ boxShadow: `0 2px 12px ${p.color}12` }}
              _hover={{ boxShadow: `0 8px 28px ${p.color}22` }}
              transition="box-shadow 0.25s"
            >
              {/* Color accent bar */}
              <Box
                position="absolute"
                top={0}
                left={0}
                right={0}
                h="3px"
                style={{ background: `linear-gradient(to right, ${p.color}, ${p.color}60)` }}
              />
              <VStack align="start" gap={3} pt={1}>
                <IconBox Icon={p.Icon} color={p.color} size={18} />
                <VStack align="start" gap={0.5}>
                  <Text fontWeight={700} fontSize="sm" color={colors.midnight}>{p.title}</Text>
                  <Text fontSize="xs" color={colors.muted}>{p.desc}</Text>
                </VStack>
              </VStack>
            </Box>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Box
      bg="white"
      borderRadius="xl"
      border="1px solid rgba(0,0,0,0.06)"
      overflow="hidden"
    >
      <Box
        as="button"
        onClick={() => setOpen((v) => !v)}
        w="full"
        textAlign="left"
        px={5}
        py={4}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={3}
        _hover={{ bg: colors.slate }}
        transition="background 0.15s"
        aria-expanded={open}
      >
        <Text fontWeight={700} fontSize="sm" color={colors.midnight}>
          {q}
        </Text>
        <MotionBox
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          flexShrink={0}
          color={colors.emerald}
        >
          <HiChevronDown size={20} />
        </MotionBox>
      </Box>
      <AnimatePresence initial={false}>
        {open && (
          <MotionBox
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            overflow="hidden"
          >
            <Text px={5} pb={5} fontSize="sm" color={colors.muted} lineHeight="tall">
              {a}
            </Text>
          </MotionBox>
        )}
      </AnimatePresence>
    </Box>
  );
}

export function FAQSection() {
  return (
    <Box as="section" py={{ base: 16, md: 20 }} bg={colors.surface}>
      <Container maxW="4xl" px={{ base: 4, md: 6 }}>
        <VStack gap={3} mb={10} align={{ base: "start", md: "center" }} textAlign={{ base: "left", md: "center" }}>
          <Badge
            bg="rgba(16,185,129,0.1)"
            color={colors.emerald}
            borderRadius="full"
            px={4}
            py={1}
            fontSize="xs"
            fontWeight={600}
            letterSpacing="0.5px"
            textTransform="uppercase"
          >
            FAQs
          </Badge>
          <Heading as="h2" fontSize={{ base: "3xl", md: "4xl" }} fontWeight={800} color={colors.midnight}>
            Questions, answered
          </Heading>
          <Text fontSize="lg" color={colors.muted} maxW="520px">
            Everything you need to know before you book. Still unsure? Call or WhatsApp us anytime.
          </Text>
        </VStack>

        <VStack gap={3} align="stretch">
          {FAQS.map((f) => (
            <FAQItem key={f.q} q={f.q} a={f.a} />
          ))}
        </VStack>

        <Flex justify="center" mt={10}>
          <HStack gap={3} flexWrap="wrap" justify="center">
            <CTAButton href="/book" ctaVariant="primary" size="lg" px={8} fontSize="md">
              Get a Free Quote
            </CTAButton>
            <Box
              asChild
              onClick={() => trackContact("whatsapp")}
              display="flex"
              alignItems="center"
              gap={2}
              px={6}
              py={3}
              borderRadius="lg"
              bg="#2563EB"
              color="white"
              fontWeight={600}
              fontSize="sm"
              _hover={{ bg: "#1FB855", textDecoration: "none" }}
              transition="all 0.2s"
            >
              <a
                href={`https://wa.me/${SITE.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <HStack gap={2}>
                  <FaWhatsapp size={18} />
                  <Text>WhatsApp Us</Text>
                </HStack>
              </a>
            </Box>
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
}

export function FindUsSection() {
  const { rating, reviewCount, embedUrl, profileUrl, directionsUrl } = SITE.maps;
  return (
    <Box as="section" py={{ base: 16, md: 20 }} bg={colors.surface}>
      <Container maxW="7xl" px={{ base: 4, md: 6 }}>
        <Flex direction={{ base: "column", lg: "row" }} gap={{ base: 10, lg: 16 }} align="start">
          {/* Left — copy + Google rating */}
          <VStack align="start" gap={5} flex={1} maxW={{ lg: "420px" }}>
            <Badge
              bg="rgba(16,185,129,0.1)"
              color={colors.emerald}
              borderRadius="full"
              px={4}
              py={1}
              fontSize="xs"
              fontWeight={600}
              letterSpacing="0.5px"
              textTransform="uppercase"
            >
              Find us
            </Badge>
            <Heading as="h2" fontSize={{ base: "3xl", md: "4xl" }} fontWeight={800} color={colors.midnight}>
              Glasgow&apos;s trusted local removals
            </Heading>
            <Text fontSize="lg" color={colors.muted} lineHeight="tall">
              Based in Glasgow and covering the whole of Scotland — from the Borders to the Highlands & Islands,
              including Edinburgh, Dundee, Aberdeen, Stirling and Inverness. Open 24/7 for quotes and bookings.
            </Text>

            {/* Google rating card */}
            <Box
              asChild
              w="full"
              p={5}
              bg={colors.slate}
              borderRadius="2xl"
              border="1px solid rgba(0,0,0,0.06)"
              boxShadow="0 2px 8px rgba(0,0,0,0.04)"
              _hover={{
                borderColor: "rgba(66,133,244,0.3)",
                textDecoration: "none",
                boxShadow: "0 8px 32px rgba(66,133,244,0.15)",
              }}
              transition="all 0.3s cubic-bezier(0.4,0,0.2,1)"
              position="relative"
              overflow="hidden"
            >
              <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                <HStack gap={4} align="center">
                  {/* Animated Google icon */}
                  <Box position="relative" w="54px" h="54px" flexShrink={0}>
                    {/* Slow-spinning conic gradient ring — Google brand colours */}
                    <MotionBox
                      position="absolute"
                      inset="0"
                      borderRadius="full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                      style={{
                        background:
                          "conic-gradient(from 0deg, #4285F4 0%, #EA4335 33%, #FBBC05 60%, #34A853 85%, #4285F4 100%)",
                      }}
                    />
                    {/* White inner circle */}
                    <Box
                      position="absolute"
                      inset="3px"
                      borderRadius="full"
                      bg="white"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      boxShadow="0 1px 4px rgba(0,0,0,0.06)"
                    >
                      {/* Authentic multicolour Google G */}
                      <svg width="22" height="22" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                    </Box>
                  </Box>

                  <VStack align="start" gap={0.5}>
                    <HStack gap={2}>
                      <Text fontWeight={800} fontSize="lg" color={colors.midnight}>
                        {rating.toFixed(1)}
                      </Text>
                      <HStack gap={0.5}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <MotionBox
                            key={i}
                            display="inline-flex"
                            initial={{ opacity: 0, scale: 0.2, rotate: -15 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            transition={{ delay: 0.15 + i * 0.07, duration: 0.4, ease: "backOut" }}
                          >
                            <FaStar
                              size={14}
                              color={i < Math.round(rating) ? colors.amber : "#CBD5E1"}
                            />
                          </MotionBox>
                        ))}
                      </HStack>
                    </HStack>
                    <Text fontSize="sm" color={colors.muted}>
                      Rated on Google · {reviewCount} reviews
                    </Text>
                  </VStack>
                  <Box ml="auto" color={colors.emerald}>
                    <HiArrowRight size={20} />
                  </Box>
                </HStack>
              </a>
            </Box>

            <HStack gap={3} flexWrap="wrap">
              <CTAButton href="/book" ctaVariant="primary" size="lg" px={8} fontSize="md">
                Get a Free Quote
              </CTAButton>
              <Box
                asChild
                display="flex"
                alignItems="center"
                gap={2}
                px={6}
                py={3}
                borderRadius="lg"
                border={`2px solid ${colors.emerald}`}
                color={colors.emerald}
                fontWeight={600}
                fontSize="sm"
                _hover={{ bg: colors.emerald, color: "white", textDecoration: "none" }}
                transition="all 0.2s"
              >
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                  <HStack gap={2}>
                    <HiLocationMarker size={18} />
                    <Text>Get Directions</Text>
                  </HStack>
                </a>
              </Box>
            </HStack>
          </VStack>

          {/* Right — Google map embed */}
          <Box flex={1} w="full">
            <Box
              borderRadius="2xl"
              overflow="hidden"
              border="1px solid rgba(0,0,0,0.08)"
              boxShadow={shadows.card}
              h={{ base: "320px", md: "440px" }}
              position="relative"
            >
              <Box
                asChild
                w="full"
                h="full"
                border="0"
              >
                <iframe
                  title="MA Removals on Google Maps — Glasgow & Central Scotland"
                  src={embedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </Box>
            </Box>
          </Box>
        </Flex>
      </Container>
    </Box>
  );
}
