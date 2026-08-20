"use client";

import { Suspense, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { colors } from "@/lib/tokens";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/admin";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "400px",
        background: colors.ink,
        borderRadius: "16px",
        padding: "40px",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Brand */}
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            background: colors.emerald,
            borderRadius: "12px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "16px",
            fontSize: "24px",
          }}
        >
          🚚
        </div>
        <h1
          style={{
            color: "#ffffff",
            fontSize: "22px",
            fontWeight: 700,
            margin: 0,
            fontFamily: "var(--font-heading, 'Plus Jakarta Sans', sans-serif)",
          }}
        >
          MA Removals
        </h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", margin: "6px 0 0" }}>
          Admin Portal
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "8px",
              padding: "12px 14px",
              color: "#fca5a5",
              fontSize: "14px",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: "16px" }}>
          <label
            htmlFor="email"
            style={{
              display: "block",
              color: "rgba(255,255,255,0.7)",
              fontSize: "13px",
              fontWeight: 500,
              marginBottom: "6px",
            }}
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "11px 14px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "8px",
              color: "#ffffff",
              fontSize: "15px",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = colors.emerald)}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
          />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label
            htmlFor="password"
            style={{
              display: "block",
              color: "rgba(255,255,255,0.7)",
              fontSize: "13px",
              fontWeight: 500,
              marginBottom: "6px",
            }}
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "11px 14px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "8px",
              color: "#ffffff",
              fontSize: "15px",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = colors.emerald)}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "13px",
            background: loading ? "rgba(16,185,129,0.5)" : colors.emerald,
            border: "none",
            borderRadius: "8px",
            color: "#ffffff",
            fontSize: "15px",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "var(--font-body, Inter, sans-serif)",
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.midnight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "var(--font-body, Inter, sans-serif)",
      }}
    >
      <Suspense
        fallback={
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "14px" }}>Loading…</div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
