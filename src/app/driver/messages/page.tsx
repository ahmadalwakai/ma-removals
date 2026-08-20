"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { colors } from "@/lib/tokens";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { FiMessageSquare, FiArrowLeft } from "react-icons/fi";

interface Conversation {
  id: string;
  title: string;
  bookingRef: string;
  lastMessage: {
    content: string;
    senderRole: string;
    senderName?: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  participants: { userId: string; name?: string | null; role: string }[];
  updatedAt: string;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function DriverMessagesPage() {
  const { data: session } = useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/chat/conversations")
      .then((r) => r.json())
      .then((d: { conversations: Conversation[] }) => {
        setConversations(d.conversations ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (active && session?.user?.id) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 130px)" }}>
        {/* Back header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            background: "#1E293B",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <button
            onClick={() => setActive(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.7)",
              padding: 4,
              display: "flex",
            }}
          >
            <FiArrowLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "white" }}>
              {active.bookingRef}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              {active.participants.map((p) => p.name ?? p.role).join(", ")}
            </p>
          </div>
        </div>
        {/* Chat */}
        <div style={{ flex: 1, padding: "12px 12px 0", overflow: "hidden" }}>
          <ChatWindow
            conversationId={active.id}
            currentUserId={session.user.id}
            currentUserRole="DRIVER"
            height="100%"
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 80px" }}>
      <h1
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 20,
          fontWeight: 800,
          color: "white",
          margin: "0 0 4px",
        }}
      >
        Messages
      </h1>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 20px" }}>
        Conversations with customers and dispatch
      </p>

      {loading && (
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Loading...</p>
      )}

      {!loading && conversations.length === 0 && (
        <div style={{ textAlign: "center", paddingTop: 60 }}>
          <FiMessageSquare size={40} color="rgba(255,255,255,0.2)" />
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginTop: 12 }}>
            No conversations yet. Accept a job to start messaging.
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => setActive(conv)}
            style={{
              background: "#1E293B",
              border: "1.5px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "14px 16px",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(16,185,129,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FiMessageSquare size={18} color={colors.emerald} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 2,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 700,
                    color: "white",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {conv.bookingRef}
                </p>
                {conv.lastMessage && (
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                    {timeAgo(conv.lastMessage.createdAt)}
                  </span>
                )}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "rgba(255,255,255,0.5)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {conv.lastMessage
                  ? `${conv.lastMessage.senderName ?? conv.lastMessage.senderRole}: ${conv.lastMessage.content}`
                  : "No messages yet"}
              </p>
            </div>

            {/* Unread badge */}
            {conv.unreadCount > 0 && (
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: colors.emerald,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "white",
                  flexShrink: 0,
                }}
              >
                {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

