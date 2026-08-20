"use client";

import { ChatWindow } from "@/components/chat/ChatWindow";
import { colors } from "@/lib/tokens";

interface AdminChatPanelProps {
  bookingId: string;
  conversationId: string | null;
  currentUserId: string;
}

export function AdminChatPanel({ conversationId, currentUserId }: AdminChatPanelProps) {

  return (
    <div
      style={{
        background: "white",
        borderRadius: 12,
        border: "1px solid #E2E8F0",
        padding: "20px 24px",
        marginBottom: 16,
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 14,
          fontWeight: 700,
          color: colors.muted,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 16,
          margin: "0 0 16px",
        }}
      >
        Conversation
      </h3>

      {!conversationId ? (
        <div
          style={{
            padding: "32px 0",
            textAlign: "center",
            color: colors.muted,
            fontSize: 13,
          }}
        >
          No conversation yet. A chat will be created automatically when the booking is confirmed.
        </div>
      ) : currentUserId ? (
        <ChatWindow
          conversationId={conversationId}
          currentUserId={currentUserId}
          currentUserRole="ADMIN"
          height="400px"
        />
      ) : null}
    </div>
  );
}
