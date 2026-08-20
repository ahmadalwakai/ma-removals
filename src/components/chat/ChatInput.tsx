"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { Box, Flex, Textarea } from "@chakra-ui/react";
import { FiSend } from "react-icons/fi";
import { colors } from "@/lib/tokens";

interface ChatInputProps {
  onSend: (content: string) => Promise<void>;
  placeholder?: string;
}

export function ChatInput({ onSend, placeholder = "Type a message..." }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setValue("");
      ref.current?.focus();
    } catch {
      // keep content on failure
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const remaining = 1000 - value.length;

  return (
    <Flex gap={2} alignItems="flex-end">
      <Box flex="1" position="relative">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 1000))}
          onKeyDown={handleKey}
          placeholder={placeholder}
          disabled={sending}
          rows={1}
          style={{
            width: "100%",
            resize: "none",
            border: "1.5px solid #E2E8F0",
            borderRadius: "10px",
            padding: "10px 12px",
            fontSize: "14px",
            fontFamily: "inherit",
            background: "#F8FAFC",
            color: colors.ink,
            outline: "none",
            maxHeight: "96px",
            overflowY: "auto",
            lineHeight: "1.5",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = colors.emerald;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#E2E8F0";
          }}
        />
        {value.length > 900 && (
          <Box
            position="absolute"
            bottom="6px"
            right="10px"
            fontSize="10px"
            color={remaining < 50 ? "red.400" : "gray.400"}
          >
            {remaining}
          </Box>
        )}
      </Box>
      <button
        onClick={handleSend}
        disabled={!value.trim() || sending}
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          background: !value.trim() || sending ? "#E2E8F0" : colors.amber,
          border: "none",
          cursor: !value.trim() || sending ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background 0.15s, transform 0.1s",
        }}
        onMouseDown={(e) => {
          if (!(!value.trim() || sending)) {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.93)";
          }
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        }}
        aria-label="Send message"
      >
        {sending ? (
          <div
            style={{
              width: 16,
              height: 16,
              border: "2px solid #94A3B8",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.6s linear infinite",
            }}
          />
        ) : (
          <FiSend size={16} color={!value.trim() ? "#94A3B8" : "white"} />
        )}
      </button>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Flex>
  );
}
