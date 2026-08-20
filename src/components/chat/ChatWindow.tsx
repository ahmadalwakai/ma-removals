"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Box, Flex, Text, VStack, HStack } from "@chakra-ui/react";
import { FiSend } from "react-icons/fi";
import { colors } from "@/lib/tokens";
import { getPusherClient } from "@/lib/pusher-client";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";

interface Message {
  id: string;
  content: string;
  senderRole: string;
  senderId: string | null;
  createdAt: string;
  sender?: { id: string; name?: string | null; role: string } | null;
}

interface ChatWindowProps {
  conversationId: string;
  currentUserId: string;
  currentUserRole: "CUSTOMER" | "DRIVER" | "ADMIN";
  height?: string;
}

export function ChatWindow({
  conversationId,
  currentUserId,
  currentUserRole,
  height = "400px",
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}/messages`
      );
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as { messages: Message[] };
      setMessages(data.messages);
      setError(null);
    } catch {
      setError("Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  // Mark as read
  const markRead = useCallback(() => {
    fetch(`/api/chat/conversations/${conversationId}/read`, {
      method: "POST",
    }).catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
    markRead();

    // Try Pusher first
    const pusher = getPusherClient();
    if (pusher) {
      const channel = pusher.subscribe(`conversation-${conversationId}`);
      channel.bind("new-message", (msg: Message) => {
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        markRead();
      });
      return () => {
        pusher.unsubscribe(`conversation-${conversationId}`);
      };
    } else {
      // Polling fallback every 5s
      pollRef.current = setInterval(fetchMessages, 5000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [conversationId, fetchMessages, markRead]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (content: string) => {
    const res = await fetch(
      `/api/chat/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }
    );
    if (!res.ok) throw new Error("Failed to send");
    const data = (await res.json()) as { message: Message };
    setMessages((prev) => {
      if (prev.find((m) => m.id === data.message.id)) return prev;
      return [...prev, data.message];
    });
  };

  if (loading) {
    return (
      <Box
        h={height}
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="white"
        borderRadius="xl"
        border="1px solid"
        borderColor="gray.200"
      >
        <Text color="gray.400" fontSize="sm">
          Loading messages...
        </Text>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      h={height}
      bg="white"
      borderRadius="xl"
      border="1px solid"
      borderColor="gray.200"
      overflow="hidden"
    >
      {/* Messages list */}
      <Box flex="1" overflowY="auto" p={3}>
        {error && (
          <Text color="red.500" fontSize="sm" textAlign="center" mb={2}>
            {error}
          </Text>
        )}
        {messages.length === 0 ? (
          <Flex
            h="100%"
            alignItems="center"
            justifyContent="center"
            flexDirection="column"
            gap={2}
          >
            <Text fontSize="2xl">💬</Text>
            <Text color="gray.400" fontSize="sm">
              No messages yet. Say hello!
            </Text>
          </Flex>
        ) : (
          <VStack gap={2} alignItems="stretch">
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.senderId === currentUserId}
                showSender={
                  i === 0 || messages[i - 1]?.senderId !== msg.senderId
                }
              />
            ))}
          </VStack>
        )}
        <div ref={bottomRef} />
      </Box>

      {/* Input */}
      <Box
        borderTop="1px solid"
        borderColor="gray.100"
        p={3}
      >
        <ChatInput onSend={handleSend} />
      </Box>
    </Box>
  );
}
