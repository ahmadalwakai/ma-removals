"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import { colors } from "@/lib/tokens";

interface Message {
  id: string;
  content: string;
  senderRole: string;
  senderId: string | null;
  createdAt: string;
  sender?: { id?: string; name?: string | null; role?: string } | null;
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSender: boolean;
}

const ROLE_BADGE: Record<string, { label: string; bg: string; color: string }> =
  {
    CUSTOMER: { label: "Customer", bg: "rgba(245,158,11,0.12)", color: colors.amber },
    DRIVER: { label: "Driver", bg: "rgba(16,185,129,0.12)", color: colors.emerald },
    ADMIN: { label: "Admin", bg: "rgba(11,17,32,0.08)", color: colors.ink },
    SYSTEM: { label: "System", bg: "#F1F5F9", color: "#94A3B8" },
  };

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString())
    return (
      "Yesterday " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    );

  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({ message, isOwn, showSender }: MessageBubbleProps) {
  const isSystem = message.senderRole === "SYSTEM";
  const badge = (ROLE_BADGE[message.senderRole] ?? ROLE_BADGE["CUSTOMER"])!;

  if (isSystem) {
    return (
      <Box textAlign="center" py={2}>
        <Text
          fontSize="xs"
          color="gray.400"
          fontStyle="italic"
          display="inline-block"
          bg="gray.50"
          px={3}
          py={1}
          borderRadius="full"
        >
          {message.content}
        </Text>
      </Box>
    );
  }

  return (
    <Flex
      direction="column"
      alignItems={isOwn ? "flex-end" : "flex-start"}
      gap="2px"
    >
      {showSender && (
        <Flex
          alignItems="center"
          gap={1}
          px={1}
          flexDirection={isOwn ? "row-reverse" : "row"}
        >
          <Text fontSize="xs" color="gray.500" fontWeight={600}>
            {message.sender?.name ?? (isOwn ? "You" : "User")}
          </Text>
          <Box
            px="6px"
            py="1px"
            borderRadius="full"
            bg={badge.bg}
            fontSize="10px"
            fontWeight={700}
            color={badge.color}
          >
            {badge.label}
          </Box>
        </Flex>
      )}
      <Box
        maxW="75%"
        px={3}
        py={2}
        borderRadius="lg"
        bg={isOwn ? "rgba(16,185,129,0.1)" : "gray.100"}
        borderBottomRightRadius={isOwn ? "sm" : "lg"}
        borderBottomLeftRadius={isOwn ? "lg" : "sm"}
      >
        <Text
          fontSize="sm"
          color={isOwn ? "#065F46" : colors.ink}
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {message.content}
        </Text>
      </Box>
      <Text fontSize="10px" color="gray.400" px={1}>
        {formatTime(message.createdAt)}
      </Text>
    </Flex>
  );
}
