import { Box, Container, Heading, Text, VStack } from "@chakra-ui/react";
import { CTAButton } from "@/components/ui/CTAButton";
import { colors } from "@/lib/tokens";

export default function NotFound() {
  return (
    <Box
      bg={colors.midnight}
      minH="70vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Container maxW="2xl" px={4}>
        <VStack gap={6} textAlign="center">
          <Text
            fontFamily="mono"
            fontSize="7xl"
            fontWeight={600}
            color={colors.emerald}
            lineHeight={1}
          >
            404
          </Text>
          <Heading as="h1" fontSize={{ base: "2xl", md: "3xl" }} fontWeight={800} color="white">
            Page not found
          </Heading>
          <Text fontSize="lg" color="rgba(255,255,255,0.55)" maxW="360px">
            This page doesn&apos;t exist. But we can still move your stuff.
          </Text>
          <VStack gap={3}>
            <CTAButton href="/" ctaVariant="primary" size="lg">
              Back to Home
            </CTAButton>
            <CTAButton href="/book" ctaVariant="ghost" size="md">
              Get a Quote
            </CTAButton>
          </VStack>
        </VStack>
      </Container>
    </Box>
  );
}
